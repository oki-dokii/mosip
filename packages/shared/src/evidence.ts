import type { RunSummary } from "./index.js";

export type EvidenceTier = "fixture" | "mock_interop" | "reference_wallet" | "unverified";

export function evidenceTier(run: RunSummary): EvidenceTier {
  const versions = run.serviceVersions;
  if (versions && [versions.issuer, versions.wallet, versions.verifier].every((version) => version.startsWith("fixture/"))) return "fixture";
  if (run.config.wallet !== "reference_wallet" || !versions) return "unverified";
  if (run.config.issuer === "mock_issuer" || run.config.verifier === "mock_verifier") return "mock_interop";
  return "reference_wallet";
}

export const evidenceLabels: Record<EvidenceTier, string> = {
  fixture: "Fixture simulation",
  mock_interop: "Mock interoperability with Reference Wallet",
  reference_wallet: "Inji services with Reference Wallet",
  unverified: "Wallet evidence unverified",
};
