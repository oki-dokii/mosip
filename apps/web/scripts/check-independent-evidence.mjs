import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";

const directory = new URL("../../../spikes/person2-web/evidence/independent/", import.meta.url);
const files = ["mobile-column-contrast.json", "browser-zoom.json"];
const keys = (object, allowed) => assert.deepEqual(Object.keys(object).sort(), [...allowed].sort());
for (const name of await readdir(directory)) assert([...files, "privacy-checks.json"].includes(name), "Only reviewed summary files are allowed");
const contrast = JSON.parse(await readFile(new URL(files[0], directory), "utf8"));
keys(contrast, ["source", "check", "viewportWidth", "checks", "result", "limitation"]);
assert.equal(contrast.source, "synthetic_playground_ui");
assert.equal(contrast.check, "automated_computed_colors_not_manual_screen_reader");
assert.equal(contrast.result, "passed"); assert.equal(contrast.viewportWidth, 320);
assert.equal(contrast.limitation, "CSS color measurement for the current opaque comparison tables; does not replace axe or human visual review.");
assert.equal(contrast.checks.length, 2);
for (const check of contrast.checks) {
  keys(check, ["region", "cellsMeasured", "minimumContrast", "allColumnsReachable"]);
  assert(["Run configuration comparison table", "Run step comparison table"].includes(check.region));
  assert(Number.isSafeInteger(check.cellsMeasured) && check.cellsMeasured > 0);
  assert(Number.isFinite(check.minimumContrast) && check.minimumContrast >= 4.5 && check.minimumContrast <= 21);
  assert.equal(check.allColumnsReachable, true);
}
const zoom = JSON.parse(await readFile(new URL(files[1], directory), "utf8"));
keys(zoom, ["source", "check", "browserVersion", "baseline", "result", "measurements", "manualScreenReader", "physicalDevice"]);
assert.equal(zoom.source, "isolated_synthetic_chromium");
assert.equal(zoom.check, "browser_tabs_setZoom_not_css_zoom_or_pinch");
assert.match(zoom.browserVersion, /^(?:[\d.]{1,64}|unreported)$/);
keys(zoom.baseline, ["width", "dpr"]);
assert(Number.isFinite(zoom.baseline.width) && zoom.baseline.width > 0 && Number.isFinite(zoom.baseline.dpr) && zoom.baseline.dpr > 0);
assert.equal(zoom.result, "passed"); assert.equal(zoom.manualScreenReader, "not_tested"); assert.equal(zoom.physicalDevice, "not_tested");
assert.deepEqual(zoom.measurements.map(m => m.factor), [2, 4]);
for (const check of zoom.measurements) {
  keys(check, ["factor", "observedZoom", "devicePixelRatio", "cssViewportWidth", "pageWidth", "filterAndKeyboardChecks"]);
  assert.equal(check.factor, check.observedZoom);
  assert(Math.abs(check.devicePixelRatio - zoom.baseline.dpr * check.factor) < 0.1);
  assert(Number.isFinite(check.cssViewportWidth) && check.cssViewportWidth > 0 && check.cssViewportWidth <= Math.ceil(zoom.baseline.width / check.factor) + 1);
  assert(Number.isFinite(check.pageWidth) && check.pageWidth <= check.cssViewportWidth + 1);
  assert.equal(check.filterAndKeyboardChecks, "passed");
}
await writeFile(new URL("privacy-checks.json", directory), JSON.stringify({ source: "independent_artifact_audit", result: "passed", check: "exact_metadata_keys_and_bounded_values", filesChecked: files.length, manualScreenReader: "not_tested", physicalDevice: "not_tested" }, null, 2) + "\n");
console.log("Independent evidence audit passed: only bounded contrast/zoom metadata; human checks remain not_tested.");
