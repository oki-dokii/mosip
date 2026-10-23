import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { evaluate, exitCode, safeObservation } from "./wallet-interop-evaluate.mjs";
import { validateCatalog, validateTarget, runProbes } from "./wallet-interop-probes.mjs";
const expected = { outcome: "invalid", boundary: "result", stage: "nonce", code: "NONCE_MISMATCH" };
const observation = { httpStatus: 200, boundary: "result", outcome: "invalid", diagnosticsVersion: 1, code: "NONCE_MISMATCH", stage: "nonce", controlPassed: true, constructionPassed: true };
for (const [name, delta, verdict] of [
  ["correct rejection", {}, "correct_rejection"],
  ["accepted invalid presentation", { outcome: "valid", code: null, stage: null }, "wrongly_accepted"],
  ["wrong HTTP boundary", { boundary: "direct_post", httpStatus: 400 }, "wrong_step"],
  ["wrong rejection reason", { stage: "issuer_signature", code: "ISSUER_SIGNATURE_INVALID" }, "wrong_reason"],
  ["failed control", { controlPassed: false }, "inconclusive"],
  ["failed construction", { constructionPassed: false }, "inconclusive"],
  ["HTTP failure", { httpStatus: 500 }, "inconclusive"],
  ["missing status", { httpStatus: null }, "inconclusive"],
  ["missing verdict", { outcome: null }, "inconclusive"],
  ["unknown code", { code: "invalid_request" }, "inconclusive"],
  ["unknown diagnostics", { diagnosticsVersion: 2 }, "inconclusive"],
  ["timeout", { error: "timeout" }, "inconclusive"],
  ["malformed body", { error: "malformed_result" }, "inconclusive"],
  ["inconsistent stage", { stage: "issuer_signature" }, "inconclusive"],
]) test(name, () => assert.equal(evaluate(expected, { ...observation, ...delta }), verdict));
test("positive controls have explicit verdicts", () => {
  assert.equal(evaluate({ outcome: "valid", boundary: "result" }, { ...observation, outcome: "valid" }), "correct_acceptance");
  assert.equal(evaluate({ outcome: "valid", boundary: "result" }, observation), "unexpected_rejection");
  assert.equal(evaluate(expected, { ...observation, outcome: "valid", boundary: "direct_post" }), "inconclusive");
});
test("inconclusive takes precedence in mixed exit codes", () => {
  assert.equal(exitCode([]), 2);
  assert.equal(exitCode([{ verdict: "correct_rejection" }, { verdict: "correct_acceptance" }]), 0);
  assert.equal(exitCode([{ verdict: "wrongly_accepted" }]), 1);
  assert.equal(exitCode([{ verdict: "wrongly_accepted" }, { verdict: "inconclusive" }]), 2);
});
test("export projection cannot serialize arbitrary upstream values", () => {
  const unsafe = { ...observation, code: "arbitrary-sensitive-value", raw: "must-be-discarded", stage: "unknown", error: new Error("hidden-error-text") };
  const safe = safeObservation(unsafe), text = JSON.stringify(safe);
  assert.equal(safe.code, null); assert.equal(safe.error, "transport");
  assert.equal(text.includes("arbitrary-sensitive-value"), false); assert.equal(text.includes("must-be-discarded"), false); assert.equal(text.includes("hidden-error-text"), false);
});
test("targets require explicit loopback HTTP origins", () => {
  assert.equal(validateTarget("http://127.0.0.1:4101"), "http://127.0.0.1:4101");
  for (const target of ["https://example.com", "http://example.com", "http://localhost/path", "http://user@localhost", "http://localhost/?query=1"]) assert.throws(() => validateTarget(target));
});
test("catalog rejects duplicate cases and unsupported expectations", async () => {
  const catalog = JSON.parse(await readFile(new URL("./wallet-interop-cases.json", import.meta.url), "utf8"));
  assert.equal(validateCatalog(catalog).cases.length, 12);
  const changed = structuredClone(catalog); changed.cases[1] = changed.cases[0]; assert.throws(() => validateCatalog(changed));
  const wrong = structuredClone(catalog); wrong.cases[0].expected.code = "unknown"; assert.throws(() => validateCatalog(wrong));
});
test("transport failures retain every case as inconclusive", async () => {
  const catalog = JSON.parse(await readFile(new URL("./wallet-interop-cases.json", import.meta.url), "utf8"));
  const results = await runProbes({ issuer: "http://127.0.0.1:1", verifier: "http://127.0.0.1:1", catalog, caseTimeoutMs: 1 });
  assert.equal(results.length, 12); assert.equal(results.every((item) => item.verdict === "inconclusive"), true); assert.equal(exitCode(results), 2);
  assert.equal(JSON.stringify(results).includes("stack"), false);
});
test("local launcher refuses stale success evidence without starting services", async () => {
  const directory = await mkdtemp(join(tmpdir(), "person3-stale-artifact-"));
  try {
    const out = join(directory, "result.json"), original = JSON.stringify({ exitCode: 0 });
    await writeFile(out, original);
    await assert.rejects(promisify(execFile)(process.execPath, [fileURLToPath(new URL("./wallet-interop-local.mjs", import.meta.url)), "--out", out], { timeout: 5000 }), (error) => error.code === 2);
    assert.equal(await readFile(out, "utf8"), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
