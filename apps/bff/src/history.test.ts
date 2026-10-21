import { describe, expect, it } from "vitest";
import type { RunSummary } from "@playground/shared";
import { filterRuns } from "./history.js";
import { unsupportedReason } from "./capabilities.js";

const base: RunSummary = {
  id: "one", parentRunId: null, config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: null },
  status: "passed", expectedOutcome: "valid", actualOutcome: "valid", proofType: "kb+jwt", algorithm: "EdDSA",
  serviceVersions: { issuer: "1.0.0", wallet: "reference-wallet/0.1.0", verifier: "2.0.0" },
  createdAt: "2026-10-21T00:00:00Z", startedAt: null, finishedAt: null,
};

describe("Phase 3 history and capabilities", () => {
  it("filters history by role, format, outcome, and fault", () => {
    const failed: RunSummary = { ...base, id: "two", status: "failed", config: { ...base.config, issuer: "mock_issuer", tamper: "expired" } };
    expect(filterRuns([base, failed], { issuer: "mock_issuer", status: "failed", tamper: "expired", format: "vc_sd_jwt" }).map((item) => item.id)).toEqual(["two"]);
    expect(filterRuns([base, { ...failed, serviceVersions: { ...base.serviceVersions!, issuer: "2.0.0" } }], { issuerVersion: "2.0.0" }).map((item) => item.id)).toEqual(["two"]);
  });

  it("rejects unsupported live role and format combinations before run creation", () => {
    expect(unsupportedReason({ ...base.config, wallet: "inji_web_assisted" }, "collab")).toContain("Reference Wallet");
    expect(unsupportedReason({ ...base.config, issuer: "mock_issuer", format: "ldp_vc" }, "collab")).toContain("SD-JWT");
    expect(unsupportedReason({ ...base.config, verifier: "mock_verifier" }, "collab")).toBeNull();
    expect(unsupportedReason({ ...base.config, verifier: "mock_verifier", tamper: "missing_disclosure" }, "collab")).toContain("required-disclosure");
  });
});
