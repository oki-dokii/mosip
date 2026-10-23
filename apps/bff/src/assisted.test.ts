import { afterEach, beforeEach, expect, it } from "vitest";
import type { Server as HttpServer } from "node:http";
import type { Server } from "socket.io";
import { buildApp } from "./app.js";
import { MemoryRunRepository } from "./store.js";
let server: HttpServer; let base: string;
const config = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
const post = (path: string, value?: unknown) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value ?? {}) });
beforeEach(async () => { const io = { of: () => ({ to: () => ({ emit: () => {} }) }) } as unknown as Server; server = buildApp(() => io, new MemoryRunRepository()).listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve)); const address = server.address(); if (!address || typeof address === "string") throw new Error(); base = `http://127.0.0.1:${address.port}`; });
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
async function status(id: string) { return fetch(base + `/api/v1/assisted/runs/${id}`).then(response => response.json()); }
async function until(id: string, predicate: (value: any) => boolean) { for (let n = 0; n < 100; n++) { const value = await status(id); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error("Assisted checkpoint not reached"); }
const waiting = (key: string) => (value: any) => value.steps.some((step: any) => step.stepKey === key && step.status === "running");
it("runs the registered assisted driver through active capture, storage and verifier completion", async () => {
  const started = await post("/api/v1/assisted/runs", { config, mode: "fixture" }); expect(started.status).toBe(202); const { runId } = await started.json();
  await until(runId, waiting("ISSUE_CREDENTIAL"));
  expect((await post(`/api/v1/assisted/runs/${runId}/observations`, { kind: "presentation" })).status).toBe(409);
  const captured = await post(`/api/v1/runs/${runId}/capture/har`, { runId, har: { log: { entries: [{ startedDateTime: new Date().toISOString(), time: 1, request: { method: "POST", url: "https://injicertify.collab.mosip.net/credential", headers: [] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: "{}" } } }] } } });
  expect(captured.status).toBe(200); await until(runId, waiting("STORE"));
  expect((await status(runId)).run.actualOutcome).toBeNull();
  await post(`/api/v1/assisted/runs/${runId}/observations`, { kind: "storage" }); await until(runId, waiting("PRESENT_SUBMIT"));
  await post(`/api/v1/assisted/runs/${runId}/observations`, { kind: "presentation" });
  const result = await until(runId, value => value.run.status === "passed"); expect(result.run.actualOutcome).toBe("valid");
  expect((await post(`/api/v1/runs/${runId}/replay`, { tamper: null })).status).toBe(422);
  const summary = await fetch(base + `/api/v1/runs/${runId}/capture/coverage`).then(r => r.json()); expect(summary.coverage.find((row: any) => row.stepKey === "ISSUE_CREDENTIAL").state).toBe("captured");
});
it("cancels idempotently, rejects late events, and starts a fresh run", async () => {
  const { runId } = await (await post("/api/v1/assisted/runs", { config, mode: "fixture" })).json(); await until(runId, waiting("ISSUE_CREDENTIAL"));
  await post(`/api/v1/assisted/runs/${runId}/cancel`); const result = await until(runId, value => value.run.status === "cancelled"); expect(result.run.actualOutcome).toBeNull();
  expect((await post(`/api/v1/assisted/runs/${runId}/cancel`)).status).toBe(202);
  expect((await post(`/api/v1/assisted/runs/${runId}/observations`, { kind: "issuance" })).status).toBe(409);
  const fresh = await (await post("/api/v1/assisted/runs", { config, mode: "fixture" })).json(); expect(fresh.runId).not.toBe(runId); await post(`/api/v1/assisted/runs/${fresh.runId}/cancel`); await until(fresh.runId, value => value.run.status === "cancelled");
});
it("preserves timeout reasons and rejects unsupported configurations", async () => {
  expect((await post("/api/v1/assisted/runs", { config: { ...config, format: "vc_sd_jwt" }, mode: "fixture" })).status).toBe(422);
  const { runId } = await (await post("/api/v1/assisted/runs", { config, mode: "fixture", timeoutMs: 100 })).json();
  const result = await until(runId, value => value.run.status === "errored"); expect(result.run.actualOutcome).toBe("error"); expect(result.steps.some((step: any) => step.summary?.error === "ASSISTED_TIMEOUT")).toBe(true);
});

it("requires an explicit verifier result instead of the orchestrator's default valid outcome", async () => {
  const { runDemo, createSteps } = await import("./orchestrator.js");
  const { createFixtureDrivers } = await import("./drivers/fixture.js");
  const { randomUUID } = await import("node:crypto");
  const repository = new MemoryRunRepository(); const id = randomUUID();
  const typedConfig = config as import("@playground/shared").RunConfig;
  await repository.create({ run: { id, parentRunId: null, config: typedConfig, status: "pending", expectedOutcome: "valid", actualOutcome: null, proofType: "Ed25519Signature2020", algorithm: "EdDSA", createdAt: new Date().toISOString(), startedAt: null, finishedAt: null }, steps: createSteps(id), exchanges: [] });
  const drivers = createFixtureDrivers(typedConfig); drivers.verifier.getResult = async () => ({ summary: {} });
  const io = { of: () => ({ to: () => ({ emit: () => {} }) }) } as unknown as Server;
  await expect(runDemo(id, io, repository, 0, drivers)).rejects.toThrow();
  expect((await repository.get(id))?.run.actualOutcome).toBe("error");
});

it("gates unconfigured live starts rather than falling back to a fixture wallet", async () => {
  const previous = process.env.ASSISTED_LIVE_ENABLED; process.env.ASSISTED_LIVE_ENABLED = "false";
  try { const result = await post("/api/v1/assisted/runs", { config, mode: "live" }); expect(result.status).toBe(422); expect((await result.json()).code).toBe("ASSISTED_LIVE_BLOCKED"); }
  finally { if (previous === undefined) delete process.env.ASSISTED_LIVE_ENABLED; else process.env.ASSISTED_LIVE_ENABLED = previous; }
});
