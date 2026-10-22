import { runConfigSchema, type RunConfig, type ScenarioDefinition } from "@playground/shared";
import { unsupportedReason } from "./capabilities.js";
import type { DriverMode } from "./drivers/registry.js";

type ScenarioSeed = Omit<ScenarioDefinition, "available" | "unavailableReason">;

const seeds: ScenarioSeed[] = [
  {
    id: "f1571de0-0000-4000-8000-000000000001",
    name: "Certify → Reference Wallet → Verify · SD-JWT",
    description: "Baseline SD-JWT issuance and presentation through Inji services with the automated Reference Wallet.",
    category: "happy_path",
    config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: "f1571de0-0000-4000-8000-000000000001" },
    expectedOutcome: "valid",
  },
  {
    id: "f1571de0-0000-4000-8000-000000000002",
    name: "Certify → Reference Wallet → Verify · JSON-LD",
    description: "The same roles with a JSON-LD credential, keeping the format as the changed variable.",
    category: "happy_path",
    config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: "f1571de0-0000-4000-8000-000000000002" },
    expectedOutcome: "valid",
  },
  {
    id: "f1571de0-0000-4000-8000-000000000003",
    name: "Mock issuer → Reference Wallet → Inji Verify",
    description: "External SD-JWT issuer path against Inji Verify; report mock provenance separately.",
    category: "external_mock",
    config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: "f1571de0-0000-4000-8000-000000000003" },
    expectedOutcome: "valid",
  },
  {
    id: "f1571de0-0000-4000-8000-000000000004",
    name: "Certify → Reference Wallet → Verify · bad signature",
    description: "Corrupt the issuer credential signature and expect verifier rejection.",
    category: "negative",
    config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: "bad_signature", scenarioId: "f1571de0-0000-4000-8000-000000000004" },
    expectedOutcome: "invalid",
  },
];

const mockFaults = [null, "bad_signature", "expired", "wrong_type", "missing_disclosure", "replay_nonce"] as const;
for (const [index, tamper] of mockFaults.entries()) {
  const id = `f1571de0-0000-4000-8000-${String(index + 5).padStart(12, "0")}`;
  seeds.push({ id, name: `Mock protocol · ${tamper === "replay_nonce" ? "nonce mismatch" : tamper ?? "valid control"}`,
    description: "Controlled mock SD-JWT issuance and verification with an exact rejection reason; nonce mismatch is distinct from byte-for-byte replay.",
    category: tamper ? "negative" : "external_mock",
    config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", tamper, scenarioId: id },
    expectedOutcome: tamper ? "invalid" : "valid" });
}

for (const seed of seeds) runConfigSchema.parse(seed.config);

export function listScenarios(mode: DriverMode, environment: NodeJS.ProcessEnv = process.env): ScenarioDefinition[] {
  return seeds.map((seed) => {
    const unavailableReason = unsupportedReason(seed.config, mode, environment)
      ?? (mode === "collab" && seed.config.issuer === "inji_certify" && (!environment.OFFICIAL_POSTMAN_ENV_PATH || !environment.MOCK_OTP)
        ? "Certify scenarios need OFFICIAL_POSTMAN_ENV_PATH and MOCK_OTP." : null)
      ?? (mode === "collab" && seed.config.issuer === "mock_issuer" && seed.config.verifier === "inji_verify" && !environment.MOCK_ISSUER_BASE_URL
        ? "The external mock issuer is not configured; start pnpm dev:x509-mock." : null);
    return { ...seed, available: unavailableReason === null, unavailableReason };
  });
}

export function scenarioMismatch(config: RunConfig): "SCENARIO_NOT_FOUND" | "SCENARIO_CONFIG_MISMATCH" | null {
  if (!config.scenarioId) return null;
  const seed = seeds.find((item) => item.id === config.scenarioId);
  if (!seed) return "SCENARIO_NOT_FOUND";
  const keys: Array<keyof RunConfig> = ["issuer", "wallet", "verifier", "format", "flow", "tamper", "scenarioId"];
  return keys.every((key) => seed.config[key] === config[key]) ? null : "SCENARIO_CONFIG_MISMATCH";
}
