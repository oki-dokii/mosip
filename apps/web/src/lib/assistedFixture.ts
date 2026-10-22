import type { Exchange } from "@playground/shared";
import { AssistedJourney } from "./assistedJourney";
import type { AssistedActions } from "./assistedActions";

export function createAssistedFixture(runId: string) {
  const steps = { ISSUE_CREDENTIAL: `${runId}:issue`, PRESENT_SUBMIT: `${runId}:present` };
  const journey = new AssistedJourney(runId, steps);
  const target = `fixture-${encodeURIComponent(runId).replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const actions: AssistedActions = { walletUrl: `#${target}-wallet`, offerUrl: `#${target}-offer`, presentationUrl: `#${target}-request` };
  const exchange = (presentation: boolean): Exchange => ({
    id: `${runId}:${presentation ? "presentation" : "issuance"}`, runId,
    stepId: presentation ? steps.PRESENT_SUBMIT : steps.ISSUE_CREDENTIAL,
    seq: presentation ? 2 : 1, actorFrom: "browser", actorTo: presentation ? "verify" : "certify",
    method: "POST", url: presentation ? "https://verifier.example/direct-post" : "https://issuer.example/credential",
    status: 200, durationMs: 20, redactions: [],
    request: { source: "har_import", capture: { schemaVersion: 1, ruleId: presentation ? "verify-submit" : "certify-credential", why: "Synthetic fixture of the redacted capture contract.", redactionCount: 0, timingKnown: true, observedAt: "2026-10-22T00:00:00.000Z" }, publicView: { schemaVersion: 1, authenticity: "not_verified", items: [], withheldNames: 0, truncatedItems: 0, unsupportedKinds: 0 } },
    response: { source: "har_import", received: true },
  });
  return { journey, actions, target, issuance: () => journey.observe(exchange(false)), storage: () => journey.confirmStorage(runId), presentation: () => journey.observe(exchange(true)), result: (outcome: "valid" | "invalid") => journey.verifierResult(runId, outcome) };
}
