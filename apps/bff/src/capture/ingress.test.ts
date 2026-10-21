import { describe, expect, it } from "vitest";
import { CaptureRateGate } from "./ingress.js";

describe("bounded capture ingress gate", () => {
  it("limits attempts per transport peer and resets after the window", () => {
    let now = 0;
    const gate = new CaptureRateGate(2, 60_000, () => now);
    expect(gate.check("peer")).toBe(0);
    expect(gate.check("peer")).toBe(0);
    expect(gate.check("peer")).toBe(60);
    expect(gate.check("other")).toBe(0);
    now = 60_001;
    expect(gate.check("peer")).toBe(0);
  });
  it("bounds bucket memory without evicting active clients to evade a limit", () => {
    const gate = new CaptureRateGate();
    for (let i = 0; i < 1024; i++) expect(gate.check(String(i))).toBe(0);
    expect(gate.check("overflow")).toBe(60);
  });
});
