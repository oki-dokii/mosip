import { LocalCaptureLease, prepareServerObservation, serverCoverage } from "./capture/local-server.js";
import { walletEvidence, renderWalletEvidenceMarkdown, renderWalletEvidenceCsv } from "./walletEvidence.js";
import { withExchangeLock } from "./exchangeLock.js";
import { AssistedRuns } from "./assisted.js";
import { captureOrigins } from "./capture/har.js";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import type { Server } from "socket.io";
import { runConfigSchema, tamperKindSchema, type ImplementationMetadata, type RunConfig, type RunSummary } from "@playground/shared";
import { z } from "zod";
import { configuredDriverMode } from "./drivers/registry.js";
import { createSteps, runDemo } from "./orchestrator.js";
import { buildReport, renderMarkdown } from "./report.js";
import { buildSequence } from "./sequence.js";
import { matrixCells, latestMatrix, renderMatrixCsv, renderMatrixMarkdown } from "./matrix.js";
import { filterRuns } from "./history.js";
import { unsupportedReason } from "./capabilities.js";
import { snapshotVersions } from "./versions.js";
import type { RunRepository } from "./store.js";
import { browserCoverage, CaptureError, prepareHarImport } from "./capture/har.js";
import { CaptureRateGate, captureIngress } from "./capture/ingress.js";
import { prepareLiveObservation, validBridgeToken } from "./capture/live-bridge.js";
import { listScenarios, scenarioMismatch } from "./scenarios.js";

const metadata: ImplementationMetadata = {
  issuers: [
    { id: "inji_certify", name: "Inji Certify", kind: "inji" },
    { id: "mock_issuer", name: "Mock issuer", kind: "external" },
  ],
  wallets: [
    { id: "reference_wallet", name: "Reference Wallet", kind: "reference" },
    { id: "inji_web_assisted", name: "Inji Web (assisted)", kind: "inji" },
  ],
  verifiers: [
    { id: "inji_verify", name: "Inji Verify", kind: "inji" },
    { id: "mock_verifier", name: "Mock verifier", kind: "external" },
  ],
  formats: [
    { id: "vc_sd_jwt", name: "SD-JWT VC", proofType: "kb+jwt", algorithm: "EdDSA" },
    { id: "ldp_vc", name: "W3C VC JSON-LD", proofType: "Ed25519Signature2020", algorithm: "EdDSA" },
  ],
};

const replaySchema = z.object({ tamper: tamperKindSchema.nullable().default(null) });

