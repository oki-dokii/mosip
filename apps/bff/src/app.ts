import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import type { Server } from "socket.io";
import { runConfigSchema, type ImplementationMetadata, type RunSummary } from "@playground/shared";
import { createSteps, runDemo } from "./orchestrator.js";
import { runStore } from "./store.js";

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

export function buildApp(getIo: () => Server) {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/v1/health", (_request, response) => {
    response.json({ services: [{ name: "playground", status: "up", version: "0.1.0", latencyMs: 0 }] });
  });

  app.get("/api/v1/meta/implementations", (_request, response) => response.json(metadata));
  app.get("/api/v1/runs", (_request, response) => response.json({ items: runStore.list() }));

  app.post("/api/v1/runs", (request, response) => {
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
    const id = randomUUID();
    const format = metadata.formats.find((item) => item.id === parsed.data.format)!;
    const run: RunSummary = {
      id,
      config: parsed.data,
      status: "pending",
      expectedOutcome: "valid",
      actualOutcome: null,
      proofType: format.proofType,
      algorithm: format.algorithm,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    runStore.create({ run, steps: createSteps(id), exchanges: [] });
    response.status(202).json({ runId: id });
    setTimeout(() => void runDemo(id, getIo()), 25);
  });

  app.get("/api/v1/runs/:id", (request, response) => {
    const record = runStore.get(request.params.id);
    if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
    response.json(record.run);
  });
  app.get("/api/v1/runs/:id/steps", (request, response) => {
    const record = runStore.get(request.params.id);
    if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
    response.json({ items: record.steps });
  });
  app.get("/api/v1/runs/:id/exchanges", (request, response) => {
    const record = runStore.get(request.params.id);
    if (!record) return response.status(404).json({ code: "RUN_NOT_FOUND" });
    const stepId = typeof request.query.stepId === "string" ? request.query.stepId : null;
    response.json({ items: stepId ? record.exchanges.filter((item) => item.stepId === stepId) : record.exchanges });
  });

  return app;
}
