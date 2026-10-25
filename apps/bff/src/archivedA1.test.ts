import { afterEach, expect, it } from "vitest";
import type { Server as HttpServer } from "node:http";
import type { Server } from "socket.io";
import { ARCHIVED_A1_RUN_ID, loadArchivedA1, withArchivedA1 } from "./archivedA1.js";
import { buildApp } from "./app.js";
import { MemoryRunRepository } from "./store.js";

let server: HttpServer | undefined;
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });

it("loads the committed managed A1 chain as an immutable historical record", async () => {
  const source = loadArchivedA1();
  expect(source.run).toMatchObject({ id: ARCHIVED_A1_RUN_ID, recordKind: "archived_evidence", status: "passed", actualOutcome: "valid" });
  expect(source.run.serviceVersions?.wallet).toBe("unreported");
  expect(source.steps).toHaveLength(10);
  expect(source.exchanges).toHaveLength(7);
  const repo = withArchivedA1(new MemoryRunRepository(), source);
  const opened = await repo.get(ARCHIVED_A1_RUN_ID);
  opened!.run.status = "failed";
  opened!.exchanges.length = 0;
  expect((await repo.get(ARCHIVED_A1_RUN_ID))?.run.status).toBe("passed");
  expect((await repo.get(ARCHIVED_A1_RUN_ID))?.exchanges).toHaveLength(7);
  await expect(repo.addExchanges([source.exchanges[0]!])).rejects.toThrow("ARCHIVED_EVIDENCE_READ_ONLY");
  await repo.clear();
  expect((await repo.get(ARCHIVED_A1_RUN_ID))?.run.status).toBe("passed");
});

it("serves the archived timeline and report on a fresh BFF but refuses capture mutation", async () => {
  const io = { of: () => ({ to: () => ({ emit: () => {} }) }) } as unknown as Server;
  server = buildApp(() => io, withArchivedA1(new MemoryRunRepository())).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  const base = `http://127.0.0.1:${address.port}`;
  const run = await fetch(`${base}/api/v1/runs/${ARCHIVED_A1_RUN_ID}`).then(response => response.json());
  expect(run.recordKind).toBe("archived_evidence");
  expect(run.serviceVersions.wallet).toBe("unreported");
  const history = await fetch(`${base}/api/v1/runs`).then(response => response.json());
  expect(history.items[0].id).toBe(ARCHIVED_A1_RUN_ID);
  const steps = await fetch(`${base}/api/v1/runs/${ARCHIVED_A1_RUN_ID}/steps`).then(response => response.json());
  expect(steps.items).toHaveLength(10);
  const exchanges = await fetch(`${base}/api/v1/runs/${ARCHIVED_A1_RUN_ID}/exchanges`).then(response => response.json());
  expect(exchanges.items).toHaveLength(7);
  const report = await fetch(`${base}/api/v1/runs/${ARCHIVED_A1_RUN_ID}/report`).then(response => response.json());
  expect(report.run.id).toBe(ARCHIVED_A1_RUN_ID);
  const capture = await fetch(`${base}/api/v1/runs/${ARCHIVED_A1_RUN_ID}/capture/har`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: ARCHIVED_A1_RUN_ID, har: { log: { entries: [] } } }) });
  expect(capture.status).toBe(409);
  expect(await capture.json()).toEqual({ code: "ARCHIVED_EVIDENCE_READ_ONLY" });
});
