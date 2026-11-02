import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareEvidence, diffShapes, issueDraft, readCommitted, shapeOf } from "./evidence-tools.mjs";
import { scanText } from "./audit-secrets.mjs";

const validPath = "submission/evidence/2026-10-21-mock-x509-valid.json";
const invalidPath = "submission/evidence/2026-10-21-mock-x509-bad-signature.json";
const contractPath = "spikes/fixtures/collab-contracts-2026-10-20.json";
const fixture = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

test("shape diff lists added, removed and changed fields without scalar values", () => {
  const diff = diffShapes({ nonce: "CANARY_BEFORE", credential: { type: ["CANARY_TYPE"] }, status: 200 },
    { nonce: "CANARY_AFTER", vp_token: "CANARY_TOKEN", status: "CANARY_STATUS" });
  assert.deepEqual(diff.changes.find((c) => c.path === "$.status"), { path: "$.status", change: "changed", before: ["number"], after: ["string"] });
  assert.equal(diff.changes.find((c) => c.path === "$.credential")?.change, "removed");
  assert.equal(diff.changes.find((c) => c.path === "$.vp_token")?.change, "added");
  assert.equal(diff.changes.some((c) => c.path === "$.nonce"), false);
  assert.equal(JSON.stringify(diff).includes("CANARY_"), false);
});

test("array unions ignore value/order changes; hostile names and bounded input never escape", () => {
  assert.deepEqual(diffShapes({ credentials: [1, "x", null] }, { credentials: [null, "y", 2] }).changes, []);
  assert.equal(JSON.stringify(shapeOf({ "CANARY_KEY": "CANARY_VALUE", "```\n# CANARY_MARKDOWN": true })).includes("CANARY"), false);
  let deep = { nonce: "CANARY_DEEP" };
  for (let i = 0; i < 100; i++) deep = { credential: deep };
  assert.equal(shapeOf(deep).truncated, true);
  assert.equal(shapeOf(Array.from({ length: 129 }, () => null)).truncated, true);
  const cycle = {}; cycle.self = cycle;
  assert.equal(shapeOf(cycle).truncated, true);
});

test("compares October 21 runs by exchange role, ignoring volatile IDs, timing and secrets", () => {
  const before = fixture(validPath), after = fixture(invalidPath);
  const diff = compareEvidence(before, after);
  assert.equal(diff.kind, "run_exchange_shapes");
  assert.deepEqual(diff.exchanges.map((e) => ({ slot: e.slot, request: e.request.changes, response: e.response.changes })), [
    { slot: "PRESENT_RESULT/playground/inji_verify/POST/1", request: [], response: [{ path: "$.holderProofValid", change: "removed", before: ["boolean"], after: [] }] },
    { slot: "PRESENT_SUBMIT/reference_wallet/inji_verify/POST/1", request: [{ path: "$.tamper", change: "changed", before: ["null"], after: ["string"] }], response: [] },
  ]);
  assert.deepEqual(compareEvidence(before, structuredClone(before)).exchanges, []);
  const changed = structuredClone(before);
  changed.exchanges[0].response.nonce = "CANARY_NEW_FIELD";
  changed.exchanges[0].request.credential = 42;
  changed.exchanges[0].id = "CANARY_VOLATILE_ID";
  const added = compareEvidence(before, changed);
  assert.equal(added.exchanges.length, 1);
  assert.equal(added.exchanges[0].response.changes[0].path, "$.nonce");
  assert.equal(added.exchanges[0].request.changes[0].path, "$.credential");
  assert.equal(JSON.stringify(added).includes("CANARY_"), false);
  changed.exchanges.pop();
  assert.ok(compareEvidence(before, changed).exchanges.some((e) => e.change === "removed"));
});

test("contract fixture shape comparison reports a changed field without inventing run evidence", () => {
  const original = fixture(contractPath), changed = structuredClone(original);
  changed.certify.observed.tokenStatus = "CANARY_STATUS";
  delete changed.certify.noncePath;
  changed.certify.observed.errorCode = "CANARY_ERROR";
  const diff = compareEvidence(original, changed);
  assert.equal(diff.kind, "document_shapes");
  assert.deepEqual(diff.changes.map((c) => [c.path, c.change]), [
    ["$.certify.noncePath", "removed"], ["$.certify.observed.errorCode", "added"], ["$.certify.observed.tokenStatus", "changed"],
  ]);
  assert.throws(() => compareEvidence(original, fixture(validPath)), /KIND_MISMATCH/);
});

test("draft contains observed versions, steps, expected/actual and shapes but no untrusted prose", () => {
  const run = fixture(invalidPath);
  run.exchanges[0].request = { vp_token: "CANARY_TOKEN", credential: { credentialSubject: { name: "CANARY_NAME" } }, "CANARY_KEY": "CANARY_VALUE" };
  run.exchanges[0].url = "https://example.com/CANARY_URL";
  run.steps[0].title = "CANARY_TITLE";
  run.steps[0].summary = { message: "CANARY_SUMMARY" };
  run.run.serviceVersions.issuer = "CANARY_VERSION";
  run.run.id = "CANARY_ID";
  const draft = issueDraft(run);
  assert.match(draft, /Expected: invalid; actual: invalid/);
  assert.match(draft, /reference-wallet\/0.1.0/);
  assert.match(draft, /ISSUE_CREDENTIAL/);
  assert.match(draft, /\$\.vp_token/);
  assert.match(draft, /Private interoperability finding draft/);
  assert.equal(draft.includes("CANARY_"), false);
  assert.deepEqual(scanText(draft), []);
});

test("committed source loader rejects traversal, arbitrary paths and missing files with no fallback", () => {
  const loaded = readCommitted(validPath);
  assert.equal(loaded.doc.run.id, fixture(validPath).run.id);
  assert.match(loaded.provenance.commit, /^[0-9a-f]{40}$/);
  for (const path of ["/etc/passwd", "submission/evidence/../../package.json", "package.json", "submission/evidence/missing.json"]) assert.throws(() => readCommitted(path));
});

test("CLI generates new owner-only artifacts from committed runs and never overwrites", () => {
  const dir = mkdtempSync(join(tmpdir(), "evidence-cli-"));
  try {
    const script = fileURLToPath(new URL("./evidence-tools.mjs", import.meta.url));
    const drift = join(dir, "diff.json"), issue = join(dir, "issue.md");
    assert.match(execFileSync(process.execPath, [script, "drift", validPath, invalidPath, drift], { timeout: 5000 }).toString(), /EVIDENCE_EXPORT_SAVED/);
    execFileSync(process.execPath, [script, "issue", invalidPath, issue], { timeout: 5000 });
    const report = JSON.parse(readFileSync(drift, "utf8"));
    assert.equal(report.sources.length, 2);
    assert.deepEqual(scanText(readFileSync(issue, "utf8")), []);
    if (process.platform !== "win32") assert.equal(statSync(issue).mode & 0o777, 0o600);
    const previous = readFileSync(issue, "utf8");
    const result = spawnSync(process.execPath, [script, "issue", invalidPath, issue], { timeout: 5000, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^EVIDENCE_EXPORT_FAILED:/);
    assert.equal(readFileSync(issue, "utf8"), previous);
    const missing = join(dir, "missing.md");
    const bad = spawnSync(process.execPath, [script, "issue", "submission/evidence/CANARY_MISSING.json", missing], { timeout: 5000, encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.equal(bad.stderr.includes("CANARY_"), false);
    assert.equal(existsSync(missing), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
