import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Server as HttpServer } from "node:http";
import type { Server } from "socket.io";
import { afterEach, describe, expect, it } from "vitest";
import type { RunConfig, RunSummary } from "@playground/shared";
import { createMockIssuer } from "@playground/mock-issuer/app";
import { loadIssuerSigner } from "@playground/mock-issuer/signing";
import { createMockVerifier } from "@playground/mock-verifier/app";
import { MemoryRunRepository, PrismaRunRepository, type RunRepository } from "./store.js";
import { createSteps, runDemo } from "./orchestrator.js";
import { createCollabDrivers } from "./drivers/collab.js";
import { buildReport, renderMarkdown } from "./report.js";
import { latestMatrix } from "./matrix.js";
const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as Server;
const servers: HttpServer[] = [];
async function listen(server: HttpServer) {
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No listener");
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  delete process.env.MOCK_ISSUER_BASE_URL; delete process.env.MOCK_VERIFIER_BASE_URL; delete process.env.MOCK_ISSUER_ENABLE_TEST_CASES;
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); })));
});
async function execute(tamper: RunConfig["tamper"], external: boolean, repository: RunRepository = new MemoryRunRepository()) {
  if (external) {
    let issuerUrl = "", verifierUrl = "";
    issuerUrl = await listen(createMockIssuer({ publicBaseUrl: () => issuerUrl, enableTestCases: true, signer: await loadIssuerSigner({ issuerUrl: "http://issuer.test" }) }));
    verifierUrl = await listen(createMockVerifier({ publicBaseUrl: () => verifierUrl }));
    process.env.MOCK_ISSUER_BASE_URL = issuerUrl; process.env.MOCK_VERIFIER_BASE_URL = verifierUrl; process.env.MOCK_ISSUER_ENABLE_TEST_CASES = "true";
  }
  const id = randomUUID();
  const config: RunConfig = { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", tamper, scenarioId: null };
  const run: RunSummary = { id, parentRunId: null, config, status: "pending", expectedOutcome: tamper ? "invalid" : "valid", actualOutcome: null, proofType: "kb+jwt", algorithm: "EdDSA", serviceVersions: { issuer: "test-mock/1", wallet: "reference-wallet/0.1", verifier: "test-mock/1" }, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null };
  await repository.create({ run, steps: createSteps(id), exchanges: [] });
  await runDemo(id, io, repository, 0, createCollabDrivers(config));
  return (await repository.get(id))!;
}
describe.each([false, true])("BFF controlled protocol integration (HTTP=%s)", (external) => {
  it.each([null, "bad_signature", "expired", "wrong_type", "missing_disclosure", "replay_nonce"] as const)("evaluates %s at the expected reason and persists its report", async (tamper) => {
    const record = await execute(tamper, external);
    expect(record.run.status).toBe("passed");
    expect(record.run.evaluation?.verdict).toBe(tamper ? "correct_rejection" : "correct_acceptance");
    expect(record.run.protocolProfile).toBe("mock-sdjwt-flat-v1"); expect(record.run.issuerRepresentation).toBe("did:jwk");
    if (tamper) expect(record.run.evaluation?.observed.code).toBe(record.run.evaluation?.expected.code);
    const report = buildReport(record);
    expect(renderMarkdown(report)).toContain(`Reason evaluation: **${record.run.evaluation?.verdict}**`);
    expect(latestMatrix([record.run])[0]?.evaluation?.verdict).toBe(record.run.evaluation?.verdict);
    expect(JSON.stringify(report).includes("~")).toBe(false);
    expect(record.steps.find((step) => step.stepKey === "REPORT")?.summary?.protocolEvaluation).toEqual(record.run.evaluation);
  });
});

describe.skipIf(!process.env.CAPTURE_POSTGRES_TEST_URL)("protocol PostgreSQL persistence", () => {
  it("reconstructs all six evaluations and matrix identities after reconnecting", async () => {
    const url = process.env.CAPTURE_POSTGRES_TEST_URL!;
    const writer = new PrismaClient({ datasources: { db: { url } } });
    const reader = new PrismaClient({ datasources: { db: { url } } });
    const records = [];
    try {
      for (const fault of [null, "bad_signature", "expired", "wrong_type", "missing_disclosure", "replay_nonce"] as const) records.push(await execute(fault, false, new PrismaRunRepository(writer)));
      await writer.$disconnect();
      const repository = new PrismaRunRepository(reader), ids = new Set(records.map(({ run }) => run.id));
      for (const record of records) {
        const loaded = (await repository.get(record.run.id))!;
        expect(loaded.run.status).toBe("passed");
        expect(loaded.run.evaluation).toEqual(record.run.evaluation);
        expect(loaded.run.protocolProfile).toBe("mock-sdjwt-flat-v1");
        expect(loaded.run.issuerRepresentation).toBe("did:jwk");
        expect(buildReport(loaded).run.evaluation).toEqual(record.run.evaluation);
        expect(JSON.stringify(loaded.exchanges)).not.toContain("~");
      }
      const persisted = (await repository.list()).filter(({ id }) => ids.has(id));
      expect(latestMatrix(persisted)).toHaveLength(6);
      expect(persisted.every(({ evaluation }) => evaluation?.verdict === "correct_acceptance" || evaluation?.verdict === "correct_rejection")).toBe(true);
    } finally {
      await reader.run.deleteMany({ where: { id: { in: records.map(({ run }) => run.id) } } });
      await Promise.all([reader.$disconnect(), writer.$disconnect()]);
    }
  });
});
