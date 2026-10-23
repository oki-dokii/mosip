import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketServer } from "socket.io";
import type { RunSummary } from "@playground/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { AssistedRuns } from "../assisted.js";
import { createSteps } from "../orchestrator.js";
import { matchesPresentation } from "../presentationCorrelation.js";
import { maskedValue, runCorrelationKey } from "../redaction.js";
import { MemoryRunRepository } from "../store.js";
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
const run = () => {
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

  it("rejects arbitrary fields, unrelated routes and credentials at the boundary", () => {
    const record = run();
    expect(() => prepareLiveObservation(observed("https://issuer.example/credential", { credential: canary }), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://verifier.example/direct-post", { state, vp_token: canary }), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://wallet.example/v1/mimoto/issuers/Farmer"), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation(observed("https://evil.example/credential"), record, origins)).toThrowError(CaptureError);
    expect(() => prepareLiveObservation({ ...observed("https://issuer.example/credential"), observedAt: "2020-01-01T00:00:00.000Z" }, record, origins)).toThrowError(/CAPTURE_BRIDGE_OUT_OF_WINDOW/);
    expect(validBridgeToken("a".repeat(32), "a".repeat(32))).toBe(true);
    expect(validBridgeToken("b".repeat(32), "a".repeat(32))).toBe(false);
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
      const response = await post(observed("https://injiverify.collab.mosip.net/direct-post", { state }));
      expect(response.status).toBe(202);
      expect((await response.json()).ruleId).toBe("verify-submit");
      const rejected = await post(observed("https://injiverify.collab.mosip.net/direct-post", { state, vp_token: canary }));
      expect(rejected.status).toBe(400);
      expect(await rejected.text()).not.toContain(canary);
      const saved = await repository.get(record.run.id);
      const api = await fetch(`${base}/api/v1/runs/${record.run.id}/exchanges`).then(value => value.text());
      const output = JSON.stringify({ saved, api, emitted });
      expect(output).not.toContain(state);
      expect(output).not.toContain(canary);
      expect(output).not.toContain(process.env.CAPTURE_BRIDGE_TOKEN);
      expect(saved?.exchanges[0]?.request).toMatchObject({ source: "live_bridge", body: { state: expect.stringMatching(/^\[REDACTED hmac:[a-f0-9]{16}\]$/) } });
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