function createRun(config: RunConfig, parentRunId: string | null = null): RunSummary {
  const id = randomUUID();
  const format = metadata.formats.find((item) => item.id === config.format)!;
  return {
    id,
    parentRunId,
    config,
    status: "pending",
    expectedOutcome: config.tamper ? "invalid" : "valid",
    actualOutcome: null,
    proofType: format.proofType,
    algorithm: format.algorithm,
    serviceVersions: snapshotVersions(config, configuredDriverMode()),
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

function startRun(runId: string, getIo: () => Server, repository: RunRepository) {
  setTimeout(() => {
    void runDemo(runId, getIo(), repository).catch((error: unknown) => {
      console.error(`Run ${runId} failed`, error);
    });
  }, 25);
}

export function buildApp(getIo: () => Server, repository: RunRepository) {
  const app = express();
  const importingRuns = new Set<string>();
  const localLease = new LocalCaptureLease();
  const assisted = new AssistedRuns(repository, getIo, localLease);
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use("/api/v1/runs/:id/capture/har", captureIngress(), express.json({ limit: "2mb" }));
  app.use("/api/v1/assisted/runs/:id/capture/observation", captureIngress(), (request, response, next) => {
    if (!validBridgeToken(request.get("x-capture-bridge-token"))) return response.status(403).json({ code: "CAPTURE_BRIDGE_FORBIDDEN" });
    next();
  }, express.json({ limit: "16kb" }));
  app.use("/api/v1/capture/local", (request, response, next) => {
    response.locals.captureRequest = true;
    if (process.env.ASSISTED_LOCAL_PROFILE !== "jsonld-0.14" || !validBridgeToken(request.get("x-capture-bridge-token"))) return response.status(403).json({ code: "LOCAL_CAPTURE_FORBIDDEN" });
    next();
  }, captureIngress(new CaptureRateGate(120)), express.json({ limit: "32kb" }));
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/v1/capture/local/session", (_request, response) => {
    const lease = localLease.snapshot();
    response.set("Cache-Control", "no-store").json({ lease: lease && assisted.live(lease.runId) ? lease : null });
  });
  app.post("/api/v1/capture/local/observations", async (request, response, next) => {
    try {
      const { runId, leaseId } = request.body ?? {};
      if (!localLease.matches(runId, leaseId) || !assisted.live(runId)) return response.status(409).json({ code: "LOCAL_CAPTURE_LEASE_EXPIRED" });
      await withExchangeLock(repository, runId, async () => {
        if (!localLease.matches(runId, leaseId) || !assisted.live(runId)) throw new CaptureError("LOCAL_CAPTURE_LEASE_EXPIRED", 409);
        const record = await repository.get(runId);
        if (!record) throw new CaptureError("LOCAL_CAPTURE_RUN_MISSING", 404);
        const exchange = prepareServerObservation(request.body, record);
        const existing = record.exchanges.find(item => item.id === exchange.id);
        if (existing && JSON.stringify({ ...existing, seq: 0 }) !== JSON.stringify({ ...exchange, seq: 0 })) throw new CaptureError("LOCAL_CAPTURE_ID_CONFLICT", 409);
        const added = await repository.addExchanges([exchange]);
        if (added) getIo().of("/runs").to(`run:${runId}`).emit("exchange:recorded", {
          runId, exchangeId: exchange.id, seq: exchange.seq, actorFrom: exchange.actorFrom, actorTo: exchange.actorTo,
          method: exchange.method, url: exchange.url, status: exchange.status, durationMs: exchange.durationMs,
        });
        response.status(202).json({ exchangeId: exchange.id, accepted: added === 1 });
      });
    } catch (error) { if (error instanceof CaptureError) return response.status(error.status).json({ code: error.code }); next(error); }
  });

  app.get("/api/v1/assisted/capabilities", (_request, response) => response.json({ liveAvailable: assisted.available(), fixtureAvailable: true }));
  app.post("/api/v1/assisted/runs", async (request, response, next) => {
    const parsed = z.object({ config: runConfigSchema, mode: z.enum(["fixture", "live"]), timeoutMs: z.number().int().min(100).max(300000).optional() }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ code: "VALIDATION_FAILED" });
    try { const runId = await assisted.start(parsed.data.config, parsed.data.mode, parsed.data.timeoutMs); return response.status(202).json({ runId }); }
    catch (error) { if (error instanceof Error && error.message.startsWith("ASSISTED_")) return response.status(422).json({ code: error.message }); next(error); }
  });
  app.get("/api/v1/assisted/runs/:id", async (request, response, next) => {
    try { const result = await assisted.status(request.params.id); return result ? response.json(result) : response.status(404).json({ code: "RUN_NOT_FOUND" }); } catch (error) { next(error); }
  });
  app.post("/api/v1/assisted/runs/:id/cancel", async (request, response, next) => {
    try { const result = await assisted.cancel(request.params.id); return result ? response.status(202).json(result) : response.status(404).json({ code: "RUN_NOT_FOUND" }); } catch (error) { next(error); }
  });
  app.post("/api/v1/assisted/runs/:id/observations", async (request, response, next) => {
    const parsed = z.object({ kind: z.enum(["issuance", "storage", "presentation"]) }).strict().safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ code: "VALIDATION_FAILED" });
    try { await assisted.observe(request.params.id, parsed.data.kind); return response.status(202).json({ accepted: true }); }
    catch (error) { if (error instanceof Error && error.message.startsWith("ASSISTED_")) return response.status(409).json({ code: error.message }); next(error); }
  });
  app.post("/api/v1/assisted/runs/:id/capture/observation", async (request, response, next) => {
    const runId = request.params.id;
    try {
      if (!assisted.live(runId)) return response.status(409).json({ code: "ASSISTED_LIVE_INACTIVE" });
      return await withExchangeLock(repository, runId, async () => {
        if (!assisted.live(runId)) return response.status(409).json({ code: "ASSISTED_LIVE_INACTIVE" });
        const record = await repository.get(runId);
        if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
        const exchange = prepareLiveObservation(request.body, record, captureOrigins());
        const imported = await repository.addExchanges([exchange]);
        if (imported) getIo().of("/runs").to(`run:${runId}`).emit("exchange:recorded", {
          runId, exchangeId: exchange.id, seq: exchange.seq, actorFrom: exchange.actorFrom,
          actorTo: exchange.actorTo, method: exchange.method, url: exchange.url,
          status: exchange.status, durationMs: exchange.durationMs, redactionCount: new Set(exchange.redactions).size,
        });
        return response.status(202).json({ accepted: imported === 1, duplicate: imported === 0,
          exchangeId: exchange.id, ruleId: (exchange.request as { capture: { ruleId: string } }).capture.ruleId });
      });
    } catch (error) {
      if (error instanceof CaptureError) return response.status(error.status).json({ code: error.code });
      next(error);
    }
  });
  app.get("/api/v1/runs/:id/capture/coverage", async (request, response, next) => {
    try { const record = await repository.get(request.params.id); return record ? response.json({ coverage: browserCoverage(record), serverHops: serverCoverage(record) }) : response.status(404).json({ code: "RUN_NOT_FOUND" }); } catch (error) { next(error); }
  });

  app.get("/api/v1/health", (_request, response) => {
    response.json({
      services: [{ name: "playground", status: "up", version: "0.2.0", latencyMs: 0 }],
      storage: repository.storage,
      driverMode: configuredDriverMode(),
    });
  });

  app.get("/api/v1/meta/implementations", (_request, response) => response.json(metadata));
  app.get("/api/v1/scenarios", (_request, response) => response.json({ items: listScenarios(configuredDriverMode()) }));
  app.get("/api/v1/wallet-evidence", (_request, response) => response.json({ schemaVersion: 1, items: walletEvidence }));
  app.get("/api/v1/wallet-evidence/report", (request, response) => {
    const format = request.query.format ?? "json";
    if (!["json", "md", "csv"].includes(String(format))) return response.status(400).json({ code: "UNSUPPORTED_REPORT_FORMAT" });
    response.setHeader("content-disposition", `attachment; filename=real-wallet-evidence.${format}`);
    if (format === "md") return response.type("text/markdown").send(renderWalletEvidenceMarkdown(walletEvidence));
    if (format === "csv") return response.type("text/csv").send(renderWalletEvidenceCsv(walletEvidence));
    return response.json({ schemaVersion: 1, recordKind: "manual_wallet_observation", items: walletEvidence });
  });
  app.get("/api/v1/matrix/cells", async (_request, response, next) => { try { response.json({ items: matrixCells(await repository.list(), walletEvidence) }); } catch (error) { next(error); } });
  app.get("/api/v1/matrix", async (_request, response, next) => {
    try {
      response.json({ items: latestMatrix(await repository.list()), walletEvidence });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/matrix/export", async (request, response, next) => {
    try {
      const format = request.query.format ?? "csv";
      const runs = await repository.list();
      if (format === "json") return response.json({ items: latestMatrix(runs), walletEvidence });
      if (format === "csv") {
        response.setHeader("content-disposition", "attachment; filename=interoperability-matrix.csv");
        return response.type("text/csv").send(renderMatrixCsv(runs, walletEvidence));
      }
      if (format === "md") {
        response.setHeader("content-disposition", "attachment; filename=interoperability-matrix.md");
        return response.type("text/markdown").send(renderMatrixMarkdown(runs, walletEvidence));
      }
      return response.status(400).json({ code: "UNSUPPORTED_MATRIX_FORMAT" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/runs", async (_request, response, next) => {
    try {
      const allowed = ["issuer", "wallet", "verifier", "format", "status", "tamper", "issuerVersion", "verifierVersion"] as const;
      const filters = Object.fromEntries(allowed.flatMap((key) => typeof _request.query[key] === "string" ? [[key, _request.query[key]]] : []));
      response.json({ items: filterRuns(await repository.list(), filters) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/runs", async (request, response, next) => {
    const parsed = runConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).type("application/problem+json").json({
        type: "https://playground/errors/validation-failed",
        title: "Run configuration is invalid",
        status: 400,
        code: "VALIDATION_FAILED",
        detail: parsed.error.flatten(),
      });
      return;
    }
    const mismatch = scenarioMismatch(parsed.data);
    if (mismatch) return response.status(422).json({ code: mismatch });
    const selectedScenario = parsed.data.scenarioId ? listScenarios(configuredDriverMode()).find((item) => item.id === parsed.data.scenarioId) : null;
    if (selectedScenario && !selectedScenario.available) return response.status(422).json({ code: "SCENARIO_UNAVAILABLE", detail: selectedScenario.unavailableReason });
    const reason = unsupportedReason(parsed.data, configuredDriverMode());
    if (reason) return response.status(422).json({ code: "UNSUPPORTED_COMBINATION", detail: reason });
    if (parsed.data.wallet === "inji_web_assisted") return response.status(422).json({ code: "USE_ASSISTED_API" });
    const run = createRun(parsed.data);
    try {
      await repository.create({ run, steps: createSteps(run.id), exchanges: [] });
      response.status(202).json({ runId: run.id });
      startRun(run.id, getIo, repository);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/runs/:id/replay", async (request, response, next) => {
    const parsed = replaySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      response.status(400).json({ code: "VALIDATION_FAILED", detail: parsed.error.flatten() });
      return;
    }
    try {
      const source = await repository.get(request.params.id);
      if (!source) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      if (source.run.config.wallet === "inji_web_assisted") return response.status(422).json({ code: "USE_ASSISTED_API" });
      if (source.run.status !== "passed" && source.run.status !== "failed") {
        return response.status(409).json({ code: "RUN_NOT_REPLAYABLE" });
      }
      const config: RunConfig = { ...source.run.config, tamper: parsed.data.tamper, scenarioId: null };
      const reason = unsupportedReason(config, configuredDriverMode());
      if (reason) return response.status(422).json({ code: "UNSUPPORTED_COMBINATION", detail: reason });
      const run = createRun(config, source.run.id);
      await repository.create({ run, steps: createSteps(run.id), exchanges: [] });
      response.status(202).json({ runId: run.id });
      startRun(run.id, getIo, repository);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/runs/:id", async (request, response, next) => {
    try {
      const record = await repository.get(request.params.id);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      response.json(record.run);
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/runs/:id/steps", async (request, response, next) => {
    try {
      const record = await repository.get(request.params.id);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      response.json({ items: record.steps });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/runs/:id/exchanges", async (request, response, next) => {
    try {
      const record = await repository.get(request.params.id);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      const stepId = typeof request.query.stepId === "string" ? request.query.stepId : null;
      response.json({ items: stepId ? record.exchanges.filter((item) => item.stepId === stepId) : record.exchanges });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/runs/:id/capture/har", async (request, response, next) => {
    const runId = request.params.id;
    if (importingRuns.has(runId)) return response.status(409).json({ code: "CAPTURE_IMPORT_ACTIVE" });
    importingRuns.add(runId);
    try {
      return await withExchangeLock(repository, runId, async () => {
      const record = await repository.get(runId);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      if (record.run.recordKind === "archived_evidence") return response.status(409).json({ code: "ARCHIVED_EVIDENCE_READ_ONLY" });
      const prepared = prepareHarImport(request.body, record, captureOrigins(), assisted.active(record.run.id));
      const imported = await repository.addExchanges(prepared.exchanges);
      const saved = await repository.get(runId);
      const storedIds = new Set(saved?.exchanges.map(({ id }) => id) ?? []);
      for (const exchange of prepared.exchanges.filter(({ id }) => storedIds.has(id))) {
        getIo().of("/runs").to(`run:${runId}`).emit("exchange:recorded", {
          runId, exchangeId: exchange.id, seq: exchange.seq, actorFrom: exchange.actorFrom,
          actorTo: exchange.actorTo, method: exchange.method, url: exchange.url,
          status: exchange.status, durationMs: exchange.durationMs, redactionCount: new Set(exchange.redactions).size,
        });
      }
      return response.json({ imported, skipped: prepared.skipped + prepared.exchanges.length - imported, skippedReasons: { ...prepared.skippedReasons, ...(prepared.exchanges.length > imported ? { persistence_conflict: prepared.exchanges.length - imported } : {}) }, coverage: saved ? browserCoverage(saved) : prepared.coverage, gaps: prepared.gaps });
      });
    } catch (error) {
      if (error instanceof CaptureError) return response.status(error.status).json({ code: error.code });
      next(error);
    } finally {
      importingRuns.delete(runId);
    }
  });

  app.get("/api/v1/runs/:id/report", async (request, response, next) => {
    try {
      const record = await repository.get(request.params.id);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      const format = request.query.format ?? "json";
      if (format !== "json" && format !== "md") return response.status(400).json({ code: "UNSUPPORTED_REPORT_FORMAT" });
      const report = buildReport(record, walletEvidence);
      const extension = format === "md" ? "md" : "json";
      response.setHeader("content-disposition", `attachment; filename=run-${record.run.id}.${extension}`);
      if (format === "md") return response.type("text/markdown").send(renderMarkdown(report));
      response.json(report);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/runs/:id/sequence", async (request, response, next) => {
    try {
      const record = await repository.get(request.params.id);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      response.json(buildSequence(record.exchanges));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (response.locals.captureRequest === true) {
      const status = typeof error === "object" && error && "status" in error && error.status === 413 ? 413 : 400;
      return response.status(status).json({ code: status === 413 ? "CAPTURE_TOO_LARGE" : "CAPTURE_INVALID_HAR" });
    }
    console.error(error);
    response.status(500).type("application/problem+json").json({
      type: "https://playground/errors/internal",
      title: "The playground could not complete the request",
      status: 500,
      code: "INTERNAL_ERROR",
    });
  });

  return app;
}
