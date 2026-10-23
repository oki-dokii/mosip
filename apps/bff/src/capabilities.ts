import type { RunConfig } from "@playground/shared";
import type { DriverMode } from "./drivers/registry.js";

export function unsupportedReason(config: RunConfig, mode: DriverMode, environment: NodeJS.ProcessEnv = process.env): string | null {
  if (mode === "fixture") return null;
  if (config.wallet !== "reference_wallet") return "Live runs require the Reference Wallet; assisted Inji Web is not automated yet";
  if ((config.issuer === "mock_issuer" || config.verifier === "mock_verifier") && config.format !== "vc_sd_jwt") return "Local non-Inji mock roles currently support SD-JWT VC only";
  if ((config.tamper === "expired" || config.tamper === "wrong_type") && (config.issuer !== "mock_issuer" || config.format !== "vc_sd_jwt")) return "Isolated expiry/type tests require a controlled SD-JWT mock issuer that signs the intended claims";
  if ((config.tamper === "expired" || config.tamper === "wrong_type") && environment.MOCK_ISSUER_BASE_URL && environment.MOCK_ISSUER_ENABLE_TEST_CASES !== "true") return "Signed faults require MOCK_ISSUER_ENABLE_TEST_CASES=true on the BFF and external mock issuer";
  if (config.tamper === "missing_disclosure" && (config.verifier !== "mock_verifier" || config.issuer !== "mock_issuer")) return "The missing-disclosure case requires the mock issuer and its explicit required-disclosure verifier policy";
  return null;
}
