import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketServer } from "socket.io";
import type { RunSummary } from "@playground/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { AssistedRuns } from "../assisted.js";
import { createSteps } from "../orchestrator.js";
import { matchesMimotoPresentation, matchesPresentation } from "../presentationCorrelation.js";
import { maskedValue, runCorrelationKey } from "../redaction.js";
import { MemoryRunRepository, type RunRecord } from "../store.js";
import { collectLiveObservations, discoverLiveRoutes } from "./live-bridge-cli.js";
import { CaptureError } from "./har.js";
import { prepareLiveObservation, validBridgeToken } from "./live-bridge.js";

const origins = new Map([
  ["https://wallet.example", "mimoto"],
  ["https://issuer.example", "certify"],
  ["https://verifier.example", "verify"],
] as const);
const state = "synthetic-state-CANARY-0123456789abcdef";
const canary = "PRIVATE_CREDENTIAL_CANARY_DO_NOT_STORE";
const run = (): RunRecord => {
  const id = randomUUID();
  const summary: RunSummary = { id, parentRunId: null,
    config: { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null },
    status: "running", expectedOutcome: "valid", actualOutcome: null, proofType: "Ed25519Signature2020", algorithm: "EdDSA",
    createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), finishedAt: null };
  return { run: summary, steps: createSteps(id), exchanges: [] };
};
const observed = (url: string, extra: Record<string, unknown> = {}) => ({ observedAt: new Date().toISOString(), durationMs: 12, method: "POST", url, status: 200, ...extra });

afterEach(() => { vi.restoreAllMocks(); delete process.env.CAPTURE_BRIDGE_TOKEN; });

