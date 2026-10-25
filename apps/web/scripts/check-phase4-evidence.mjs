import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";

const directory = new URL("../../../spikes/person2-web/evidence/phase4/", import.meta.url);
const allowedKeys = new Set(["source", "check", "state", "violations", "incomplete", "passes", "result", "assertions", "ports", "dockerDaemonSocketPresent", "externalSyntheticPasscodeFilePresent", "liveWalletAcceptance"]);
const unsafe = /PRIVATE_PHASE3_CANARY|secret_name|credentialSubject|request_uri|vp_token|access_token|refresh_token|BEGIN (?:RSA |EC )?PRIVATE KEY|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;
let files = 0;
let axeSnapshots = 0;
let incompleteSnapshots = 0;
for (const name of await readdir(directory)) {
  assert.match(name, /^[a-z][a-z0-9-]*\.json$/, "Only named JSON summaries belong in Phase 4 evidence");
  if (name === "privacy-checks.json") continue;
  const text = await readFile(new URL(name, directory), "utf8");
  assert(text.length <= 32_768 && !unsafe.test(text), "Artifact boundary rejected; do not publish this evidence");
  const report = JSON.parse(text);
  assert(Object.keys(report).every(key => allowedKeys.has(key)), "Unrecognized artifact fields");
  assert(["synthetic_playground_ui", "local_dependency_probe"].includes(report.source));
  if (report.state) assert.match(report.state, /^[a-z][a-z0-9-]{1,63}$/);
  if (report.source === "synthetic_playground_ui") {
    assert.match(report.check, /^automated_(?:axe|keyboard|keyboard_and_accessibility_tree)_not_manual_screen_reader$/);
    if (report.violations) {
      assert(Array.isArray(report.violations) && Array.isArray(report.incomplete));
      assert(Number.isSafeInteger(report.passes) && report.passes >= 0);
      axeSnapshots++;
      if (report.incomplete.length) incompleteSnapshots++;
    }
  } else {
    assert(Array.isArray(report.ports) && report.ports.every(p => Number.isInteger(p.port) && typeof p.reachable === "boolean"));
    assert.equal(typeof report.externalSyntheticPasscodeFilePresent, "boolean");
  }
  files++;
}
assert(axeSnapshots > 0, "Generate the synthetic browser evidence first");
await writeFile(new URL("privacy-checks.json", directory), JSON.stringify({ source: "artifact_boundary_audit", check: "automated_metadata_allowlist_and_canary_scan", result: "passed", sourceReportsChecked: files, axeSnapshots, incompleteSnapshots, manualScreenReader: "not_tested" }, null, 2) + "\n");
console.log(`Phase 4 artifact boundary passed: ${files} source reports checked, ${axeSnapshots} axe snapshots; ${incompleteSnapshots} retain incomplete checks.`);
