import { describe, expect, it } from "vitest";
import { CaptureHub } from "./hub.js";
const origins = new Map([["https://issuer.example", "certify"]] as const);
const runA = "11111111-1111-4111-a111-111111111111";
const runB = "22222222-2222-4222-a222-222222222222";

describe("canonical capture attribution prototype", () => {
  it("is disabled by default unless enabled explicitly", () => {
    const hub = new CaptureHub(origins, false);
    expect(() => hub.claim("certify", "https://issuer.example", runA)).toThrow(/DISABLED/);
    expect(hub.begin("certify", "https://issuer.example")).toBeNull();
    expect(hub.stats()).toEqual({ attributed: 0, unmatched: 0, disabled: 1 });
  });
  it("refuses newest-wins misattribution and requires the right lease plus draining", () => {
    const hub = new CaptureHub(origins, true);
    const lease = hub.claim("certify", "https://issuer.example", runA);
    expect(() => hub.claim("certify", "https://issuer.example", runB)).toThrow(/CONFLICT/);
    const request = hub.begin("certify", "https://issuer.example")!;
    expect(request.runId).toBe(runA);
    expect(() => hub.release("certify", "https://issuer.example", lease.leaseId)).toThrow(/DRAIN/);
    request.finish(); request.finish();
    expect(() => hub.release("certify", "https://issuer.example", "wrong")).toThrow(/MISMATCH/);
    hub.release("certify", "https://issuer.example", lease.leaseId);
    expect(hub.begin("certify", "https://issuer.example")).toBeNull();
    expect(hub.stats()).toEqual({ attributed: 1, unmatched: 1, disabled: 0 });
  });
  it("expires claims and validates origin/service scope", () => {
    let now = 0;
    const hub = new CaptureHub(origins, true, () => now);
    hub.claim("certify", "https://issuer.example", runA, 100);
    now = 101;
    expect(hub.begin("certify", "https://issuer.example")).toBeNull();
    expect(() => hub.claim("verify", "https://issuer.example", runB)).toThrow(/INVALID/);
    expect(hub.claim("certify", "https://issuer.example", runB).leaseId).toBeTruthy();
  });
});
