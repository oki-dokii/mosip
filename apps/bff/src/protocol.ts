import type { ProtocolEvaluation, ProtocolFailure, RunConfig, RunStep, RunSummary } from "@playground/shared";
import { stages, type RejectionCode } from "@playground/mock-verifier/diagnostics";

const faultCodes = {
  bad_signature: "ISSUER_SIGNATURE_INVALID", expired: "CREDENTIAL_EXPIRED", wrong_type: "CREDENTIAL_TYPE_MISMATCH",
  missing_disclosure: "REQUIRED_DISCLOSURE_MISSING", replay_nonce: "NONCE_MISMATCH",
} as const;
export function expectedFailure(config: RunConfig): ProtocolFailure | null {
  const code = config.tamper ? faultCodes[config.tamper] : null;
  return code ? { boundary: "result", stage: stages[code], code } : null;
}
export function safeFailure(value: unknown, boundary?: ProtocolFailure["boundary"]): ProtocolFailure | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.code !== "string" || !Object.hasOwn(stages, candidate.code) || stages[candidate.code as RejectionCode] !== candidate.stage || !["result", "direct_post"].includes(String(candidate.boundary)) || boundary && candidate.boundary !== boundary) return null;
  return { code: candidate.code, stage: String(candidate.stage), boundary: candidate.boundary as ProtocolFailure["boundary"] };
}
export function evaluateProtocol(config: RunConfig, expectedOutcome: RunSummary["expectedOutcome"], outcome: RunSummary["actualOutcome"], summary?: Record<string, unknown>, failedStep?: string): ProtocolEvaluation {
  const wanted = expectedFailure(config), diagnostic = safeFailure(summary?.failure);
  const expected: ProtocolEvaluation["expected"] = { outcome: expectedOutcome, boundary: "result", step: "PRESENT_RESULT", ...(wanted ? { stage: wanted.stage, code: wanted.code } : {}) };
  const boundary = diagnostic?.boundary ?? (summary?.resultSource === "direct_post_rejection" ? "direct_post" : outcome === "valid" || outcome === "invalid" || outcome === "expired" ? "result" : null);
  const observed: ProtocolEvaluation["observed"] = { outcome, boundary, step: failedStep ?? (boundary === "direct_post" ? "PRESENT_SUBMIT" : boundary === "result" ? "PRESENT_RESULT" : null), stage: diagnostic?.stage ?? null, code: diagnostic?.code ?? null };
  let verdict: ProtocolEvaluation["verdict"];
  if (!outcome || outcome === "error" || failedStep) verdict = "inconclusive";
  else if (expectedOutcome === "valid") verdict = outcome === "valid" ? "correct_acceptance" : "unexpected_rejection";
  else if (outcome === "valid") verdict = "wrongly_accepted";
  else if (!diagnostic || summary?.diagnosticsVersion !== 1) verdict = "inconclusive";
  else if (boundary !== expected.boundary) verdict = "wrong_step";
  else if (diagnostic.stage !== expected.stage || diagnostic.code !== expected.code || outcome !== expectedOutcome) verdict = "wrong_reason";
  else verdict = "correct_rejection";
  return { schemaVersion: 1, verdict, expected, observed };
}
export function protocolMetadata(steps: RunStep[]): Pick<RunSummary, "evaluation" | "protocolProfile" | "issuerRepresentation"> {
  const result: Pick<RunSummary, "evaluation" | "protocolProfile" | "issuerRepresentation"> = {};
  for (const step of [...steps].sort((a, b) => a.seq - b.seq)) {
    const summary = step.summary;
    if (!summary) continue;
    if (["fixture-v1", "mock-sdjwt-flat-v1", "legacy-mock-v1", "collab-dcql", "local-jsonld-pex-0.18.2"].includes(String(summary.protocolProfile))) result.protocolProfile = summary.protocolProfile as NonNullable<RunSummary["protocolProfile"]>;
    if (["did:jwk", "x509", "unreported"].includes(String(summary.issuerRepresentation))) result.issuerRepresentation = summary.issuerRepresentation as NonNullable<RunSummary["issuerRepresentation"]>;
    const evaluation = summary.protocolEvaluation as ProtocolEvaluation | undefined;
    if (evaluation?.schemaVersion === 1 && ["correct_acceptance", "correct_rejection", "unexpected_rejection", "wrongly_accepted", "wrong_step", "wrong_reason", "inconclusive"].includes(evaluation.verdict)) result.evaluation = evaluation;
  }
  return result;
}
export function signedVariant(config: RunConfig): "expired" | "wrong_type" | null {
  return config.issuer === "mock_issuer" && (config.tamper === "expired" || config.tamper === "wrong_type") ? config.tamper : null;
}
export function mockPolicy(config: RunConfig) {
  return config.issuer === "mock_issuer"
    ? { profile: "mock-sdjwt-flat-v1" as const, requiredClaims: ["given_name"] }
    : { profile: "legacy-mock-v1" as const, requiredClaims: [] };
}
