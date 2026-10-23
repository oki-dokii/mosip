import { afterEach, describe, expect, it } from "vitest";
import { request as httpRequest, type Server } from "node:http";
import { createMockVerifier } from "./app.js";
import type { VerificationResult } from "./diagnostics.js";
import { parseJson } from "./http.js";
const servers: Server[] = [];
const valid: VerificationResult = { outcome: "valid", diagnosticsVersion: 1, issuerSignatureValid: true, holderProofValid: true, disclosedClaims: 2, certificateTrustChecked: false };
async function start(options: Partial<Parameters<typeof createMockVerifier>[0]> = {}) {
  let base = "";
  const server = createMockVerifier({ publicBaseUrl: () => base, ...options }); servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("listener unavailable");
  base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const challenge = () => post("/vp-request", { format: "dc+sd-jwt", profile: "mock-sdjwt-flat-v1" }).then((r) => r.json());
  const submit = (state: string, envelope: unknown = { credential: ["synthetic"] }, extra = {}) => post("/direct-post", { state, vp_token: JSON.stringify(envelope), ...extra });
  return { base, post, challenge, submit, server };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }))); });
describe("mock challenge lifecycle and HTTP validation", () => {
  it("atomically accepts one submission and caches one result", async () => {
    let time = 1000, calls = 0;
    const app = await start({ now: () => time, verify: async () => { calls++; return valid; } });
    const a = await app.challenge();
    const responses = await Promise.all([app.submit(a.claims.state), app.submit(a.claims.state)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    const results = await Promise.all([fetch(`${app.base}/result/${a.requestId}`).then((r) => r.json()), fetch(`${app.base}/result/${a.requestId}`).then((r) => r.json())]);
    expect(results).toEqual([valid, valid]); expect(calls).toBe(1);
    time += 121;
    expect(await fetch(`${app.base}/result/${a.requestId}`).then((r) => r.json())).toEqual(valid);
  });
  it("expires at the TTL boundary and clears retained results", async () => {
    let time = 1000;
    const app = await start({ now: () => time, ttlSeconds: 10, capacity: 1 });
    const a = await app.challenge();
    expect((await app.post("/vp-request", { format: "dc+sd-jwt" })).status).toBe(503);
    time = 1010;
    expect((await app.submit(a.claims.state)).status).toBe(400);
    expect((await fetch(`${app.base}/result/${a.requestId}`)).status).toBe(410);
    time = 1310;
    expect((await fetch(`${app.base}/result/${a.requestId}`)).status).toBe(404);
    expect((await app.post("/vp-request", { format: "dc+sd-jwt" })).status).toBe(201);
  });
  it.each([null, {}, { credential: "scalar" }, { credential: [] }, { credential: [""] }, { credential: ["first", "second"] }, { credential: ["synthetic"], other: [] }])("rejects ambiguous envelope without consuming state %#", async (envelope) => {
    const app = await start({ verify: async () => valid }); const a = await app.challenge();
    expect((await app.submit(a.claims.state, envelope)).status).toBe(400);
    expect((await app.submit(a.claims.state)).status).toBe(200);
  });
  it.each(["", "{}", "{malformed"])("rejects presence of PE parameter before consuming state %#", async (value) => {
    const app = await start({ verify: async () => valid }); const a = await app.challenge();
    const rejected = await app.submit(a.claims.state, undefined, { presentation_submission: value });
    expect((await rejected.json()).failure.code).toBe("UNSUPPORTED_PRESENTATION_SUBMISSION");
    expect((await app.submit(a.claims.state)).status).toBe(200);
  });
  it("keeps pending result and internal error distinct from invalid", async () => {
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const app = await start({ verify: async () => { await barrier; throw new Error("must-never-be-returned"); } });
    const a = await app.challenge();
    expect((await fetch(`${app.base}/result/${a.requestId}`)).status).toBe(409);
    await app.submit(a.claims.state);
    expect((await fetch(`${app.base}/result/${a.requestId}`)).status).toBe(202);
    release();
    const result = await fetch(`${app.base}/result/${a.requestId}`);
    expect(result.status).toBe(500); expect(await result.json()).toEqual({ error: "verification_error" });
  });
  it.each([
    { requiredClaims: ["given_name"] },
    { profile: "mock-sdjwt-flat-v1", requiredClaims: ["given_name", "given_name"] },
    { profile: "mock-sdjwt-flat-v1", requiredClaims: ["unknown"] },
    { profile: "mock-sdjwt-flat-v1", requiredClaims: "given_name" },
    { profile: "mock-sdjwt-flat-v1", requiredClaims: null },
    { profile: "unsupported" }, { unexpected: true },
  ])("rejects invalid request policy %#", async (extra) => {
    const app = await start(); expect((await app.post("/vp-request", { format: "dc+sd-jwt", ...extra })).status).toBe(400);
  });
  it("rejects duplicate fields, invalid media and oversized bodies", async () => {
    const app = await start();
    for (const [mime, body, status] of [["text/plain", "{}", 415], ["application/json", '{"format":"dc+sd-jwt","format":"dc+sd-jwt"}', 400], ["application/x-www-form-urlencoded", "state=a&state=b", 400], ["application/json", "a".repeat(65_537), 413]] as const) {
      expect((await fetch(`${app.base}/vp-request`, { method: "POST", headers: { "content-type": mime }, body })).status).toBe(status);
    }
  });
  it("returns 413 for chunked overflow without resetting the connection", async () => {
    const app = await start();
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(`${app.base}/vp-request`, { method: "POST", headers: { "content-type": "application/json", "transfer-encoding": "chunked" } }, (response) => { response.resume(); resolve(response.statusCode!); });
      req.on("error", reject); req.write("a".repeat(32_768)); req.end("a".repeat(32_769));
    });
    expect(status).toBe(413);
  });
  it("rechecks expiry after reading a delayed submission body", async () => {
    let current = 1000;
    const app = await start({ now: () => current, ttlSeconds: 10, verify: async () => valid });
    const a = await app.challenge();
    const arrived = new Promise<void>((resolve) => app.server.once("request", () => resolve()));
    let finish!: () => void;
    const result = new Promise<number>((resolve, reject) => {
      const req = httpRequest(`${app.base}/direct-post`, { method: "POST", headers: { "content-type": "application/json", "transfer-encoding": "chunked" } }, (response) => { response.resume(); resolve(response.statusCode!); });
      req.on("error", reject); req.write('{"state":');
      finish = () => req.end(`${JSON.stringify(a.claims.state)},"vp_token":${JSON.stringify(JSON.stringify({ credential: ["synthetic"] }))}}`);
    });
    await arrived; current = 1010; finish(); expect(await result).toBe(400);
    expect((await fetch(`${app.base}/result/${a.requestId}`)).status).toBe(410);
  });
  it.each(['{"a":1,"\\u0061":2}', '{"a":1,}', '/*comment*/{}', '[1,', '{', '[[[[[[[[[[[[[[[[[0]]]]]]]]]]]]]]]]]'])('strict JSON parser rejects ambiguity %#', (text) => { expect(() => parseJson(text)).toThrow(); });
});
