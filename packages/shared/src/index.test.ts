import { describe, expect, it } from "vitest";
import { evidenceTier, runConfigSchema, type RunSummary } from "./index.js";

describe("runConfigSchema", () => {
  it("applies safe walking-skeleton defaults", () => {
    const config = runConfigSchema.parse({
      issuer: "inji_certify",
      wallet: "reference_wallet",
      verifier: "inji_verify",
      format: "vc_sd_jwt",
    });

    expect(config.flow).toBe("cross_device");
    expect(config.tamper).toBeNull();
    expect(config.scenarioId).toBeNull();
  });

  it("accepts the supported negative-path faults", () => {
    for (const tamper of ["expired", "bad_signature", "wrong_type", "missing_disclosure", "replay_nonce"] as const) {
      expect(runConfigSchema.parse({
        issuer: "inji_certify",
        wallet: "reference_wallet",
        verifier: "inji_verify",
        format: "vc_sd_jwt",
        tamper,
      }).tamper).toBe(tamper);
    }
  });
});

describe("evidence tiers", () => {
  const base: RunSummary = {
    id: "run", parentRunId: null,
    config: runConfigSchema.parse({ issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt" }),
    status: "passed", expectedOutcome: "valid", actualOutcome: "valid", proofType: "kb+jwt", algorithm: "EdDSA",
    createdAt: "2026-10-21T00:00:00Z", startedAt: null, finishedAt: null,
  };
  it("does not promote simulated or reference-wallet runs to real Inji-wallet evidence", () => {
    expect(evidenceTier({ ...base, serviceVersions: { issuer: "fixture/1", wallet: "fixture/1", verifier: "fixture/1" } })).toBe("fixture");
    expect(evidenceTier({ ...base, serviceVersions: { issuer: "unreported", wallet: "reference-wallet/0.1", verifier: "unreported" } })).toBe("reference_wallet");
    expect(evidenceTier({ ...base, config: { ...base.config, issuer: "mock_issuer" }, serviceVersions: { issuer: "mock/1", wallet: "reference-wallet/0.1", verifier: "unreported" } })).toBe("mock_interop");
    expect(evidenceTier({ ...base, config: { ...base.config, wallet: "inji_web_assisted" }, serviceVersions: { issuer: "unreported", wallet: "inji-web/1", verifier: "unreported" } })).toBe("unverified");
  });
});
