import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "./jsonld-interop-probes.mjs";

test("JSON-LD negative protocol suite with positive controls executes all nine cases", async () => {
  const results = await runProbes();

  assert.equal(results.length, 9, "Expected exactly nine JSON-LD test cases");

  const byId = new Map(results.map((r) => [r.caseId, r]));

  // 1. Positive control
  const control = byId.get("j1.control.valid");
  assert.ok(control, "Missing j1.control.valid");
  assert.equal(control.observed.outcome, "valid");
  assert.equal(control.verdict, "correct_acceptance");

  // Every negative test must be paired with positive control verification
  for (const r of results) {
    assert.equal(r.control.passed, true, `Positive control failed for case ${r.caseId}`);
  }

  // 2. Corrupted signature proof value
  const badProof = byId.get("j1.signature.corrupted");
  assert.ok(badProof, "Missing j1.signature.corrupted");
  assert.equal(badProof.observed.outcome, "invalid");
  assert.equal(badProof.observed.code, "PROOF_VALUE_INVALID");
  assert.equal(badProof.verdict, "correct_rejection");

  // 3. Expired credential
  const expired = byId.get("j1.credential.expired");
  assert.ok(expired, "Missing j1.credential.expired");
  assert.equal(expired.observed.outcome, "invalid");
  assert.equal(expired.observed.code, "CREDENTIAL_EXPIRED");
  assert.equal(expired.verdict, "correct_rejection");

  // 4. Wrong credential type
  const wrongType = byId.get("j1.credential.wrong_type");
  assert.ok(wrongType, "Missing j1.credential.wrong_type");
  assert.equal(wrongType.observed.outcome, "invalid");
  assert.equal(wrongType.observed.code, "CREDENTIAL_TYPE_MISMATCH");
  assert.equal(wrongType.verdict, "correct_rejection");

  // 5. Altered claim
  const altered = byId.get("j1.document.altered_claim");
  assert.ok(altered, "Missing j1.document.altered_claim");
  assert.equal(altered.observed.outcome, "invalid");
  assert.equal(altered.observed.code, "SIGNATURE_CORRUPTED");
  assert.equal(altered.verdict, "correct_rejection");

  // 6. Untrusted verification method
  const forged = byId.get("j1.key.untrusted_method");
  assert.ok(forged, "Missing j1.key.untrusted_method");
  assert.equal(forged.observed.outcome, "invalid");
  assert.equal(forged.observed.code, "UNTRUSTED_KEY");
  assert.equal(forged.verdict, "correct_rejection");
});
