import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import type { Server as SocketServer } from "socket.io";
import type { RunSummary } from "@playground/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createSteps } from "../orchestrator.js";
import { MemoryRunRepository, PrismaRunRepository } from "../store.js";
import { CaptureError, prepareHarImport } from "./har.js";

const secret = "SECRET-SHOULD-NEVER-APPEAR";
const fourServiceHar = JSON.parse(readFileSync(new URL("./fixtures/four-service.synthetic.har.json", import.meta.url), "utf8"));
const savedImportResult = JSON.parse(readFileSync(new URL("./fixtures/four-service.import-result.json", import.meta.url), "utf8"));
const canary = /CANARY_[A-Z_]+/;
const origins = new Map([
  ["https://wallet.example", "mimoto"],
  ["https://issuer.example", "certify"],
  ["https://identity.example", "esignet"],
  ["https://verifier.example", "verify"],
] as const);

function fixture(id = randomUUID()) {
  const run: RunSummary = {
    id, parentRunId: null,
    config: { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null },
    status: "passed", expectedOutcome: "valid", actualOutcome: "valid", proofType: "Ed25519Signature2020", algorithm: "EdDSA",
    serviceVersions: { issuer: "fixture", wallet: "fixture", verifier: "fixture" }, createdAt: new Date().toISOString(), startedAt: null, finishedAt: new Date().toISOString(),
  };
  return { run, steps: createSteps(id), exchanges: [] };
}

function entry(url: string, mimeType = "application/json", text = JSON.stringify({
  proof: { jwt: secret, jwk: { d: secret, x: secret } },
  vp_token: secret, format: "ldp_vc", credentialSubject: { individualId: secret },
})) {
  return {
    startedDateTime: "2026-10-21T00:00:00.000Z", time: 45.4,
    request: { method: /\/vp-request\/|\/mimoto\/issuers/.test(url) ? "GET" : "POST", url, headers: [
      { name: "Authorization", value: `Bearer ${secret}` },
      { name: "Cookie", value: `sid=${secret}` },
      { name: "Content-Type", value: mimeType },
      { name: "X-Custom", value: secret },
    ], postData: { mimeType, text } },
    response: { status: 200, headers: [{ name: "Set-Cookie", value: `sid=${secret}` }], content: { mimeType, text } },
  };
}

function wrap(runId: string, entries: unknown[]) { return { runId, har: { log: { entries } } }; }

function withPublicEvidence(runId: string) {
  const payload = structuredClone(fourServiceHar);
  payload.runId = runId;
  payload.har.log.entries[3].response.content.text = JSON.stringify({
    allChecksSuccessful: false,
    credential: { type: ["VerifiableCredential", "FarmerCredential"], issuer: "https://issuer.example/issuer", credentialSubject: { name: "CANARY_PERSON" } },
    presentation_definition: { id: "CANARY_DEFINITION", input_descriptors: [{ constraints: { fields: [{ path: ["$.type"], filter: { const: "FarmerCredential" } }] } }] },
  });
  return payload;
}

