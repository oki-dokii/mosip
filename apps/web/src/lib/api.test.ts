import { afterEach, expect, it, vi } from "vitest";
import type { RunConfig } from "@playground/shared";
import { api } from "./api";

const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
afterEach(() => vi.unstubAllGlobals());

it.each(["live", "fixture"] as const)("starts a %s journey with the appropriate waiting budget", async mode => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ runId: "managed-run" }), { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(api.startAssisted(config, mode)).resolves.toEqual({ runId: "managed-run" });

  expect(fetchMock).toHaveBeenCalledWith("/api/v1/assisted/runs", expect.objectContaining({ method: "POST" }));
  const init = vi.mocked(fetch).mock.calls[0]![1]!;
  expect(JSON.parse(String(init.body))).toEqual({ config, mode, ...(mode === "live" ? { timeoutMs: 300_000 } : {}) });
});
