import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { a, b, canary, fixtures, run } from "./fixtures/recordedRuns";

const require = createRequire(import.meta.url);
const evidence = new URL("../../../spikes/person2-web/evidence/phase4/", import.meta.url);
async function audit(page: Page, state: string) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }>; incomplete: Array<{ id: string; nodes: Array<{ target: string[]; any: Array<{ message: string }> }> }>; passes: Array<{ id: string }> }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } });
    return { violations: result.violations.map(v => ({ rule: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.map(n => n.target) })), incomplete: result.incomplete.map(v => ({ rule: v.id, targets: v.nodes.map(n => n.target), reasons: v.nodes.flatMap(n => n.any.map(check => check.message)) })), passes: result.passes.length };
  });
  // No DOM, account information, request/response payloads or axe node HTML saved.
  await mkdir(evidence, { recursive: true });
  await writeFile(new URL(`${state}.json`, evidence), JSON.stringify({ source: "synthetic_playground_ui", check: "automated_axe_not_manual_screen_reader", state, ...result }, null, 2) + "\n");
  expect(result.violations, state).toEqual([]);
  await expect(page.locator("body")).not.toContainText(canary);
}
async function configureFixture(page: Page) {
  await page.getByRole("button", { name: "W3C VC JSON-LD" }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Inji Web/ }) }).click();
  await page.getByRole("button", { name: "Start assisted fixture run" }).click();
  return page.getByRole("region", { name: "Assisted Inji Web fixture journey" });
}

