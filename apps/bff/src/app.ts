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
import { latestMatrix, renderMatrixCsv, renderMatrixMarkdown } from "./matrix.js";
import { filterRuns } from "./history.js";
import { unsupportedReason } from "./capabilities.js";
import { snapshotVersions } from "./versions.js";
import type { RunRepository } from "./store.js";
import { CaptureError, prepareHarImport } from "./capture/har.js";

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
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use("/api/v1/runs/:id/capture/har", express.json({ limit: "2mb" }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/v1/health", (_request, response) => {
    response.json({
      services: [{ name: "playground", status: "up", version: "0.2.0", latencyMs: 0 }],
      storage: repository.storage,
      driverMode: configuredDriverMode(),
    });
  });

  app.get("/api/v1/meta/implementations", (_request, response) => response.json(metadata));
  app.get("/api/v1/matrix", async (_request, response, next) => {
    try {
      response.json({ items: latestMatrix(await repository.list()) });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/v1/matrix/export", async (request, response, next) => {
    try {
      const format = request.query.format ?? "csv";
      const runs = await repository.list();
      if (format === "json") return response.json({ items: latestMatrix(runs) });
      if (format === "csv") {
        response.setHeader("content-disposition", "attachment; filename=interoperability-matrix.csv");
        return response.type("text/csv").send(renderMatrixCsv(runs));
      }
      if (format === "md") {
        response.setHeader("content-disposition", "attachment; filename=interoperability-matrix.md");
        return response.type("text/markdown").send(renderMatrixMarkdown(runs));
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
    const reason = unsupportedReason(parsed.data, configuredDriverMode());
    if (reason) return response.status(422).json({ code: "UNSUPPORTED_COMBINATION", detail: reason });
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
      if (source.run.status !== "passed" && source.run.status !== "failed") {
        return response.status(409).json({ code: "RUN_NOT_REPLAYABLE" });
      }
      const config: RunConfig = { ...source.run.config, tamper: parsed.data.tamper };
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
      const record = await repository.get(runId);
      if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
      const prepared = prepareHarImport(request.body, record);
      const imported = await repository.addExchanges(prepared.exchanges);
      for (const exchange of prepared.exchanges.slice(0, imported)) {
        getIo().of("/runs").to(`run:${runId}`).emit("exchange:recorded", {
          runId, exchangeId: exchange.id, seq: exchange.seq, actorFrom: exchange.actorFrom,
          actorTo: exchange.actorTo, method: exchange.method, url: exchange.url,
          status: exchange.status, durationMs: exchange.durationMs,
        });
      }
      return response.json({ imported, skipped: prepared.skipped + prepared.exchanges.length - imported, gaps: prepared.gaps });
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
      const report = buildReport(record);
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
    if (_request.path.endsWith("/capture/har")) {
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
