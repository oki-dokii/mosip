import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Exchange } from "@playground/shared";
import type { RunRecord } from "../store.js";
import { maskedValue, runCorrelationKey } from "../redaction.js";
import { CaptureError } from "./har.js";
import { validServerHopView } from "./public-view.js";
import { tagCapture } from "./tagging.js";

// One isolated synthetic operator/run at a time. Lease IDs bind in-flight work;
// an observation from a cancelled/expired run cannot migrate into a newer run.
export class LocalCaptureLease {
  private current: { runId: string; leaseId: string; expiresAt: number } | undefined;
  claim(runId: string) {
    if (this.current && this.current.expiresAt > Date.now()) throw new Error("ASSISTED_LOCAL_CAPTURE_BUSY");
    this.current = { runId, leaseId: randomUUID(), expiresAt: Date.now() + 3_600_000 };
  }
  snapshot() { return this.current && this.current.expiresAt > Date.now() ? { ...this.current } : null; }
  release(runId: string) { if (this.current?.runId === runId) this.current = undefined; }
  matches(runId: string, leaseId: string) { const lease = this.snapshot(); return lease?.runId === runId && lease.leaseId === leaseId; }
}
const observation = z.object({
  runId: z.string().uuid(), leaseId: z.string().uuid(), observationId: z.string().uuid(),
  service: z.enum(["certify", "verify"]), method: z.enum(["GET", "POST"]),
  path: z.string().max(512), observedAt: z.string().datetime(), durationMs: z.number().int().min(0).max(120000),
  status: z.number().int().min(100).max(599), state: z.string().min(32).max(2048).optional(),
  requestView: z.unknown().refine(validServerHopView), responseView: z.unknown().refine(validServerHopView),
}).strict();
const paths = {
  certify: /^\/v1\/certify\/(?:\.well-known\/openid-credential-issuer|oauth\/token|issuance\/credential)$/,
  verify: /^\/v1\/verify\/(?:vp-request\/[A-Za-z0-9_-]{1,200}|vp-submission\/direct-post)$/,
};
export function prepareServerObservation(input: unknown, record: RunRecord): Exchange {
  const parsed = observation.safeParse(input);
  if (!parsed.success) throw new CaptureError("LOCAL_CAPTURE_INVALID");
  const value = parsed.data;
  if (value.runId !== record.run.id || !paths[value.service].test(value.path)) throw new CaptureError("LOCAL_CAPTURE_ROUTE", 422);
  const rule = tagCapture(value.service, value.method, value.path);
  const step = record.steps.find(step => step.stepKey === rule?.stepKey);
  if (!rule || !step || (value.state !== undefined && rule.id !== "verify-submit") ||
    (rule.id === "verify-submit" && !value.state)) throw new CaptureError("LOCAL_CAPTURE_ROUTE", 422);
  const time = Date.parse(value.observedAt);
  if (time < Date.parse(record.run.createdAt) - 5000 || time > Date.now() + 5000) throw new CaptureError("LOCAL_CAPTURE_WINDOW", 409);
  const body = value.state ? { state: maskedValue(value.state, "$.request.body.state", runCorrelationKey(record.run.id)) } : {};
  const origin = value.service === "certify" ? "http://127.0.0.1:18090" : "https://local.test";
  return { id: value.observationId, runId: record.run.id, stepId: step.id,
    seq: Math.max(0, ...record.exchanges.map(item => item.seq)) + 1,
    actorFrom: "mimoto", actorTo: value.service, method: value.method,
    url: origin + rule.template, status: value.status, durationMs: value.durationMs,
    request: { source: "local_server_proxy", body, publicView: value.requestView,
      capture: { schemaVersion: 1, ruleId: rule.id, provenance: "canonical_local_forwarder",
        correlation: "exclusive_run_lease", via: "local_issuer_bridge", payloadCaptured: false, observedAt: value.observedAt,
        downstreamCertifyObserved: value.service === "certify", downstreamVerifyObserved: value.service === "verify" } },
    response: { source: "local_server_proxy", publicView: value.responseView },
    redactions: ["$.request.headers", "$.request.body", "$.response.headers", "$.response.body", "$.url.path"],
  };
}
export function serverCoverage(record: RunRecord) {
  return ["certify-token", "certify-credential", "verify-request-fetch", "verify-submit"].map(ruleId => {
    const exchanges = record.exchanges.filter(exchange => (exchange.request as any)?.source === "local_server_proxy" && (exchange.request as any)?.capture?.ruleId === ruleId);
    return { ruleId, state: exchanges.length ? "observed" : "not_observed", exchangeIds: exchanges.map(exchange => exchange.id), actorFrom: "mimoto", actorTo: ruleId.startsWith("certify") ? "certify" : "verify" };
  });
}