test("initial view, comparison, matrix and inspector: axe, accessibility tree, keyboard and small screens", async ({ page }) => {
  await fixtures(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const issuer = page.getByRole("radio", { name: /Inji Certify/ });
  await issuer.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /Mock Issuer/i })).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(issuer).toBeChecked();
  expect(await issuer.evaluate(el => getComputedStyle(el).outlineWidth)).toBe("3px");
  await audit(page, "initial");
  await page.getByLabel("Compare run A").selectOption(a);
  await page.getByLabel("Compare run B").selectOption(b);
  const comparison = page.getByRole("region", { name: "Run comparison", exact: true });
  await expect(comparison).toContainText("Comparison ready.");
  await page.getByRole("button", { name: "Open run 11111111" }).focus();
  await page.keyboard.press("Enter");
  const runHeading = page.getByRole("heading", { name: "Run 11111111", exact: true });
  await expect(runHeading).toBeFocused();
  await expect(page.getByRole("article", { name: "Protocol message inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Import synthetic capture", exact: true }).click();
  await expect(page.getByRole("region", { name: "Browser capture coverage" }).getByRole("status")).toContainText("Choose a synthetic capture JSON file first.");
  const step = page.getByRole("list", { name: "Protocol steps" }).getByRole("button").first();
  await step.focus(); await page.keyboard.press("Enter");
  await expect(step).toHaveAttribute("aria-pressed", "true");
  const detail = page.getByText("Projected structure details", { exact: true }).first();
  await detail.focus(); await page.keyboard.press("Enter");
  await expect(detail.locator("..")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Copy Mermaid", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Mermaid source copied|Copy unavailable/ })).toBeVisible();
  await page.getByRole("button", { name: "Latest matrix", exact: true }).click();
  await expect(page.getByRole("button", { name: "Latest matrix", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Supported combinations" })).toBeVisible();
  const tree = await page.getByRole("main").ariaSnapshot();
  expect(tree).toContain('region "Run comparison"');
  expect(tree).toContain('combobox "Filter wallet"');
  expect(tree).toContain('region "Recorded runs table"');
  expect(tree).not.toMatch(/PRIVATE_PHASE3_CANARY|secret_name/);
  await audit(page, "recorded-matrix-comparison");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflow at ${width}`).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  const table = page.getByRole("region", { name: "Recorded runs table" });
  await table.focus(); await page.keyboard.press("ArrowRight");
  await expect(table).toBeFocused();
  await expect.poll(() => table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.getByLabel("Filter status").selectOption("failed");
  await expect(page.getByText("No runs match these filters.")).toBeVisible();
  await audit(page, "filtered-empty-mobile");
  await page.goBack();
  await expect(page.getByLabel("Filter status")).toHaveValue("");
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Open run 11111111" })).toBeFocused();
  await writeFile(new URL("navigation-checks.json", evidence), JSON.stringify({ source: "synthetic_playground_ui", check: "automated_keyboard_and_accessibility_tree_not_manual_screen_reader", result: "passed", assertions: ["skip link", "radio arrow keys", "3px focus outline", "run heading focus", "step pressed state", "details keyboard toggle", "clipboard feedback", "matrix pressed state", "named regions in accessibility tree", "no page overflow at 320/390/768/1440", "keyboard horizontal table scroll", "URL back navigation", "no private value or withheld name in tree"] }, null, 2) + "\n");
});

test("assisted fixture checkpoints, focus recovery, terminal states and reduced motion", async ({ page }) => {
  await fixtures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  let panel = await configureFixture(page);
  await audit(page, "assisted-issuance");
  const issue = panel.getByRole("button", { name: "Simulate issuance observation" });
  await issue.focus(); await page.keyboard.press("Enter");
  await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
  await audit(page, "assisted-storage");
  await panel.getByRole("button", { name: "Simulate wallet storage confirmation" }).click();
  await audit(page, "assisted-presentation");
  await panel.getByRole("button", { name: "Simulate presentation observation" }).click();
  await audit(page, "assisted-result-wait");
  await panel.getByRole("button", { name: "Simulate valid verifier result" }).focus(); await page.keyboard.press("Enter");
  await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(panel.getByRole("status")).toContainText("Simulated verifier result: valid");
  await audit(page, "assisted-complete");
  await page.getByRole("button", { name: "Start assisted fixture run" }).click();
  panel = page.getByRole("region", { name: "Assisted Inji Web fixture journey" });
  await panel.getByRole("button", { name: "Cancel assisted run" }).focus(); await page.keyboard.press("Enter");
  await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
  await audit(page, "assisted-cancelled");
  await page.getByRole("button", { name: "Start assisted fixture run" }).click();
  await panel.getByRole("button", { name: "Simulate observation error" }).click();
  await audit(page, "assisted-error");
  await page.clock.install();
  await page.getByRole("button", { name: "Start assisted fixture run" }).click();
  await panel.getByRole("button", { name: "Cancel assisted run" }).focus();
  await page.clock.runFor(60_100);
  await expect(panel.getByRole("status")).toContainText("Verification was not established");
  await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
  await audit(page, "assisted-timeout");
  const card = page.locator(".transition").first();
  await card.hover();
  const style = await card.evaluate(el => ({ transition: getComputedStyle(el).transitionDuration, transform: getComputedStyle(el).transform }));
  expect(style.transition).toBe("0s"); expect(style.transform).toBe("none");
  await page.clock.resume();
  await writeFile(new URL("focus-motion-checks.json", evidence), JSON.stringify({ source: "synthetic_playground_ui", check: "automated_keyboard_not_manual_screen_reader", result: "passed", assertions: ["focus recovered after issuance and completion", "focus recovered after cancellation and timeout", "reduced-motion transition disabled", "reduced-motion hover translation disabled"] }, null, 2) + "\n");
});

test("all recorded run outcomes announce status without changing evidence meaning", async ({ page }) => {
  await fixtures(page);
  for (const status of ["pending", "running", "passed", "failed", "errored", "cancelled"] as const) {
    await page.route(`**/api/v1/runs/${a}`, route => route.fulfill({ json: { ...run(a), status, actualOutcome: status === "passed" ? "valid" : status === "failed" ? "invalid" : status === "errored" ? "error" : null } }));
    await page.goto(`/?run=${a}`);
    await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /Run in progress|expected result matched|Mismatch|flow could not complete|Cancelled —/ })).toBeVisible();
    await audit(page, `run-${status}`);
  }
});

test("loading and failed configuration and matrix requests are announced", async ({ page }) => {
  await fixtures(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/meta/implementations", async route => { await gate; await route.fulfill({ status: 503, body: "unavailable" }); });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Loading playground");
  await audit(page, "configuration-loading");
  release();
  await expect(page.getByRole("alert")).toContainText("Playground configuration unavailable");
  await audit(page, "configuration-error");
  await page.unroute("**/api/v1/meta/implementations");
  let releaseMatrix!: () => void;
  const matrixGate = new Promise<void>(resolve => { releaseMatrix = resolve; });
  await page.route("**/api/v1/matrix/cells", async route => { await matrixGate; await route.fulfill({ status: 503, body: "unavailable" }); });
  await page.goto("/");
  await page.getByRole("button", { name: "Latest matrix", exact: true }).click();
  await expect(page.getByRole("region", { name: "Supported combinations" }).getByRole("status")).toContainText("Loading supported combinations");
  await audit(page, "matrix-loading");
  releaseMatrix();
  await expect(page.getByRole("region", { name: "Supported combinations" }).getByRole("alert")).toContainText("Matrix contract unavailable");
  await audit(page, "matrix-error");
});

test("connected assisted waiting and terminal states retain accessible instructions and provenance", async ({ page }) => {
  await fixtures(page);
  const phases = [
    ["issuance", "running", "ISSUE_CREDENTIAL", null], ["storage", "running", "STORE", null],
    ["presentation", "running", "PRESENT_SUBMIT", null], ["result", "running", "PRESENT_RESULT", null],
    ["complete", "passed", "PRESENT_RESULT", "valid"], ["cancelled", "cancelled", "PRESENT_RESULT", null],
    ["timeout", "errored", "PRESENT_RESULT", "error"], ["error", "errored", "PRESENT_RESULT", "error"],
  ] as const;
  for (const [phase, status, stepKey, actualOutcome] of phases) {
    const record = { ...run(a), config: { ...run(a).config, wallet: "inji_web_assisted", format: "ldp_vc" }, status, actualOutcome };
    const steps = [{ id: "synthetic-step", runId: a, seq: 1, stepKey, title: stepKey, status: status === "running" ? "running" : status === "passed" ? "succeeded" : "failed", summary: phase === "timeout" ? { error: "ASSISTED_TIMEOUT" } : phase === "error" ? { error: "ASSISTED_OBSERVATION_ERROR" } : null }];
    await page.route(`**/api/v1/runs/${a}`, route => route.fulfill({ json: record }));
    await page.route(`**/api/v1/runs/${a}/steps`, route => route.fulfill({ json: { items: steps } }));
    await page.route(`**/api/v1/assisted/runs/${a}`, route => route.fulfill({ json: { run: record, steps, actions: {}, deadlineAt: status === "running" ? Date.now() + 60_000 : null } }));
    await page.goto(`/?run=${a}`);
    const panel = page.getByRole("region", { name: "Connected assisted journey" });
    await expect(panel.getByRole("status")).toContainText(status === "running" ? `Waiting: ${stepKey}` : `Verifier outcome: ${actualOutcome ?? "not established"}`);
    await expect(panel).toContainText("Fixture simulation");
    await audit(page, `connected-${phase}`);
  }
});

test("denied comparison and archive errors have named controls and accessible announcements", async ({ page }) => {
  await fixtures(page, { denyB: true });
  await page.goto(`/?run=${b}&compareA=${a}&compareB=${b}`);
  await expect(page.getByRole("region", { name: "Run comparison", exact: true }).getByRole("alert")).toContainText("Comparison unavailable");
  await audit(page, "denied-run-comparison");
  await page.route("**/api/v1/runs", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.route("**/api/v1/wallet-evidence", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Retry archive" })).toBeVisible();
  await audit(page, "archive-wallet-errors");
});
