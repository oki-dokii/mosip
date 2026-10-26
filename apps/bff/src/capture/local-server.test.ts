import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalCaptureLease, prepareServerObservation } from "./local-server.js";
import { projectSubject, serverHopPublicView, validServerHopView } from "./public-view.js";
import { createSteps } from "../orchestrator.js";
import type { RunRecord } from "../store.js";
const record = () => { const id = randomUUID(); return { run: { id, createdAt: new Date().toISOString() }, steps: createSteps(id), exchanges: [] } as unknown as RunRecord; };
const vc = { type: ["VerifiableCredential", "FarmerCredential"], credentialSubject: { id: "CANARY_ID", fullName: "CANARY_NAME", farmerID: "CANARY_FARM", address: { postalCode: "CANARY_POST" }, CANARY_FIELD: "CANARY_VALUE" }, proof: { type: "Ed25519Signature2020", proofValue: "CANARY_PROOF" } };
const event = (r: RunRecord) => ({ runId: r.run.id, leaseId: randomUUID(), observationId: randomUUID(), service: "certify", method: "POST", path: "/v1/certify/issuance/credential", observedAt: new Date().toISOString(), durationMs: 1, status: 200, requestView: serverHopPublicView(null), responseView: serverHopPublicView({ credential: vc }) });
describe("local server capture contract", () => {
  it("projects allowed subject names and nested paths without any values", () => {
    const view = serverHopPublicView({ credential: vc });
    expect(validServerHopView(view)).toBe(true);
    expect(JSON.stringify(view)).not.toContain("CANARY_");
    expect(view.items[0]?.summary.subject).toMatchObject({ names: ["id", "fullName", "farmerID", "address", "postalCode"], paths: ["$.credentialSubject.id", "$.credentialSubject.fullName", "$.credentialSubject.farmerID", "$.credentialSubject.address", "$.credentialSubject.address.postalCode"], withheldNames: 1 });
    expect(projectSubject(Array(100).fill(vc.credentialSubject)).truncatedItems).toBeGreaterThan(0);
  });
  it("rejects forged projection values, unknown names and prototype keys", () => {
    const view = serverHopPublicView({ credential: vc });
    for (const change of [ { ...view, unknown: "CANARY" }, { ...view, items: [{ kind: "verifiable_credential", summary: { types: ["CANARY"] } }] } ]) expect(validServerHopView(change)).toBe(false);
    expect(validServerHopView({ ...view, withheldNames: -1 })).toBe(false);
  });
  it("assigns canonical actor, rule, step, run and shape-only response", () => {
    const r = record(), value = prepareServerObservation(event(r), r);
    expect(value).toMatchObject({ runId: r.run.id, actorFrom: "mimoto", actorTo: "certify", stepId: r.steps.find(step => step.stepKey === "ISSUE_CREDENTIAL")!.id });
    expect(value.request).toMatchObject({ source: "local_server_proxy", capture: { ruleId: "certify-credential" } });
    expect(JSON.stringify(value)).not.toContain("CANARY_");
  });
  it("shares only the backend per-run state tag and rejects unsafe routes", () => {
    const r = record(), state = "CANARY_STATE_".repeat(6);
    const input = { ...event(r), service: "verify", path: "/v1/verify/vp-submission/direct-post", state };
    const a = prepareServerObservation(input, r);
    expect(a.request).toMatchObject({ body: { state: expect.stringMatching(/^\[REDACTED hmac:/) } });
    expect(JSON.stringify(a)).not.toContain(state);
    expect(() => prepareServerObservation({ ...input, path: "/v1/verify/vp-submission/direct-post?state=CANARY" }, r)).toThrow("LOCAL_CAPTURE_ROUTE");
    expect(() => prepareServerObservation({ ...input, requestView: { arbitrary: "CANARY" } }, r)).toThrow("LOCAL_CAPTURE_INVALID");
  });
  it("prevents overlapping leases and late observations crossing runs", () => {
    const lease = new LocalCaptureLease(), first = randomUUID(), second = randomUUID();
    lease.claim(first); const old = lease.snapshot()!;
    expect(() => lease.claim(second)).toThrow("BUSY");
    lease.release(first); lease.claim(second);
    expect(lease.matches(first, old.leaseId)).toBe(false);
    expect(lease.matches(second, old.leaseId)).toBe(false);
  });
});
