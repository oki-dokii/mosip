import { afterEach, describe, expect, it, vi } from "vitest";
import type { DriverContext } from "./types.js";
import { createCollabDrivers } from "./collab.js";
const valid = { outcome: "valid", diagnosticsVersion: 1, issuerSignatureValid: true, holderProofValid: true, certificateTrustChecked: false };
function context(verifier: "mock_verifier" | "inji_verify" = "mock_verifier"): DriverContext {
  return { config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier, format: "vc_sd_jwt", flow: "cross_device", tamper: "expired", scenarioId: null }, state: new Map<string, unknown>([
    ["collab.mockVerifierRequestId", "request"], ["collab.verifyTransactionId", "transaction"],
    ["collab.config", { verifyBaseUrl: "https://verify.example", credentialConfigurationId: "MockVerifiableCredential_SD_JWT", credentialFormat: "dc+sd-jwt", clientId: "test-client" }],
  ]) };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.MOCK_VERIFIER_BASE_URL; delete process.env.VERIFY_POLL_INTERVAL_MS; delete process.env.VERIFY_POLL_TIMEOUT_MS; });
describe("verifier transport and result contract", () => {
  it("polls 202 until an explicit verified result", async () => {
    process.env.MOCK_VERIFIER_BASE_URL = "https://mock.example"; process.env.VERIFY_POLL_INTERVAL_MS = "0";
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ status: "VERIFYING" }, 202)).mockResolvedValueOnce(response(valid)); vi.stubGlobal("fetch", fetchMock);
    const run = context(), result = await createCollabDrivers(run.config).verifier.getResult(run);
    expect(result.summary?.outcome).toBe("valid"); expect(result.exchanges).toHaveLength(2); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("polls pending submission status without treating it as a final result", async () => {
    process.env.MOCK_VERIFIER_BASE_URL = "https://mock.example"; process.env.VERIFY_POLL_INTERVAL_MS = "0";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ status: "PENDING" })).mockResolvedValueOnce(response({ status: "VP_SUBMITTED" })));
    const run = context(), result = await createCollabDrivers(run.config).verifier.pollStatus(run);
    expect(result.summary?.status).toBe("VP_SUBMITTED"); expect(result.exchanges).toHaveLength(2);
  });
  it.each([
    [500, { outcome: "invalid", diagnosticsVersion: 1, failure: { boundary: "result", stage: "credential_time", code: "CREDENTIAL_EXPIRED" } }],
    [404, { error: "not_submitted" }],
    [200, {}], [200, { outcome: "pending" }],
    [200, { outcome: "valid", diagnosticsVersion: 1 }],
    [200, { outcome: "invalid", diagnosticsVersion: 1, failure: { boundary: "result", code: "unknown-sensitive-text", stage: "nonce" } }],
  ] as const)("classifies HTTP %s / malformed result as execution error %#", async (status, body) => {
    process.env.MOCK_VERIFIER_BASE_URL = "https://mock.example"; vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body, status)));
    const run = context(), result = await createCollabDrivers(run.config).verifier.getResult(run);
    expect(result.summary?.outcome).toBe("error"); expect(JSON.stringify(result).includes("unknown-sensitive-text")).toBe(false);
  });
  it("bounds a result that remains pending", async () => {
    process.env.MOCK_VERIFIER_BASE_URL = "https://mock.example"; process.env.VERIFY_POLL_TIMEOUT_MS = "0";
    const fetchMock = vi.fn().mockResolvedValue(response({ status: "VERIFYING" }, 202)); vi.stubGlobal("fetch", fetchMock);
    const run = context(), result = await createCollabDrivers(run.config).verifier.getResult(run);
    expect(result.summary?.error).toBe("VERIFIER_RESULT_TIMEOUT"); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([500, 404, 400])("never converts a Collab HTTP %s result lookup failure into invalid", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ allChecksSuccessful: false, errorMessage: "must-not-be-exported" }, status)));
    const run = context("inji_verify"), result = await createCollabDrivers(run.config).verifier.getResult(run);
    expect(result.summary?.outcome).toBe("error"); expect(JSON.stringify(result).includes("must-not-be-exported")).toBe(false);
  });
});
