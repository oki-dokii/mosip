import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Server } from "socket.io";
import { expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { MemoryRunRepository, PrismaRunRepository, type RunRepository } from "../store.js";
import { runCorrelationKey } from "../redaction.js";
import { serverHopPublicView } from "./public-view.js";

async function exercise(postgres = false) {
  const originalFetch = globalThis.fetch;
  const previous = { ...process.env };
  Object.assign(process.env, { ASSISTED_LOCAL_PROFILE: "jsonld-0.14", ASSISTED_LIVE_ENABLED: "true", CAPTURE_BRIDGE_TOKEN: "a".repeat(64),
    CERTIFY_BASE_URL: "http://127.0.0.1:18090/v1/certify", VERIFY_BASE_URL: "http://127.0.0.1:18081/v1/verify",
    ASSISTED_WALLET_URL: "http://127.0.0.1:18093/", ASSISTED_OFFER_URL: "http://127.0.0.1:18093/issuers/LocalFarmer",
    CERTIFY_VERSION_LABEL: "0.14.0", VERIFY_VERSION_LABEL: "0.18.2", INJI_WEB_VERSION_LABEL: "0.17.0" });
  const prisma = postgres ? new PrismaClient({ datasources: { db: { url: process.env.CAPTURE_POSTGRES_TEST_URL! } } }) : null;
  const repository: RunRepository = prisma ? new PrismaRunRepository(prisma) : new MemoryRunRepository();
  const emitted: unknown[] = [];
  const io = { of: () => ({ to: () => ({ emit: (...args: unknown[]) => emitted.push(structuredClone(args)) }) }) } as unknown as Server;
  let state = "CANARY_STATE_".repeat(6), nonce = "", runId = "";
  const requestId = randomUUID(), transactionId = randomUUID();
  const server = buildApp(() => io, repository).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const fakeUpstream = async (input: any, options: any = {}) => {
    const url = String(input);
    if (url.startsWith(base)) return originalFetch(input, options);
    if (url.includes("openid-credential-issuer")) return new Response('{}');
    if (url.endsWith("/vp-request")) { nonce = JSON.parse(options.body).nonce; return Response.json({ transactionId, requestId, requestUri: `https://local.test/v1/verify/vp-request/${requestId}` }, { status: 201 }); }
    if (url.includes("/vp-request/")) {
      const claims = { client_id: "did:web:local.test:verify", nonce, state, response_mode: "direct_post", response_uri: "https://local.test/v1/verify/vp-submission/direct-post", presentation_definition: {} };
      const jwt = [Buffer.from('{"alg":"EdDSA"}').toString("base64url"), Buffer.from(JSON.stringify(claims)).toString("base64url"), "synthetic_signature"].join(".");
      return new Response(jwt);
    }
    if (url.includes("/vp-results/")) return Response.json({ allChecksSuccessful: true, credentialResults: [{ schemaAndSignatureCheck: { valid: true }, holderProofCheck: { valid: true }, credential: "CANARY_RESULT_SECRET" }] });
    return new Response('{"error":"CANARY_ERROR_BODY"}', { status: 500 });
  };
  vi.stubGlobal("fetch", fakeUpstream);
  const post = (path: string, value: unknown, token = false) => originalFetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-capture-bridge-token": process.env.CAPTURE_BRIDGE_TOKEN! } : {}) }, body: JSON.stringify(value) });
  const until = async (stage: string) => {
    for (let n = 0; n < 100; n++) { const record = await repository.get(runId); if (record?.steps.some(step => step.stepKey === stage && step.status === "running") || (stage === "passed" && record?.run.status === "passed")) return record!; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw new Error("CHECKPOINT_" + stage);
  };
  try {
    const config = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
    const started = await post('/api/v1/assisted/runs', { config, mode: "live", timeoutMs: 5000 });
    expect(started.status).toBe(202); runId = (await started.json()).runId;
    await until("ISSUE_CREDENTIAL");
    const leaseResponse = await originalFetch(base + '/api/v1/capture/local/session', { headers: { "x-capture-bridge-token": process.env.CAPTURE_BRIDGE_TOKEN! } });
    const { lease } = await leaseResponse.json();
    const unsafe = await post('/api/v1/capture/local/observations', { runId, leaseId: lease.leaseId, credential: 'CANARY_BODY' }, true);
    expect(unsafe.status).toBe(400); expect(await unsafe.text()).not.toContain('CANARY_');
    const wrongType = await originalFetch(base + '/api/v1/capture/local/observations', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-capture-bridge-token': process.env.CAPTURE_BRIDGE_TOKEN! }, body: 'CANARY_BODY' });
    expect(wrongType.status).toBe(415); expect(await wrongType.text()).not.toContain('CANARY_');
    expect((await post('/api/v1/capture/local/observations', { runId })).status).toBe(403);
    const vc = { type: ["VerifiableCredential", "FarmerCredential"], credentialSubject: { fullName: "CANARY_FULL_NAME", farmerID: "CANARY_FARMER", CANARY_UNKNOWN: "CANARY_PRIVATE" }, proof: { type: "Ed25519Signature2020", proofValue: "CANARY_SIGNATURE" } };
    // Exercise the actual forwarding capture wrapper: original bodies stay byte-identical.
    const { createServerCapture } = await import(new URL("../../../../scripts/local-server-capture.mjs", import.meta.url).href);
    const upstreamPayload = JSON.stringify({ credential: vc, access_token: "CANARY_ACCESS_TOKEN" });
    const forwarded: any[] = [];
    const forward = createServerCapture({ settings: { bffOrigin: base, token: process.env.CAPTURE_BRIDGE_TOKEN }, project: serverHopPublicView,
      fetchImpl: async (url: string, options: any) => { if (url.startsWith(base)) return originalFetch(url, options); forwarded.push({ url, options }); return new Response(upstreamPayload, { status: 200 }); } });
    const requestBody = Buffer.from('{"proof":{"jwt":"CANARY_PROOF"}}');
    const returned = await forward('http://mobile-certify:8090/v1/certify/issuance/credential', { method: "POST", body: requestBody, headers: { "content-type": "application/json", authorization: "Bearer CANARY_AUTH" } }, "certify");
    expect(await returned.text()).toBe(upstreamPayload);
    expect(forwarded[0].options.body).toEqual(requestBody);
    expect(forwarded[0].options.headers.authorization).toBe("Bearer CANARY_AUTH");
    await until("STORE");
    expect((await post(`/api/v1/assisted/runs/${runId}/observations`, { kind: "storage" })).status).toBe(202);
    await until("PRESENT_SUBMIT");
    const form = new URLSearchParams({ state, vp_token: "CANARY_VP_TOKEN" });
    await forward('http://verify-service:8080/v1/verify/vp-submission/direct-post', { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded" } }, "verify");
    const completed = await until("passed");
    expect(completed.run.serviceVersions).toMatchObject({ wallet: "0.17.0", issuer: "0.14.0", verifier: "0.18.2" });
    const serialized = [JSON.stringify(completed), JSON.stringify(emitted)];
    for (const route of ["", "/exchanges", "/report", "/capture/coverage"]) {
      const response = await originalFetch(base + `/api/v1/runs/${runId}` + route);
      expect(response.status).toBe(200); serialized.push(await response.text());
    }
    if (prisma) serialized.push(JSON.stringify(await prisma.exchange.findMany({ where: { runId } })));
    for (const value of serialized) {
      expect(value).not.toContain("CANARY_");
      expect(value).not.toContain(runCorrelationKey(runId).toString("hex"));
    }
    const coverage = await originalFetch(base + `/api/v1/runs/${runId}/capture/coverage`).then(r => r.json());
    expect(coverage.serverHops.find((row: any) => row.ruleId === "certify-credential").state).toBe("observed");
    expect(coverage.serverHops.find((row: any) => row.ruleId === "verify-submit").state).toBe("observed");
    expect(coverage.serverHops.find((row: any) => row.ruleId === "certify-token").state).toBe("not_observed");
    expect((await post('/api/v1/capture/local/observations', { runId, leaseId: lease.leaseId }, true)).status).toBe(409);
  } finally {
    if (runId) await post(`/api/v1/assisted/runs/${runId}/cancel`, {});
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (prisma) await prisma.run.deleteMany({ where: { id: runId } });
    await repository.disconnect();
    vi.unstubAllGlobals(); process.env = previous;
  }
}
it("forwards unchanged and binds synthetic issuance/storage/presentation/result to one run without API/socket leaks", async () => exercise(), 15000);
it.skipIf(!process.env.CAPTURE_POSTGRES_TEST_URL)("persists server-hop projections only in raw PostgreSQL rows and API/socket exports", async () => exercise(true), 15000);
