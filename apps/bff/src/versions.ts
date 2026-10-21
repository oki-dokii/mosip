import type { RunConfig, RunSummary } from "@playground/shared";
import type { DriverMode } from "./drivers/registry.js";

function safeLabel(value: string | undefined) {
  return value && /^[A-Za-z0-9._+-]{1,64}$/.test(value) ? value : "unreported";
}

export function snapshotVersions(config: RunConfig, mode: DriverMode): NonNullable<RunSummary["serviceVersions"]> {
  if (mode === "fixture") return { issuer: "fixture/1", wallet: "fixture/1", verifier: "fixture/1" };
  return {
    issuer: config.issuer === "mock_issuer"
      ? process.env.MOCK_ISSUER_BASE_URL ? safeLabel(process.env.MOCK_ISSUER_VERSION_LABEL) : "local-mock/did-jwk-1"
      : safeLabel(process.env.CERTIFY_VERSION_LABEL),
    wallet: "reference-wallet/0.1.0",
    verifier: config.verifier === "mock_verifier" ? "local-mock/1" : safeLabel(process.env.VERIFY_VERSION_LABEL),
  };
}