describe("passive HAR capture", () => {
  it("imports the committed four-service fixture with stable IDs and a visible static-asset skip", () => {
    const record = fixture(fourServiceHar.runId);
    const first = prepareHarImport(fourServiceHar, record, origins);
    const second = prepareHarImport(fourServiceHar, record, origins);
    expect(first.exchanges).toHaveLength(4);
    expect(first.skipped).toBe(1);
    expect(first.exchanges.map(({ id }) => id)).toEqual(second.exchanges.map(({ id }) => id));
    expect(first.exchanges.map(({ actorTo }) => actorTo)).toEqual(["mimoto", "certify", "esignet", "verify"]);
    expect(first.exchanges.map(({ id }) => id)).toEqual(savedImportResult.exchanges.map(({ id }: { id: string }) => id));
    expect(first.exchanges.map(({ actorTo, stepId }) => ({ service: actorTo, stepKey: record.steps.find((step) => step.id === stepId)?.stepKey })))
      .toEqual(savedImportResult.exchanges.map(({ service, stepKey }: { service: string; stepKey: string }) => ({ service, stepKey })));
    expect(JSON.stringify(first)).not.toMatch(canary);
  });

  it("redacts headers, query and path values, JSON and form fields, and nested JWK material", () => {
    const record = fixture(fourServiceHar.runId);
    const { exchanges } = prepareHarImport(fourServiceHar, record, origins);
    const [mimoto, certify, esignet, verify] = exchanges;
    expect(mimoto?.url).toBe("https://wallet.example/v1/mimoto/issuers/{id}?state=[REDACTED]");
    expect(mimoto?.request).toMatchObject({ headers: { cookie: "[REDACTED]" } });
    expect(certify?.request).toMatchObject({ headers: { authorization: "[REDACTED]" }, body: { proof: { jwt: "[REDACTED]", jwk: { d: "[REDACTED]", x: "[REDACTED]" } }, format: "vc+sd-jwt" } });
    expect(certify?.response).toMatchObject({ headers: { "set-cookie": "[REDACTED]" }, body: { credential: "[REDACTED]" } });
    expect(esignet?.request).toMatchObject({ body: { code: "[REDACTED]", otp: "[REDACTED]" } });
    expect(verify?.response).toMatchObject({ body: { presentation_definition: { id: "[REDACTED]" }, nonce: "[REDACTED]" } });
    expect(JSON.stringify(exchanges)).not.toMatch(canary);
  });

  it("maps four services into existing steps while removing secrets before storage", async () => {
    const record = fixture();
    const entries = [
      entry(`https://wallet.example/v1/mimoto/issuers?code=${secret}`),
      entry(`https://issuer.example/credential?access_token=${secret}`),
      entry(`https://identity.example/oauth/token?state=${secret}`, "application/x-www-form-urlencoded", `code=${secret}&otp=${secret}`),
      entry(`https://verifier.example/vp-request/${secret}?request_uri=${secret}`),
    ];
    const result = prepareHarImport(wrap(record.run.id, entries), record, origins);
    expect(result.exchanges).toHaveLength(4);
    expect(result.exchanges.map((exchange) => record.steps.find((step) => step.id === exchange.stepId)?.stepKey)).toEqual([
      "ISSUE_OFFER", "ISSUE_CREDENTIAL", "ISSUE_TOKEN", "PRESENT_REQUEST",
    ]);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.exchanges[0]?.url).toContain("code=[REDACTED]");
    expect(result.exchanges[2]?.request).toMatchObject({ body: { code: "[REDACTED]", otp: "[REDACTED]" } });
    const repository = new MemoryRunRepository();
    await repository.create(record);
    expect(await repository.addExchanges(result.exchanges)).toBe(4);
    expect(JSON.stringify(await repository.get(record.run.id))).not.toContain(secret);
    expect(await repository.addExchanges(result.exchanges)).toBe(0);
  });

  it("rejects cross-run, untrusted origin, malformed and oversized evidence", () => {
    const record = fixture();
    expect(() => prepareHarImport(wrap(randomUUID(), []), record, origins)).toThrowError(CaptureError);
    expect(() => prepareHarImport(wrap(record.run.id, [entry("https://evil.example/credential")]), record, origins)).toThrowError(/CAPTURE_ORIGIN_NOT_ALLOWED/);
    expect(prepareHarImport(wrap(record.run.id, [{ request: { url: "broken" } }]), record, origins).skippedReasons).toEqual({ malformed_entry: 1 });
    expect(() => prepareHarImport(wrap(record.run.id, [entry("https://issuer.example/credential", "text/plain", "x".repeat(131_073))]), record, origins)).toThrowError(/CAPTURE_ENTRY_TOO_LARGE/);
    expect(() => prepareHarImport(wrap(record.run.id, Array.from({ length: 101 }, () => entry("https://issuer.example/credential"))), record, origins)).toThrowError(/CAPTURE_INVALID_HAR/);
  });

  it("withholds unknown field names as well as their values", () => {
    const record = fixture();
    const result = prepareHarImport(wrap(record.run.id, [entry(`https://issuer.example/credential?CANARY_QUERY_NAME=value`, "application/json", JSON.stringify({ CANARY_FIELD_NAME: "value", nested: { CANARY_NESTED_NAME: "value" } }))]), record, origins);
    expect(JSON.stringify(result)).not.toContain("CANARY_");
  });

  it("keeps malformed JSON body content out of imported exchanges", () => {
    const record = fixture();
    const badBody = `{ "credential": "${secret}"`;
    const result = prepareHarImport(wrap(record.run.id, [entry("https://issuer.example/credential", "application/json", badBody)]), record, origins);
    expect(result.exchanges[0]?.request).toMatchObject({ body: "[REDACTED: malformed JSON]" });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("counts malformed, unfinished, untagged, and duplicate entries without guessing step coverage", () => {
    const record = fixture();
    const valid = entry("https://issuer.example/credential");
    const result = prepareHarImport(wrap(record.run.id, [null, { broken: true }, { ...valid, response: { ...valid.response, status: 0 } }, entry("https://identity.example/login"), valid, valid]), record, origins);
    expect(result.skippedReasons).toEqual({ malformed_entry: 2, unfinished_request: 1, untagged: 1, duplicate: 1 });
    expect(result.exchanges).toHaveLength(1);
    expect(result.coverage.find(({ stepKey }) => stepKey === "ISSUE_CREDENTIAL")).toMatchObject({ state: "captured", count: 1 });
    expect(result.coverage.find(({ stepKey }) => stepKey === "STORE")?.state).toBe("not_observable");
    expect(result.coverage.find(({ stepKey }) => stepKey === "PRESENT_RESULT")?.state).toBe("missing");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("sorts browser entries and redacts base64 bodies with unknown HAR timing", () => {
    const record = fixture();
    const encoded = {
      ...entry("https://verifier.example/vp-request/synthetic"),
      startedDateTime: "2026-10-22T09:00:02.000Z",
      time: -1,
      response: { status: 200, headers: [], content: {
        mimeType: "application/json", encoding: "base64",
        text: Buffer.from(JSON.stringify({ nonce: secret, response_mode: "direct_post" })).toString("base64"),
      } },
    };
    const earlier = { ...entry("https://issuer.example/credential"), startedDateTime: "2026-10-22T09:00:01.000Z" };
    const result = prepareHarImport(wrap(record.run.id, [encoded, earlier]), record, origins);
    expect(result.exchanges.map(({ actorTo }) => actorTo)).toEqual(["certify", "verify"]);
    expect(result.exchanges[1]?.durationMs).toBe(0);
    expect(result.exchanges[1]?.response).toMatchObject({ body: { nonce: "[REDACTED]", response_mode: "direct_post" } });
    expect(JSON.stringify(result)).not.toContain(secret);
    const malformed = { ...encoded, response: { ...encoded.response, content: { ...encoded.response.content, text: "not base64!!!" } } };
    expect(prepareHarImport(wrap(record.run.id, [malformed]), record, origins).exchanges[0]?.response)
      .toMatchObject({ body: "[REDACTED: malformed base64]" });
  });
});

describe("capture API", () => {
  let server: Server | undefined;
  afterEach(async () => { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); server = undefined; });

  it("returns only sanitized exchanges from the inspector endpoint", async () => {
    const repository = new MemoryRunRepository();
    const record = fixture();
    await repository.create(record);
    const previous = process.env.CAPTURE_ORIGINS_JSON;
    process.env.CAPTURE_ORIGINS_JSON = JSON.stringify(Object.fromEntries(origins));
    try {
      const emitted: unknown[] = [];
      const io = { of: () => ({ to: () => ({ emit: (...args: unknown[]) => { emitted.push(args); } }) }) } as unknown as SocketServer;
      server = buildApp(() => io, repository).listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No address");
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${base}/api/v1/runs/${record.run.id}/capture/har`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(withPublicEvidence(record.run.id)),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ imported: 4, skipped: 1 });
      const exchanges = await fetch(`${base}/api/v1/runs/${record.run.id}/exchanges`).then((item) => item.text());
      expect(exchanges).not.toMatch(canary);
      expect(exchanges).toContain("har_import");
      expect(exchanges).toContain("verifiable_credential");
      expect(exchanges).toContain("FarmerCredential");
      expect(JSON.stringify(await repository.get(record.run.id))).not.toMatch(canary);
      expect(emitted).toHaveLength(4);
      expect(JSON.stringify(emitted)).not.toMatch(canary);
      const mismatch = await fetch(`${base}/api/v1/runs/${record.run.id}/capture/har`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(wrap(randomUUID(), [])),
      });
      expect(mismatch.status).toBe(409);
      const malformed = await fetch(`${base}/api/v1/runs/${record.run.id}/capture/har`, {
        method: "POST", headers: { "content-type": "application/json" }, body: `{ "token": "${secret}"`,
      });
      expect(malformed.status).toBe(400);
      expect(await malformed.text()).not.toContain(secret);
    } finally {
      if (previous === undefined) delete process.env.CAPTURE_ORIGINS_JSON;
      else process.env.CAPTURE_ORIGINS_JSON = previous;
    }
  });
  it("rejects wrong content types, oversized/malformed JSON, and excessive attempts without echoing bodies", async () => {
    const repository = new MemoryRunRepository();
    const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as SocketServer;
    server = buildApp(() => io, repository).listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    const url = `http://127.0.0.1:${address.port}/api/v1/runs/${randomUUID()}/capture/har`;
    const wrong = await fetch(url, { method: "POST", headers: { "content-type": "text/plain" }, body: secret });
    expect(wrong.status).toBe(415);
    expect(await wrong.text()).not.toContain(secret);
    const malformed = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: `{ "secret": "${secret}"` });
    expect(malformed.status).toBe(400);
    expect(await malformed.text()).not.toContain(secret);
    const large = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: secret.repeat(100_000) }) });
    expect(large.status).toBe(413);
    expect(await large.text()).not.toContain(secret);
    const trailing = await fetch(`${url}/`, { method: "POST", headers: { "content-type": "application/json" }, body: `{ "secret": "${secret}"` });
    expect(trailing.status).toBe(400);
    expect(await trailing.text()).not.toContain(secret);
    for (let i = 0; i < 6; i++) {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${i}` }, body: "{}" });
      expect(response.status).toBe(404);
    }
    const limited = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.200" }, body: "{}" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(await limited.json()).toEqual({ code: "CAPTURE_RATE_LIMITED" });
  });

});

describe.skipIf(!process.env.CAPTURE_POSTGRES_TEST_URL)("capture PostgreSQL persistence", () => {
  it("stores only sanitized fixture exchanges in database rows", async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.CAPTURE_POSTGRES_TEST_URL! } } });
    const repository = new PrismaRunRepository(prisma);
    const record = fixture();
    const payload = withPublicEvidence(record.run.id);
    try {
      await repository.create(record);
      const { exchanges } = prepareHarImport(payload, record, origins);
      expect(await repository.addExchanges(exchanges)).toBe(4);
      const rows = await prisma.exchange.findMany({ where: { runId: record.run.id } });
      expect(rows).toHaveLength(4);
      expect(JSON.stringify(rows)).not.toMatch(canary);
      expect(JSON.stringify(rows)).toContain("verifiable_credential");
      expect(JSON.stringify(await repository.get(record.run.id))).not.toMatch(canary);
      expect(await repository.addExchanges(exchanges)).toBe(0);
    } finally {
      await prisma.run.deleteMany({ where: { id: record.run.id } });
      await repository.disconnect();
    }
  });
});
