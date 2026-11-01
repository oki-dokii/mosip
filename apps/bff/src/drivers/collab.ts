import type { RunConfig } from "@playground/shared";
import type { DriverSet } from "./types.js";
import { MockIssuerDriver, CollabIssuerDriver } from "./collabIssuer.js";
import { CollabWalletDriver } from "./collabWallet.js";
import { MockVerifierDriver, CollabVerifierDriver } from "./collabVerifier.js";

export function createCollabDrivers(config?: RunConfig): DriverSet {
  return { issuer: config?.issuer === "mock_issuer" ? new MockIssuerDriver() : new CollabIssuerDriver(), wallet: new CollabWalletDriver(), verifier: config?.verifier === "mock_verifier" ? new MockVerifierDriver() : new CollabVerifierDriver() };
}
