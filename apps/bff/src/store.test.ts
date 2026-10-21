import { randomUUID } from "node:crypto";
import type { Exchange, RunStep, RunSummary } from "@playground/shared";
import { describe, expect, it } from "vitest";
import { MemoryRunRepository } from "./store.js";

function fixture() {
  const runId = randomUUID();
  const stepId = randomUUID();
  const run: RunSummary = {
    id: runId,
    config: {
      issuer: "inji_certify",
      wallet: "reference_wallet",
      verifier: "inji_verify",
      format: "vc_sd_jwt",
      flow: "cross_device",
      tamper: null,
      scenarioId: null,
    },
    status: "pending",
    expectedOutcome: "valid",
    actualOutcome: null,
    proofType: "kb+jwt",
    algorithm: "EdDSA",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
  const step: RunStep = {
    id: stepId,
    runId,
    seq: 1,
    stepKey: "INIT",
    title: "Initialize run",
    status: "pending",
    summary: null,
  };
  const exchange: Exchange = {
    id: randomUUID(),
    runId,
    stepId,
    seq: 1,
    actorFrom: "wallet",
    actorTo: "certify",
    method: "POST",
    url: "https://issuer.example/credential",
    status: 200,
    durationMs: 10,
    request: {},
    response: { issued: true },
    redactions: [],
  };
  return { run, step, exchange };
}

describe("MemoryRunRepository", () => {
  it("keeps run lifecycle data behind the repository contract", async () => {
    const repository = new MemoryRunRepository();
    const { run, step, exchange } = fixture();
    await repository.create({ run, steps: [step], exchanges: [] });

    run.status = "passed";
    run.actualOutcome = "valid";
    step.status = "succeeded";
    step.summary = { completed: true };
    await repository.updateRun(run);
    await repository.updateStep(step);
    await repository.addExchange(exchange);

    const stored = await repository.get(run.id);
    expect(stored?.run.status).toBe("passed");
    expect(stored?.steps[0]?.status).toBe("succeeded");
    expect(stored?.exchanges[0]?.response).toEqual({ issued: true });
  });
});
