import { describe, expect, it } from "vitest";
import type { Server as HttpServer } from "node:http";
import type { Server as SocketServer } from "socket.io";
import { buildApp } from "./app.js";
import { MemoryRunRepository } from "./store.js";
import { listScenarios, scenarioMismatch } from "./scenarios.js";

describe("scenario catalog", () => {
  it("defines one-variable cases with stable IDs and expected outcomes", () => {
    const scenarios = listScenarios("fixture");
    expect(scenarios).toHaveLength(10);
    expect(new Set(scenarios.map((item) => item.id)).size).toBe(scenarios.length);
    expect(scenarios.every((item) => item.config.scenarioId === item.id)).toBe(true);
    expect(scenarios.slice(0, 4).map((item) => item.expectedOutcome)).toEqual(["valid", "valid", "valid", "invalid"]);
    expect(scenarios.every((item) => item.available)).toBe(true);
  });

  it("rejects an unknown or edited preset without blocking custom runs", () => {
    const config = listScenarios("fixture")[0]!.config;
    expect(scenarioMismatch(config)).toBeNull();
    expect(scenarioMismatch({ ...config, format: "ldp_vc" })).toBe("SCENARIO_CONFIG_MISMATCH");
    expect(scenarioMismatch({ ...config, scenarioId: "00000000-0000-4000-8000-000000000000" })).toBe("SCENARIO_NOT_FOUND");
    expect(scenarioMismatch({ ...config, scenarioId: null, format: "ldp_vc" })).toBeNull();
  });

  it("marks live cases unavailable until their required environment is configured", () => {
    const missing = listScenarios("collab", {});
    expect(missing.slice(0, 4).every((item) => !item.available)).toBe(true);
    expect(missing.slice(4).every((item) => item.available)).toBe(true);
    const ready = listScenarios("collab", {
      OFFICIAL_POSTMAN_ENV_PATH: "/synthetic/postman.json", MOCK_OTP: "synthetic-otp", MOCK_ISSUER_BASE_URL: "http://127.0.0.1:4101", MOCK_ISSUER_ENABLE_TEST_CASES: "true",
    });
    expect(ready.every((item) => item.available)).toBe(true);
  });

  it("serves presets and rejects a changed preset at the API boundary", async () => {
    const oldMode = process.env.PLAYGROUND_DRIVER_MODE;
    process.env.PLAYGROUND_DRIVER_MODE = "fixture";
    const io = { of: () => ({ to: () => ({ emit: () => undefined }) }) } as unknown as SocketServer;
    const server: HttpServer = buildApp(() => io, new MemoryRunRepository()).listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No address");
      const base = `http://127.0.0.1:${address.port}`;
      const catalog = await fetch(`${base}/api/v1/scenarios`);
      expect(catalog.status).toBe(200);
      const body = await catalog.json() as { items: ReturnType<typeof listScenarios> };
      expect(body.items).toHaveLength(10);
      const changed = { ...body.items[0]!.config, format: "ldp_vc" };
      const response = await fetch(`${base}/api/v1/runs`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ code: "SCENARIO_CONFIG_MISMATCH" });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (oldMode === undefined) delete process.env.PLAYGROUND_DRIVER_MODE;
      else process.env.PLAYGROUND_DRIVER_MODE = oldMode;
    }
  });
});
