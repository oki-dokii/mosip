import type { RunConfig } from "@playground/shared";
import { createCollabDrivers } from "./collab.js";
import { createFixtureDrivers } from "./fixture.js";
import type { DriverSet } from "./types.js";

export type DriverMode = "fixture" | "collab";

export function configuredDriverMode(): DriverMode {
  const value = process.env.PLAYGROUND_DRIVER_MODE ?? "fixture";
  if (value !== "fixture" && value !== "collab") {
    throw new Error(`Unsupported PLAYGROUND_DRIVER_MODE: ${value}`);
  }
  return value;
}

export function resolveDrivers(config: RunConfig, mode = configuredDriverMode()): DriverSet {
  if (config.wallet === "inji_web_assisted") throw new Error("ASSISTED_REQUIRES_RUN_CONTEXT");
  if (mode === "fixture") return createFixtureDrivers(config);
  return createCollabDrivers(config);
}
