import type { RunConfig } from "@playground/shared";
import type { DriverMode } from "./drivers/registry.js";

export function unsupportedReason(config: RunConfig, mode: DriverMode): string | null {
  if (mode === "fixture") return null;
  if (config.wallet !== "reference_wallet") return "Live runs require the Reference Wallet; assisted Inji Web is not automated yet";
  if ((config.issuer === "mock_issuer" || config.verifier === "mock_verifier") && config.format !== "vc_sd_jwt") return "Local non-Inji mock roles currently support SD-JWT VC only";
  if (config.verifier === "mock_verifier" && config.tamper === "missing_disclosure") return "The mock verifier has no required-disclosure policy for this credential";
  return null;
}
