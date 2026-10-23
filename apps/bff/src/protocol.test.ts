import { describe, expect, it } from "vitest";
import type { RunConfig } from "@playground/shared";
import { evaluateProtocol, protocolMetadata, safeFailure } from "./protocol.js";
import { unsupportedReason } from "./capabilities.js";
const config: RunConfig = { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", scenarioId: null, tamper: "expired" };
const summary = { diagnosticsVersion: 1, outcome: "invalid", failure: { boundary: "result", stage: "credential_time", code: "CREDENTIAL_EXPIRED" } };
describe("protocol reason evaluation", () => {
  it.each([
    ["invalid", summary, "correct_rejection"],
    ["valid", {}, "wrongly_accepted"],
    ["invalid", { ...summary, failure: { boundary: "result", stage: "issuer_signature", code: "ISSUER_SIGNATURE_INVALID" } }, "wrong_reason"],
    ["invalid", { ...summary, failure: { boundary: "direct_post", stage: "state", code: "INVALID_STATE" } }, "wrong_step"],
    ["invalid", {}, "inconclusive"],
    ["error", {}, "inconclusive"],
    [null, {}, "inconclusive"],
  ] as const)("classifies actual %s and diagnostic %#", (outcome, actual, verdict) => {
    expect(evaluateProtocol(config, "invalid", outcome, actual).verdict).toBe(verdict);
  });
  it("does not expose unknown diagnostic strings", () => {
    expect(safeFailure({ boundary: "result", code: "private-untrusted-text", stage: "nonce" })).toBeNull();
    expect(safeFailure({ boundary: "result", code: "NONCE_MISMATCH", stage: "issuer_signature" })).toBeNull();
  });
  it("reconstructs evaluation from persisted step JSON without a run-column migration", () => {
    const evaluation = evaluateProtocol(config, "invalid", "invalid", summary);
    const saved = JSON.parse(JSON.stringify([{ id: "step", runId: "run", seq: 10, stepKey: "REPORT", title: "Report", status: "succeeded", summary: { protocolEvaluation: evaluation, protocolProfile: "mock-sdjwt-flat-v1", issuerRepresentation: "did:jwk" } }]));
    expect(protocolMetadata(saved)).toEqual({ evaluation, protocolProfile: "mock-sdjwt-flat-v1", issuerRepresentation: "did:jwk" });
    expect(protocolMetadata([])).toEqual({});
  });
  it("rejects uncontrolled semantic faults and absent external test-mode support", () => {
    expect(unsupportedReason({ ...config, issuer: "inji_certify" }, "collab", {})).toContain("controlled");
    expect(unsupportedReason(config, "collab", { MOCK_ISSUER_BASE_URL: "http://issuer.test" })).toContain("ENABLE_TEST_CASES");
    expect(unsupportedReason(config, "collab", { MOCK_ISSUER_BASE_URL: "http://issuer.test", MOCK_ISSUER_ENABLE_TEST_CASES: "true" })).toBeNull();
    expect(unsupportedReason({ ...config, tamper: "missing_disclosure" }, "collab", {})).toBeNull();
  });
});
