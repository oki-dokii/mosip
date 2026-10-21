import { z } from "zod";

export const issuerSchema = z.enum(["inji_certify", "mock_issuer"]);
export const walletSchema = z.enum(["reference_wallet", "inji_web_assisted"]);
export const verifierSchema = z.enum(["inji_verify", "mock_verifier"]);
export const credentialFormatSchema = z.enum(["ldp_vc", "vc_sd_jwt"]);
export const flowSchema = z.literal("cross_device");
export const tamperKindSchema = z.enum(["expired", "bad_signature", "wrong_type", "missing_disclosure", "replay_nonce"]);

export const runConfigSchema = z.object({
  issuer: issuerSchema,
  wallet: walletSchema,
  verifier: verifierSchema,
  format: credentialFormatSchema,
  flow: flowSchema.default("cross_device"),
  tamper: tamperKindSchema.nullable().default(null),
  scenarioId: z.string().uuid().nullable().default(null),
});

export type RunConfig = z.infer<typeof runConfigSchema>;
export type RunStatus = "pending" | "running" | "passed" | "failed" | "errored" | "cancelled";
export type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export interface RunSummary {
  id: string;
  parentRunId: string | null;
  config: RunConfig;
  status: RunStatus;
  expectedOutcome: "valid" | "invalid" | "expired";
  actualOutcome: "valid" | "invalid" | "expired" | "error" | null;
  proofType: string;
  algorithm: string;
  serviceVersions?: { issuer: string; wallet: string; verifier: string };
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export { evidenceTier, evidenceLabels } from "./evidence.js";
export type { EvidenceTier } from "./evidence.js";

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  category: "happy_path" | "negative" | "external_mock";
  config: RunConfig;
  expectedOutcome: "valid" | "invalid";
  available: boolean;
  unavailableReason: string | null;
}

export interface RunStep {
  id: string;
  runId: string;
  seq: number;
  stepKey: string;
  title: string;
  status: StepStatus;
  summary: Record<string, unknown> | null;
}

export interface Exchange {
  id: string;
  runId: string;
  stepId: string;
  seq: number;
  actorFrom: string;
  actorTo: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  request: unknown;
  response: unknown;
  redactions: string[];
}

export interface ImplementationMetadata {
  issuers: Array<{ id: RunConfig["issuer"]; name: string; kind: "inji" | "external" }>;
  wallets: Array<{ id: RunConfig["wallet"]; name: string; kind: "inji" | "reference" }>;
  verifiers: Array<{ id: RunConfig["verifier"]; name: string; kind: "inji" | "external" }>;
  formats: Array<{ id: RunConfig["format"]; name: string; proofType: string; algorithm: string }>;
}