describe("live capture bridge", () => {
  it("acknowledges earlier issuance in a cumulative recording and sequences the new presentation", () => {
    const record = run();
    const issuance = observed("https://wallet.example/v1/mimoto/wallets/private-wallet-id/credentials");
    const first = prepareLiveObservation(issuance, record, origins);
    record.exchanges.push(first);
    expect(prepareLiveObservation(issuance, record, origins)).toEqual(first);
    const presentation = prepareLiveObservation(observed("https://wallet.example/v1/mimoto/wallets/private-wallet-id/presentations", {
      requestUri: "https://verifier.example/v1/verify/v2/vp-request/private-request-id", requestUriSource: "presentation_body",
    }), record, origins);
    expect(presentation.seq).toBe(first.seq + 1);
    expect(presentation.id).not.toBe(first.id);
  });

  it("rejects a raw query value before preparing a verifier observation", () => {
    const record = run();
    expect(() => prepareLiveObservation(observed("https://verifier.example/v1/verify/vp-submission/direct-post?state=forbidden", { state }), record, origins)).toThrowError(CaptureError);
  });

  it("accepts only a minimal direct-post and matches the correct run's challenge", () => {
    const record = run();
    const exchange = prepareLiveObservation(observed("https://verifier.example/v1/verify/vp-submission/direct-post", { state }), record, origins);
    const expected = maskedValue(state, "$.request.body.state", runCorrelationKey(record.run.id));
    expect(exchange.request).toMatchObject({ source: "live_bridge", body: { state: expected }, capture: { ruleId: "verify-submit", payloadCaptured: false } });
    expect(matchesPresentation(exchange, expected, "https://verifier.example")).toBe(true);
    expect(matchesPresentation(exchange, maskedValue(state, "$.request.body.state", runCorrelationKey(randomUUID())), "https://verifier.example")).toBe(false);
    expect(JSON.stringify(exchange)).not.toContain(state);
    expect(JSON.stringify(exchange)).not.toContain(canary);
  });

  it("labels Mimoto browser download without claiming downstream Certify observation", () => {
    const record = run();
    const exchange = prepareLiveObservation(observed("https://wallet.example/v1/mimoto/credential/synthetic-id"), record, origins);
    expect(exchange).toMatchObject({ actorFrom: "browser", actorTo: "mimoto", request: { source: "live_bridge", capture: { ruleId: "mimoto-download", downstreamCertifyObserved: false } } });
    expect(record.steps.find(step => step.id === exchange.stepId)?.stepKey).toBe("ISSUE_CREDENTIAL");
  });

  it("tags the observed wallet-scoped credential route as Mimoto transport only", () => {
    const record = run();
    const exchange = prepareLiveObservation(observed("https://wallet.example/v1/mimoto/wallets/private-wallet-id/credentials"), record, origins);
    expect(exchange).toMatchObject({ actorTo: "mimoto", url: "https://wallet.example/v1/mimoto/wallets/{id}/credentials",
      request: { capture: { ruleId: "mimoto-wallet-credential", downstreamCertifyObserved: false, payloadCaptured: false } } });
    expect(JSON.stringify(exchange)).not.toContain("private-wallet-id");
  });

  it("correlates the observed Mimoto presentation by a run-scoped request URI tag", () => {
    const record = run();
    const requestUri = "https://verifier.example/v1/verify/v2/vp-request/private-request-id";
    const input = observed("https://wallet.example/v1/mimoto/wallets/private-wallet-id/presentations", { requestUri, requestUriSource: "same_origin_referrer" });
    const exchange = prepareLiveObservation(input, record, origins);
    const tag = maskedValue(requestUri, "$.request.capture.requestUri", runCorrelationKey(record.run.id));
    expect(exchange).toMatchObject({ actorTo: "mimoto", url: "https://wallet.example/v1/mimoto/wallets/{id}/presentations",
      request: { capture: { ruleId: "mimoto-wallet-presentation", requestUriTag: tag, requestUriSource: "same_origin_referrer", downstreamVerifyObserved: false } } });
    expect(matchesMimotoPresentation(exchange, tag, "https://wallet.example")).toBe(true);
    expect(matchesMimotoPresentation(exchange, maskedValue(requestUri, "$.request.capture.requestUri", runCorrelationKey(randomUUID())), "https://wallet.example")).toBe(false);
    expect(matchesMimotoPresentation(exchange, tag, "https://other.example")).toBe(false);
    expect(JSON.stringify(exchange)).not.toContain(requestUri);
    expect(JSON.stringify(exchange)).not.toContain("private-wallet-id");
    expect(() => prepareLiveObservation(observed("https://wallet.example/v1/mimoto/wallets/id/presentations"), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://wallet.example/v1/mimoto/wallets/id/presentations", { requestUri: "https://evil.example/request/opaque-1234567890123456789", requestUriSource: "presentation_body" }), record, origins)).toThrowError(CaptureError);
  });

  it("keeps hosted Verify session calls separate from a verified verdict", () => {
    const record = run();
    const request = prepareLiveObservation(observed("https://verifier.example/v1/verify/v2/vp-session-request"), record, origins);
    const result = prepareLiveObservation(observed("https://verifier.example/v1/verify/vp-session-results"), record, origins);
    expect((request.request as any).capture.ruleId).toBe("verify-session-request");
    expect((result.request as any).capture).toMatchObject({ ruleId: "verify-session-results", payloadCaptured: false, downstreamVerifyObserved: false });
    expect(matchesPresentation(result, maskedValue(state, "$.request.body.state", runCorrelationKey(record.run.id)), "https://verifier.example")).toBe(false);
    expect(record.steps.find(step => step.id === result.stepId)?.stepKey).toBe("PRESENT_RESULT");
  });

  it("rejects arbitrary fields, unrelated routes and credentials at the boundary", () => {
    const record = run();
    expect(() => prepareLiveObservation(observed("https://issuer.example/credential", { credential: canary }), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://verifier.example/direct-post", { state, vp_token: canary }), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://wallet.example/v1/mimoto/issuers/Farmer"), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://evil.example/credential"), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation({ ...observed("https://issuer.example/credential"), observedAt: "2020-01-01T00:00:00.000Z" }, record, origins)).toThrowError(/CAPTURE_BRIDGE_OUT_OF_WINDOW/);
    expect(validBridgeToken("a".repeat(32), "a".repeat(32))).toBe(true);
    expect(validBridgeToken("b".repeat(32), "a".repeat(32))).toBe(false);
    expect(() => prepareLiveObservation(observed("https://verifier.example/v1/verify/vp-session-results", { state }), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://wallet.example/v1/mimoto/wallets/id/credentials", { requestUri: "https://verifier.example/request/opaque-1234567890123456789", requestUriSource: "presentation_body" }), record, origins)).toThrowError(CaptureError);
  });

  it("extracts a matching request URI only from the presentation body or same-origin authorize referrer", () => {
    const uri = "https://verifier.example/v1/verify/v2/vp-request/private-request-id";
    const base = { startedDateTime: new Date().toISOString(), time: 5,
      request: { method: "POST", url: "https://wallet.example/v1/mimoto/wallets/private-wallet-id/presentations", headers: [{ name: "Referer", value: `https://wallet.example/user/authorize?request_uri=${encodeURIComponent(uri)}&session=PRIVATE` }],
        postData: { mimeType: "application/json", text: JSON.stringify({ vp_token: canary }) } }, response: { status: 200, content: { text: canary } } };
    const collected = collectLiveObservations({ log: { entries: [base] } }, origins);
    expect(collected.observations).toMatchObject([{ requestUri: uri, requestUriSource: "same_origin_referrer" }]);
    expect(JSON.stringify(collected)).not.toContain(canary);
    expect(JSON.stringify(collected)).not.toContain("PRIVATE");
    const fromBody = collectLiveObservations({ log: { entries: [{ ...base, request: { ...base.request, headers: [], postData: { mimeType: "application/json", text: JSON.stringify({ requestUri: uri, vp_token: canary }) } } }] } }, origins);
    expect(fromBody.observations).toMatchObject([{ requestUri: uri, requestUriSource: "presentation_body" }]);
    const fromQuery = collectLiveObservations({ log: { entries: [{ ...base, request: { ...base.request, url: `${base.request.url}?request_uri=${encodeURIComponent(uri)}&token=PRIVATE_QUERY`, headers: [] } }] } }, origins);
    expect(fromQuery.observations).toMatchObject([{ requestUri: uri, requestUriSource: "presentation_query", url: base.request.url }]);
    expect(JSON.stringify(fromQuery)).not.toContain("PRIVATE_QUERY");
    const missing = collectLiveObservations({ log: { entries: [{ ...base, request: { ...base.request, headers: [] } }] } }, origins);
    expect(missing).toMatchObject({ observations: [], skippedReasons: { request_uri_unavailable: 1 } });
    const conflicting = collectLiveObservations({ log: { entries: [{ ...base, request: { ...base.request, postData: { mimeType: "application/json", text: JSON.stringify({ requestUri: uri + "-other" }) } } }] } }, origins);
    expect(conflicting.skippedReasons.request_uri_unavailable).toBe(1);
    expect(discoverLiveRoutes({ log: { entries: [base] } }, origins)).toContainEqual({ method: "POST", origin: "https://wallet.example", path: "/v1/mimoto/wallets/{id}/presentations", service: "mimoto", ruleId: "mimoto-wallet-presentation", count: 1 });
  });

  it("collects only metadata and state locally; discovery prints masked paths", () => {
    const har = { log: { entries: [
      { startedDateTime: "2026-10-23T10:00:00.000Z", time: 10, request: { method: "POST", url: "https://wallet.example/v1/mimoto/credential/secret-123?token=PRIVATE_QUERY", headers: [{ name: "Cookie", value: canary }], postData: { mimeType: "application/json", text: JSON.stringify({ credential: canary }) } }, response: { status: 200, content: { text: canary } } },
      { startedDateTime: "2026-10-23T10:01:00.000Z", time: 10, request: { method: "POST", url: "https://verifier.example/v1/verify/vp-submission/direct-post/secret-456#fragment", headers: [{ name: "Authorization", value: canary }], postData: { mimeType: "application/x-www-form-urlencoded", text: new URLSearchParams({ state, vp_token: canary }).toString() } }, response: { status: 200, content: { text: canary } } },
      { startedDateTime: "2026-10-23T10:02:00.000Z", time: 10, request: { method: "POST", url: "https://verifier.example/direct-post", postData: { mimeType: "application/json", text: JSON.stringify({ state, vp_token: canary }) } }, response: { status: 200 } },
    ] } };
    const collected = collectLiveObservations(har, origins);
    expect(collected.observations).toHaveLength(3);
    expect(collected.observations[1]?.state).toBe(state);
    expect(collected.observations[2]?.state).toBe(state);
    expect(JSON.stringify(collected)).not.toContain(canary);
    expect(JSON.stringify(collected)).not.toContain("PRIVATE_QUERY");
    expect(JSON.stringify(collected)).not.toContain("secret-456#fragment");
    const routes = discoverLiveRoutes(har, origins);
    expect(routes).toContainEqual({ method: "POST", origin: "https://wallet.example", path: "/v1/mimoto/credential/{id}", service: "mimoto", ruleId: "mimoto-download", count: 1 });
    expect(routes).toContainEqual({ method: "POST", origin: "https://verifier.example", path: "/v1/verify/vp-submission/direct-post/{id}", service: "verify", ruleId: "verify-submit", count: 1 });
    expect(JSON.stringify(routes)).not.toContain("secret-");
    expect(JSON.stringify(routes)).not.toContain("PRIVATE_");
  });

  it("keeps state and credential out of stored exchanges, the API, Socket.IO and responses", async () => {
    process.env.CAPTURE_BRIDGE_TOKEN = "synthetic-bridge-token-0123456789abcdef";
    vi.spyOn(AssistedRuns.prototype, "live").mockReturnValue(true);
    const record = run();
    const repository = new MemoryRunRepository();
    await repository.create(record);
    const emitted: unknown[] = [];
    const io = { of: () => ({ to: () => ({ emit: (...args: unknown[]) => emitted.push(args) }) }) } as unknown as SocketServer;
    const server: HttpServer = buildApp(() => io, repository).listen(0, "127.0.0.1");
    try {
      await new Promise<void>(resolve => server.once("listening", resolve));
      const address = server.address(); if (!address || typeof address === "string") throw new Error();
      const base = `http://127.0.0.1:${address.port}`;
      const endpoint = `/api/v1/assisted/runs/${record.run.id}/capture/observation`;
      const post = (body: unknown, token = process.env.CAPTURE_BRIDGE_TOKEN) => fetch(base + endpoint, { method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-capture-bridge-token": token } : {}) }, body: JSON.stringify(body) });
      expect((await post(observed("https://injiverify.collab.mosip.net/direct-post", { state }), "wrong")).status).toBe(403);
      const directPost = observed("https://injiverify.collab.mosip.net/direct-post", { state });
      const response = await post(directPost);
      expect(response.status).toBe(202);
      expect((await response.json()).ruleId).toBe("verify-submit");
      const duplicate = await post(directPost);
      expect(duplicate.status).toBe(202);
      expect(await duplicate.json()).toMatchObject({ accepted: false, duplicate: true, ruleId: "verify-submit" });
      expect(emitted).toHaveLength(1);
      const requestUri = "https://injiverify.collab.mosip.net/v1/verify/v2/vp-request/private-request-id";
      const mimoto = await post(observed("https://injiweb.collab.mosip.net/v1/mimoto/wallets/private-wallet-id/presentations", { requestUri, requestUriSource: "same_origin_referrer" }));
      expect(mimoto.status).toBe(202);
      expect((await mimoto.json()).ruleId).toBe("mimoto-wallet-presentation");
      const rejected = await post(observed("https://injiverify.collab.mosip.net/direct-post", { state, vp_token: canary }));
      expect(rejected.status).toBe(400);
      expect(await rejected.text()).not.toContain(canary);
      const saved = await repository.get(record.run.id);
      const api = await fetch(`${base}/api/v1/runs/${record.run.id}/exchanges`).then(value => value.text());
      const output = JSON.stringify({ saved, api, emitted });
      expect(output).not.toContain(state);
      expect(output).not.toContain(requestUri);
      expect(output).not.toContain("private-wallet-id");
      expect(output).not.toContain(canary);
      expect(output).not.toContain(process.env.CAPTURE_BRIDGE_TOKEN);
      expect(saved?.exchanges[0]?.request).toMatchObject({ source: "live_bridge", body: { state: expect.stringMatching(/^\[REDACTED hmac:[a-f0-9]{16}\]$/) } });
      expect(saved?.exchanges[1]?.request).toMatchObject({ capture: { requestUriTag: expect.stringMatching(/^\[REDACTED hmac:[a-f0-9]{16}\]$/) } });
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
