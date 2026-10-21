import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Server as SocketServer } from "socket.io";
import type { RunSummary } from "@playground/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createSteps } from "../orchestrator.js";
import { MemoryRunRepository } from "../store.js";
import { CaptureError, prepareHarImport } from "./har.js";

const secret = "SECRET-SHOULD-NEVER-APPEAR";
const origins = new Map([
  ["https://wallet.example", "mimoto"],
  ["https://issuer.example", "certify"],
  ["https://identity.example", "esignet"],
  ["https://verifier.example", "verify"],
] as const);

function fixture() {
  const id = randomUUID();
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
    request: { method: "POST", url, headers: [
      { name: "Authorization", value: `Bearer ${secret}` },
      { name: "Cookie", value: `sid=${secret}` },
      { name: "Content-Type", value: mimeType },
      { name: "X-Custom", value: secret },
    ], postData: { mimeType, text } },
    response: { status: 200, headers: [{ name: "Set-Cookie", value: `sid=${secret}` }], content: { mimeType, text } },
  };
}

function wrap(runId: string, entries: unknown[]) { return { runId, har: { log: { entries } } }; }

describe("passive HAR capture", () => {
  it("maps four services into existing steps while removing secrets before storage", async () => {
    const record = fixture();
    const entries = [
      entry(`https://wallet.example/v1/mimoto/issuers?code=${secret}`),
      entry(`https://issuer.example/credential?access_token=${secret}`),
      entry(`https://identity.example/oauth/authorize?state=${secret}`, "application/x-www-form-urlencoded", `code=${secret}&otp=${secret}`),
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
    expect(() => prepareHarImport(wrap(record.run.id, [{ request: { url: "broken" } }]), record, origins)).toThrowError(/CAPTURE_INVALID_HAR/);
    expect(() => prepareHarImport(wrap(record.run.id, [entry("https://issuer.example/credential", "text/plain", "x".repeat(131_073))]), record, origins)).toThrowError(/CAPTURE_ENTRY_TOO_LARGE/);
    expect(() => prepareHarImport(wrap(record.run.id, Array.from({ length: 101 }, () => entry("https://issuer.example/credential"))), record, origins)).toThrowError(/CAPTURE_INVALID_HAR/);
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
      const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as SocketServer;
      server = buildApp(() => io, repository).listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No address");
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${base}/api/v1/runs/${record.run.id}/capture/har`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(wrap(record.run.id, [entry(`https://issuer.example/credential?code=${secret}`)])),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ imported: 1, skipped: 0 });
      const exchanges = await fetch(`${base}/api/v1/runs/${record.run.id}/exchanges`).then((item) => item.text());
      expect(exchanges).not.toContain(secret);
      expect(exchanges).toContain("har_import");
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
});
