import type { RunConfig } from "@playground/shared";
import { afterEach, describe, expect, it } from "vitest";
import { configuredDriverMode, resolveDrivers } from "./registry.js";

const config: RunConfig = {
  issuer: "inji_certify",
  wallet: "reference_wallet",
  verifier: "inji_verify",
  format: "ldp_vc",
  flow: "cross_device",
  tamper: null,
  scenarioId: null,
};

afterEach(() => delete process.env.PLAYGROUND_DRIVER_MODE);

describe("driver registry", () => {
  it("defaults to deterministic fixture drivers", () => {
    expect(configuredDriverMode()).toBe("fixture");
    expect(resolveDrivers(config).issuer.id).toBe("inji_certify");
  });

  it("selects the Collab adapter explicitly", () => {
    expect(resolveDrivers(config, "collab").wallet.id).toBe("reference_wallet");
  });

  it("rejects unsupported live role combinations before making a request", async () => {
    const unsupported: RunConfig = { ...config, issuer: "mock_issuer" };
    const drivers = resolveDrivers(unsupported, "collab");
    await expect(drivers.issuer.createOffer({ config: unsupported, state: new Map() }))
      .rejects.toThrow("Mock issuer currently supports SD-JWT VC only");
  });

  it("rejects unknown modes instead of silently falling back", () => {
    process.env.PLAYGROUND_DRIVER_MODE = "production";
    expect(() => configuredDriverMode()).toThrow("Unsupported PLAYGROUND_DRIVER_MODE");
  });
});

it("never resolves an assisted wallet to an automated fixture or Reference Wallet", () => {
  for (const mode of ["fixture", "collab"] as const) expect(() => resolveDrivers({ ...config, wallet: "inji_web_assisted" }, mode)).toThrow("ASSISTED_REQUIRES_RUN_CONTEXT");
});
