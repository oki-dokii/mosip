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
import type { RunRepository } from "./store.js";

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
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/v1/health", (_request, response) => {
    response.json({
      services: [{ name: "playground", status: "up", version: "0.2.0", latencyMs: 0 }],
      storage: repository.storage,
      driverMode: configuredDriverMode(),
    });
  });

  app.get("/api/v1/meta/implementations", (_request, response) => response.json(metadata));
  app.get("/api/v1/runs", async (_request, response, next) => {
    try {
      response.json({ items: await repository.list() });
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
