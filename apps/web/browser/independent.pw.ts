import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { a, b, fixtures, canary } from "./fixtures/recordedRuns";

const evidence = new URL("../../../spikes/person2-web/evidence/independent/", import.meta.url);
async function report(name: string, result: unknown) {
  await mkdir(evidence, { recursive: true });
  await writeFile(new URL(`${name}.json`, evidence), JSON.stringify(result, null, 2) + "\n");
}

test("mobile comparison: each clipped column can be reached and its computed text contrast measured", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/?compareA=${a}&compareB=${b}`);
  await expect(page.getByRole("region", { name: "Run comparison", exact: true })).toContainText("Comparison ready.");
  const checks = [];
  for (const name of ["Run configuration comparison table", "Run step comparison table"]) {
    const region = page.getByRole("region", { name, exact: true });
    const samples = await region.evaluate(root => {
      const rgb = (color: string) => {
        const parts = color.match(/[\d.]+/g)?.map(Number);
        if (!parts || parts.length < 3 || (parts[3] ?? 1) !== 1) throw new Error("Opaque RGB color required for this measurement");
        return parts.slice(0, 3);
      };
      const luminance = (color: number[]) => color.map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      return [...root.querySelectorAll<HTMLElement>("th,td")].map(cell => {
        cell.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
        let background = "";
        for (let ancestor: HTMLElement | null = cell; ancestor; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).opacity !== "1") throw new Error("Composited opacity needs separate review");
          const value = getComputedStyle(ancestor).backgroundColor;
          if (value !== "rgba(0, 0, 0, 0)") { background = value; break; }
        }
        const foreground = luminance(rgb(getComputedStyle(cell).color));
        const back = luminance(rgb(background));
        const rect = cell.getBoundingClientRect(), bounds = root.getBoundingClientRect();
        return { ratio: (Math.max(foreground, back) + 0.05) / (Math.min(foreground, back) + 0.05), visibleWidth: Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)), requiredWidth: Math.min(rect.width, bounds.width) };
      });
    });
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.ratio).toBeGreaterThanOrEqual(4.5);
      expect(sample.visibleWidth + 2).toBeGreaterThanOrEqual(sample.requiredWidth);
    }
    checks.push({ region: name, cellsMeasured: samples.length, minimumContrast: Number(Math.min(...samples.map(s => s.ratio)).toFixed(2)), allColumnsReachable: true });
  }
  await expect(page.locator("body")).not.toContainText(canary);
  await report("mobile-column-contrast", { source: "synthetic_playground_ui", check: "automated_computed_colors_not_manual_screen_reader", viewportWidth: 320, checks, result: "passed", limitation: "CSS color measurement for the current opaque comparison tables; does not replace axe or human visual review." });
});

test("actual Chromium tab zoom: recorded journey, comparison and filters reflow at 200 and 400 percent", async ({}, testInfo) => {
  // tabs.setZoom changes browser zoom; CSS zoom and page-scale/pinch emulation
  // would not prove this. The extension/profile exist only in a fresh temp dir.
  const temporary = await mkdtemp(join(tmpdir(), "person2-zoom-"));
  const extension = join(temporary, "extension");
  await mkdir(extension);
  await writeFile(join(extension, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "Synthetic playground zoom check", version: "1.0", permissions: ["tabs"], background: { service_worker: "worker.js" } }));
  await writeFile(join(extension, "worker.js"), "chrome.runtime.onInstalled.addListener(() => {});\n");
  let context;
  try {
    context = await chromium.launchPersistentContext(join(temporary, "profile"), { channel: "chromium", headless: true, viewport: null, baseURL: testInfo.project.use.baseURL!, serviceWorkers: "allow", args: ["--window-size=1440,1000", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const page = context.pages()[0] ?? await context.newPage();
    await fixtures(page);
    await page.goto(`/?run=${a}&compareA=${a}&compareB=${b}`);
    await expect(page.getByRole("region", { name: "Run comparison", exact: true })).toContainText("Comparison ready.");
    const initial = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    const measurements = [];
    for (const factor of [2, 4]) {
      const actual = await worker.evaluate(async factor => {
        const tabs = (globalThis as unknown as { chrome: { tabs: { query: (query: unknown) => Promise<Array<{ id: number }>>; setZoom: (id: number, factor: number) => Promise<void>; getZoom: (id: number) => Promise<number> } } }).chrome.tabs;
        const [tab] = await tabs.query({ active: true });
        if (!tab) throw new Error("Synthetic tab unavailable");
        await tabs.setZoom(tab.id, factor);
        return tabs.getZoom(tab.id);
      }, factor);
      expect(actual).toBeCloseTo(factor, 6);
      await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(initial.dpr * factor, 1);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth }));
      expect(dimensions.width).toBeLessThanOrEqual(Math.ceil(initial.width / factor) + 1);
      expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.width + 1);
      await page.getByLabel("Filter status").selectOption("failed");
      await expect(page.getByText("No runs match these filters.")).toBeVisible();
      await page.getByLabel("Filter status").selectOption("");
      await page.getByRole("region", { name: "Run configuration comparison table" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("region", { name: "Run configuration comparison table" })).toBeFocused();
      await expect(page.locator("body")).not.toContainText(canary);
      measurements.push({ factor, observedZoom: Number(actual.toFixed(6)), devicePixelRatio: await page.evaluate(() => devicePixelRatio), cssViewportWidth: dimensions.width, pageWidth: dimensions.pageWidth, filterAndKeyboardChecks: "passed" });
    }
    await report("browser-zoom", { source: "isolated_synthetic_chromium", check: "browser_tabs_setZoom_not_css_zoom_or_pinch", browserVersion: context.browser()?.version() ?? "unreported", baseline: initial, result: "passed", measurements, manualScreenReader: "not_tested", physicalDevice: "not_tested" });
  } finally { await context?.close(); await rm(temporary, { recursive: true, force: true }); }
});
