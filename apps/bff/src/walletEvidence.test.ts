import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import type { Server as HttpServer } from "node:http";
import type { Server } from "socket.io";
import { buildApp } from "./app.js";
import { MemoryRunRepository, type RunRecord } from "./store.js";
import { buildReport, renderMarkdown } from "./report.js";
import { matrixCells, renderMatrixCsv } from "./matrix.js";
import { walletEvidence } from "./walletEvidence.js";
let server: HttpServer; let base: string; let repository: MemoryRunRepository;
beforeEach(async () => {
  repository = new MemoryRunRepository();
  const io = { of: () => ({ to: () => ({ emit: () => {} }) }) } as unknown as Server;
  server = buildApp(() => io, repository).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error();
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
it("exposes Web and Android observations without fabricating run history or changing managed cells", async () => {
  const evidence = await fetch(`${base}/api/v1/wallet-evidence`).then(r => r.json());
  expect(evidence.items.map((item: any) => item.wallet)).toEqual(["inji_web", "inji_mobile"]);
  expect(evidence.items.every((item: any) => item.managedRunId === null && item.managedValidation === "pending")).toBe(true);
  expect(await repository.list()).toEqual([]);
  const matrix = await fetch(`${base}/api/v1/matrix`).then(r => r.json());
  expect(matrix.items).toEqual([]); expect(matrix.walletEvidence).toHaveLength(2);
  const cells = await fetch(`${base}/api/v1/matrix/cells`).then(r => r.json());
  expect(cells.items.every((cell: any) => cell.status === "not_tested" && cell.runId === null)).toBe(true);
  expect(cells.items.find((cell: any) => cell.config.wallet === "inji_web_assisted").manualEvidenceIds).toEqual([walletEvidence[0]!.id]);
  expect(cells.items.filter((cell: any) => cell.config.wallet === "reference_wallet").every((cell: any) => cell.manualEvidenceIds.length === 0)).toBe(true);
});
it("exports provenance, distinct wallet identity and limits in all formats", async () => {
  for (const format of ["json", "md", "csv"]) {
    const response = await fetch(`${base}/api/v1/wallet-evidence/report?format=${format}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`real-wallet-evidence.${format}`);
    const text = await response.text(); expect(text).toContain("manual_wallet_observation"); expect(text).toContain("user_confirmed"); expect(text).toContain("pending");
    const matrix = await fetch(`${base}/api/v1/matrix/export?format=${format}`).then(r => r.text());
    expect(matrix).toContain(walletEvidence[0]!.id); expect(matrix).toContain(walletEvidence[1]!.id);
  }
  expect((await fetch(`${base}/api/v1/wallet-evidence/report?format=html`)).status).toBe(400);
  const csv = renderMatrixCsv([], walletEvidence).trim().split("\n"); expect(csv).toHaveLength(3);
  expect(csv.slice(1).every(line => line.startsWith('"","inji_certify"'))).toBe(true);
});
it("does not promote a run using unrelated manual acceptance", () => {
  const record: RunRecord = { run: { id: "synthetic-run", parentRunId: null, config: { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null }, status: "errored", expectedOutcome: "valid", actualOutcome: "error", proofType: "Ed25519Signature2020", algorithm: "EdDSA", createdAt: "2026-10-24T00:00:00Z", startedAt: null, finishedAt: null }, steps: [], exchanges: [] };
  const report = buildReport(record, walletEvidence);
  expect(report.run.actualOutcome).toBe("error"); expect(report.evidence.tier).toBe("unverified");
  expect(report.relatedWalletEvidence.map(item => item.id)).toEqual([walletEvidence[0]!.id]);
  expect(renderMarkdown(report)).toContain("not evidence for this run");
  expect(buildReport({ ...record, run: { ...record.run, config: { ...record.run.config, wallet: "reference_wallet" } } }, walletEvidence).relatedWalletEvidence).toEqual([]);
  expect(matrixCells([record.run], walletEvidence).find(cell => cell.config.wallet === "inji_web_assisted")?.status).toBe("errored");
});
it("references committed artifacts and preserves user-confirmed mobile persistence", () => {
  for (const item of walletEvidence) for (const artifact of item.artifacts) {
    expect(artifact.url).toMatch(/^https:\/\/github\.com\/oki-dokii\/mosip\/blob\/[a-f0-9]{7,40}\/submission\//);
    const relative = new URL(artifact.url).pathname.split("/").slice(5).join("/");
    expect(existsSync(new URL(`../../../${relative}`, import.meta.url))).toBe(true);
  }
  const mobile = JSON.parse(readFileSync(new URL("../../../submission/evidence/person3-a2-mobile-2026-10-23/attempt.json", import.meta.url), "utf8"));
  expect(mobile.bffRunId).toBeNull();
  expect(mobile.checkpoints.find((c: any) => c.step === "storage_after_close_and_reopen").status).toBe("user_confirmed");
  expect(walletEvidence[1]!.checkpoints.find(c => c.name === "Persistent storage")?.evidence).toBe("user_confirmed");
});
