import { withExchangeLock } from "./exchangeLock.js";
import { AssistedWaitError } from "./drivers/injiWebAssisted.js";
import { randomUUID } from "node:crypto";
import type { Exchange, RunStep } from "@playground/shared";
import type { Server } from "socket.io";
import { resolveDrivers } from "./drivers/registry.js";
import type { DriverContext, DriverResult, DriverSet } from "./drivers/types.js";
import { redact } from "./redaction.js";
import type { RunRepository } from "./store.js";
import { evaluateProtocol, protocolMetadata } from "./protocol.js";

const STEP_DEFINITIONS = [
  ["INIT", "Initialize run"],
  ["ISSUE_OFFER", "Discover issuer and create offer"],
  ["ISSUE_TOKEN", "Authorize wallet and exchange token"],
  ["ISSUE_CREDENTIAL", "Issue holder-bound credential"],
  ["STORE", "Store credential for this run"],
  ["PRESENT_REQUEST", "Create signed presentation request"],
  ["PRESENT_SUBMIT", "Submit holder-bound presentation"],
  ["PRESENT_STATUS", "Wait for verifier submission status"],
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
    case "PRESENT_STATUS": return drivers.verifier.pollStatus(context);
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
  signal?: AbortSignal,
  stepTimeoutMs?: number,
  onStep?: () => void,
) {
  const record = await repository.get(runId);
  if (!record) return;
  const drivers = selectedDrivers ?? resolveDrivers(record.run.config);
  const context: DriverContext = { config: record.run.config, state: new Map(), ...(signal ? { signal } : {}) };
  const room = `run:${runId}`;
  const namespace = io.of("/runs");
  record.run.status = "running";
  record.run.startedAt = new Date().toISOString();
  await repository.updateRun(record.run);
  namespace.to(room).emit("run:created", { runId, config: record.run.config });
  let exchangeSequence = record.exchanges.length;
  let actualOutcome: "valid" | "invalid" | "expired" | null = null;
  let verificationSummary: Record<string, unknown> | undefined;
  let activeStep: RunStep | undefined;

  try {
    for (const step of record.steps) {
      if (signal?.aborted) throw (signal.reason instanceof AssistedWaitError ? signal.reason : new AssistedWaitError("cancelled", "run"));
      activeStep = step;
      onStep?.();
      step.status = "running";
      await repository.updateStep(step);
      namespace.to(room).emit("step:started", step);
      await wait(stepDelayMs);
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
      let abortListener: (() => void) | undefined;
      const result = await Promise.race([executeStep(step, context, drivers), ...(stepTimeoutMs ? [new Promise<never>((_, reject) => { deadlineTimer = setTimeout(() => reject(new AssistedWaitError("timeout", step.stepKey)), stepTimeoutMs); })] : []), ...(signal ? [new Promise<never>((_, reject) => { abortListener = () => reject(signal.reason instanceof AssistedWaitError ? signal.reason : new AssistedWaitError("cancelled", step.stepKey)); signal.addEventListener("abort", abortListener, { once: true }); if (signal.aborted) abortListener(); })] : [])]).finally(() => { if (deadlineTimer) clearTimeout(deadlineTimer); if (signal && abortListener) signal.removeEventListener("abort", abortListener); });
      if (signal?.aborted) throw new AssistedWaitError("cancelled", step.stepKey);
      for (const driverExchange of result.exchanges ?? []) {
        await withExchangeLock(repository, runId, async () => {
        exchangeSequence = Math.max(exchangeSequence, ...(await repository.get(runId))!.exchanges.map(item => item.seq));
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
        });
      }
      if (record.run.config.wallet === "inji_web_assisted" && step.stepKey === "PRESENT_RESULT" && !["valid", "invalid"].includes(String(result.summary?.outcome))) throw new AssistedWaitError("observation_error", "verifier result missing");
      step.summary = result.summary ?? { completed: true };
      if (result.summary?.outcome === "error") throw new Error("Driver reported an execution error");
      if (step.stepKey === "PRESENT_RESULT") {
        verificationSummary = result.summary;
        const outcome = result.summary?.outcome;
        if (outcome !== "valid" && outcome !== "invalid" && outcome !== "expired") throw new Error("Verifier did not provide a terminal verdict");
        actualOutcome = outcome;
      }
      if (step.stepKey === "REPORT") {
        if (actualOutcome === null) throw new Error("Missing verifier verdict");
        step.summary = { protocolEvaluation: evaluateProtocol(record.run.config, record.run.expectedOutcome, actualOutcome, verificationSummary) };
      }
      step.status = "succeeded";
      await repository.updateStep(step);
      namespace.to(room).emit("step:finished", step);
    }

    Object.assign(record.run, protocolMetadata(record.steps));
    record.run.status = ["correct_acceptance", "correct_rejection"].includes(record.run.evaluation?.verdict ?? "") ? "passed" : "failed";
    record.run.actualOutcome = actualOutcome;
  } catch (error) {
    if (activeStep) {
      activeStep.status = "failed";
      activeStep.summary = {
        ...activeStep.summary,
        error: error instanceof AssistedWaitError ? `ASSISTED_${error.reason.toUpperCase()}` : "DRIVER_EXECUTION_FAILED",
        protocolEvaluation: evaluateProtocol(record.run.config, record.run.expectedOutcome, "error", verificationSummary, activeStep.stepKey),
      };
      await repository.updateStep(activeStep);
      namespace.to(room).emit("step:finished", activeStep);
    }
    record.run.status = error instanceof AssistedWaitError && error.reason === "cancelled" ? "cancelled" : "errored";
    record.run.actualOutcome = record.run.status === "cancelled" ? null : "error";
    Object.assign(record.run, protocolMetadata(record.steps));
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
