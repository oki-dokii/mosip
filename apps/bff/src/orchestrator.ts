import { randomUUID } from "node:crypto";
import type { Exchange, RunStep } from "@playground/shared";
import type { Server } from "socket.io";
import { resolveDrivers } from "./drivers/registry.js";
import type { DriverContext, DriverResult, DriverSet } from "./drivers/types.js";
import { redact } from "./redaction.js";
import type { RunRepository } from "./store.js";

const STEP_DEFINITIONS = [
  ["INIT", "Initialize run"],
  ["ISSUE_OFFER", "Discover issuer and create offer"],
  ["ISSUE_TOKEN", "Authorize wallet and exchange token"],
  ["ISSUE_CREDENTIAL", "Issue holder-bound credential"],
  ["STORE", "Store credential for this run"],
  ["PRESENT_REQUEST", "Create signed presentation request"],
  ["PRESENT_SUBMIT", "Submit holder-bound presentation"],
  ["PRESENT_RESULT", "Verify credential and holder proof"],
  ["REPORT", "Build run result"],
] as const;

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function executeStep(step: RunStep, context: DriverContext, drivers: DriverSet): Promise<DriverResult> {
  switch (step.stepKey) {
    case "ISSUE_OFFER": return drivers.issuer.createOffer(context);
    case "ISSUE_TOKEN": return drivers.wallet.authorize(context);
    case "ISSUE_CREDENTIAL": return drivers.wallet.requestCredential(context);
    case "STORE": return drivers.wallet.store(context);
    case "PRESENT_REQUEST": return drivers.verifier.createRequest(context);
    case "PRESENT_SUBMIT": return drivers.wallet.present(context);
    case "PRESENT_RESULT": return drivers.verifier.getResult(context);
    default: return { summary: { completed: true } };
  }
}

function sanitizeExchange(exchange: NonNullable<DriverResult["exchanges"]>[number], sequence: number) {
  const request = redact(exchange.request);
  const response = redact(exchange.response);
  return {
    ...exchange,
    seq: sequence,
    request: request.value,
    response: response.value,
    redactions: [...request.redactions, ...response.redactions],
  };
}

export async function runDemo(
  runId: string,
  io: Server,
  repository: RunRepository,
  stepDelayMs = 110,
  selectedDrivers?: DriverSet,
) {
  const record = await repository.get(runId);
  if (!record) return;
  const drivers = selectedDrivers ?? resolveDrivers(record.run.config);
  const context: DriverContext = { config: record.run.config, state: new Map() };
  const room = `run:${runId}`;
  const namespace = io.of("/runs");
  record.run.status = "running";
  record.run.startedAt = new Date().toISOString();
  await repository.updateRun(record.run);
  namespace.to(room).emit("run:created", { runId, config: record.run.config });
  let exchangeSequence = record.exchanges.length;
  let actualOutcome: "valid" | "invalid" = "valid";
  let activeStep: RunStep | undefined;

  try {
    for (const step of record.steps) {
      activeStep = step;
      step.status = "running";
      await repository.updateStep(step);
      namespace.to(room).emit("step:started", step);
      await wait(stepDelayMs);
      const result = await executeStep(step, context, drivers);
      for (const driverExchange of result.exchanges ?? []) {
        const exchange = sanitizeExchange(driverExchange, exchangeSequence + 1);
        const stored: Exchange = { ...exchange, id: randomUUID(), runId, stepId: step.id };
        await repository.addExchange(stored);
        exchangeSequence += 1;
        namespace.to(room).emit("exchange:recorded", {
          runId,
          exchangeId: stored.id,
          seq: stored.seq,
          actorFrom: stored.actorFrom,
          actorTo: stored.actorTo,
          method: stored.method,
          url: stored.url,
          status: stored.status,
          durationMs: stored.durationMs,
        });
      }
      if (result.summary?.outcome === "invalid") actualOutcome = "invalid";
      step.status = "succeeded";
      step.summary = result.summary ?? { completed: true };
      await repository.updateStep(step);
      namespace.to(room).emit("step:finished", step);
    }

    record.run.status = actualOutcome === "valid" ? "passed" : "failed";
    record.run.actualOutcome = actualOutcome;
  } catch {
    if (activeStep) {
      activeStep.status = "failed";
      activeStep.summary = { error: "DRIVER_EXECUTION_FAILED" };
      await repository.updateStep(activeStep);
      namespace.to(room).emit("step:finished", activeStep);
    }
    record.run.status = "errored";
    record.run.actualOutcome = "error";
  } finally {
    record.run.finishedAt = new Date().toISOString();
    await repository.updateRun(record.run);
    namespace.to(room).emit("run:finished", {
      runId,
      status: record.run.status,
      expected: record.run.expectedOutcome,
      actual: record.run.actualOutcome,
    });
  }

  if (record.run.status === "errored") {
    throw new Error(`Run ${runId} failed during ${activeStep?.stepKey ?? "initialization"}`);
  }
}

export function createSteps(runId: string): RunStep[] {
  return STEP_DEFINITIONS.map(([stepKey, title], index) => ({
    id: randomUUID(),
    runId,
    seq: index + 1,
    stepKey,
    title,
    status: "pending",
    summary: null,
  }));
}
