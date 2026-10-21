import { randomUUID } from "node:crypto";
import type { RunSummary } from "@playground/shared";
import type { Server } from "socket.io";
import { describe, expect, it } from "vitest";
import { createSteps, runDemo } from "./orchestrator.js";
import { createFixtureDrivers } from "./drivers/fixture.js";
import { MemoryRunRepository } from "./store.js";

describe("walking-skeleton orchestration", () => {
  it("creates the ordered issue-to-verify timeline", () => {
    const steps = createSteps("run-1");

    expect(steps.map((step) => step.stepKey)).toEqual([
      "INIT",
      "ISSUE_OFFER",
      "ISSUE_TOKEN",
      "ISSUE_CREDENTIAL",
      "STORE",
      "PRESENT_REQUEST",
      "PRESENT_SUBMIT",
      "PRESENT_STATUS",
      "PRESENT_RESULT",
      "REPORT",
    ]);
    expect(steps.every((step) => step.status === "pending")).toBe(true);
  });

  it("persists ordered, redacted exchanges through the repository", async () => {
    const repository = new MemoryRunRepository();
    const id = randomUUID();
    const run: RunSummary = {
      id,
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
    await repository.create({ run, steps: createSteps(id), exchanges: [] });
    const emit = () => undefined;
    const io = { of: () => ({ to: () => ({ emit }) }) } as unknown as Server;

    await runDemo(id, io, repository, 0);

    const stored = await repository.get(id);
    expect(stored?.run.status).toBe("passed");
    expect(stored?.exchanges.map((exchange) => exchange.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(stored?.exchanges[1]?.response).toMatchObject({ access_token: "[REDACTED]" });
  });

  it("persists a failed step and errored run when a driver fails", async () => {
    const repository = new MemoryRunRepository();
    const id = randomUUID();
    const run: RunSummary = {
      id,
      config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null },
      status: "pending",
      expectedOutcome: "valid",
      actualOutcome: null,
      proofType: "Ed25519Signature2020",
      algorithm: "EdDSA",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    await repository.create({ run, steps: createSteps(id), exchanges: [] });
    const drivers = createFixtureDrivers(run.config);
    drivers.wallet.authorize = async () => { throw new Error("upstream unavailable"); };
    const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as Server;

    await expect(runDemo(id, io, repository, 0, drivers)).rejects.toThrow("ISSUE_TOKEN");

    const stored = await repository.get(id);
    expect(stored?.run).toMatchObject({ status: "errored", actualOutcome: "error" });
    expect(stored?.steps.find((step) => step.stepKey === "ISSUE_TOKEN")).toMatchObject({
      status: "failed",
      summary: { error: "DRIVER_EXECUTION_FAILED" },
    });
  });

  it("passes a tamper run when the verifier returns the expected invalid outcome", async () => {
    const repository = new MemoryRunRepository();
    const id = randomUUID();
    const run: RunSummary = {
      id,
      config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: "bad_signature", scenarioId: null },
      status: "pending",
      expectedOutcome: "invalid",
      actualOutcome: null,
      proofType: "kb+jwt",
      algorithm: "EdDSA",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    await repository.create({ run, steps: createSteps(id), exchanges: [] });
    const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as Server;

    await runDemo(id, io, repository, 0);

    const stored = await repository.get(id);
    expect(stored?.run).toMatchObject({ status: "passed", expectedOutcome: "invalid", actualOutcome: "invalid" });
    expect(stored?.exchanges.find((item) => item.url.includes("direct-post"))?.request)
      .toMatchObject({ tamper: "bad_signature" });
  });
});
