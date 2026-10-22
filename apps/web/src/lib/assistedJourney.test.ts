import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exchange, RunConfig } from "@playground/shared";
import { AssistedJourney, assistedUnavailable } from "./assistedJourney";
import { createAssistedFixture } from "./assistedFixture";

const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
const exchange = (extra: Partial<Exchange> = {}): Exchange => ({ id: "e1", runId: "r1", stepId: "issue", seq: 1, actorFrom: "inji_web_assisted", actorTo: "inji_certify", method: "POST", url: "https://issuer.example/credential", status: 200, durationMs: 1, request: { source: "fixture" }, response: {}, redactions: [], ...extra });
describe("assisted journey", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
  it.each(["valid", "invalid"] as const)("waits for each checkpoint and normalizes %s without inventing storage", (outcome) => {
    const f = createAssistedFixture("r1");
    f.journey.start(); f.journey.ready();
    expect(f.journey.getSnapshot().stage).toBe("issuance");
    f.result(outcome); f.presentation(); f.storage();
    expect(f.journey.getSnapshot().stage).toBe("issuance");
    f.issuance();
    expect(f.journey.getSnapshot().stage).toBe("storage");
    f.issuance(); f.result(outcome);
    expect(f.journey.getSnapshot().stage).toBe("storage");
    f.storage(); f.presentation();
    expect(f.journey.getSnapshot()).toMatchObject({ stage: "result", outcome: null });
    f.result(outcome);
    expect(f.journey.getSnapshot()).toMatchObject({ stage: "complete", outcome, deadline: null });
    f.journey.cancel(); f.journey.fail();
    expect(f.journey.getSnapshot().stage).toBe("complete");
  });
  it.each(["starting", "issuance", "storage", "presentation", "result"])("cancels and ignores late activity during %s", (stage) => {
    const f = createAssistedFixture("r1"); f.journey.start();
    if (stage !== "starting") f.journey.ready();
    if (["storage", "presentation", "result"].includes(stage)) f.issuance();
    if (["presentation", "result"].includes(stage)) f.storage();
    if (stage === "result") f.presentation();
    expect(f.journey.getSnapshot().stage).toBe(stage);
    f.journey.cancel(); f.issuance(); f.storage(); f.presentation(); f.result("valid");
    expect(f.journey.getSnapshot()).toMatchObject({ stage: "cancelled", outcome: null });
  });
  it.each(["issuance", "storage", "presentation", "result"])("times out during %s without a verdict", (stage) => {
    const f = createAssistedFixture("r1"); f.journey.start(); f.journey.ready();
    if (stage !== "issuance") f.issuance();
    if (["presentation", "result"].includes(stage)) f.storage();
    if (stage === "result") f.presentation();
    vi.advanceTimersByTime(60_000);
    f.issuance(); f.storage(); f.presentation(); f.result("valid");
    expect(f.journey.getSnapshot()).toMatchObject({ stage: "timeout", outcome: null });
  });
  it("ignores unrelated runs, steps, actors, failed HTTP and non-POST evidence", () => {
    const journey = new AssistedJourney("r1", { ISSUE_CREDENTIAL: "issue", PRESENT_SUBMIT: "present" });
    journey.start(); journey.ready();
    for (const change of [{ runId: "other" }, { stepId: "other" }, { actorFrom: "reference_wallet" }, { actorTo: "other" }, { status: 400 }, { method: "GET" }]) journey.observe(exchange(change));
    journey.confirmStorage("other"); journey.verifierResult("other", "valid");
    expect(journey.getSnapshot().stage).toBe("issuance");
    journey.observe(exchange());
    expect(journey.getSnapshot().stage).toBe("storage");
    journey.dispose();
  });
  it("disposes resources and starts a new isolated run", () => {
    const old = createAssistedFixture("old"); old.journey.start(); old.journey.ready(); old.journey.dispose();
    const next = createAssistedFixture("next"); next.journey.start(); next.journey.ready();
    old.issuance(); old.result("valid");
    expect(next.journey.getSnapshot()).toMatchObject({ stage: "issuance", exchangeIds: [] });
    next.journey.fail();
    expect(next.journey.getSnapshot()).toMatchObject({ stage: "error", outcome: null });
  });
  it("rejects events beyond the deadline even before a delayed timer executes", () => {
    const journey = new AssistedJourney("r1", { ISSUE_CREDENTIAL: "issue" });
    journey.start(); journey.ready();
    vi.setSystemTime(Date.now() + 60_001);
    journey.observe(exchange());
    expect(journey.getSnapshot().stage).toBe("timeout");
  });
  it("does not restart issuance after a delayed startup exceeds its deadline", () => {
    const journey = new AssistedJourney("r1", { ISSUE_CREDENTIAL: "issue" });
    journey.start();
    vi.setSystemTime(Date.now() + 60_000);
    journey.ready();
    expect(journey.getSnapshot()).toMatchObject({ stage: "timeout", outcome: null, deadline: null });
    journey.ready(); journey.observe(exchange());
    expect(journey.getSnapshot().stage).toBe("timeout");
  });
  it("guards format, roles and tamper without blocking the Reference Wallet", () => {
    expect(assistedUnavailable(config)).toBeNull();
    expect(assistedUnavailable({ ...config, format: "vc_sd_jwt" })).toMatch(/SD-JWT/);
    expect(assistedUnavailable({ ...config, issuer: "mock_issuer" })).toMatch(/models/);
    expect(assistedUnavailable({ ...config, tamper: "bad_signature" })).toMatch(/tampering/);
    expect(assistedUnavailable({ ...config, wallet: "reference_wallet", format: "vc_sd_jwt" })).toBeNull();
  });
  it("consumes browser capture actors without treating Mimoto guest download as issuance or storage", () => {
    const journey = new AssistedJourney("r1", { ISSUE_CREDENTIAL: "issue", PRESENT_SUBMIT: "present" });
    journey.start(); journey.ready();
    journey.observe(exchange({ actorFrom: "browser", actorTo: "mimoto", request: { source: "har_import", capture: { ruleId: "mimoto-download" } } }));
    expect(journey.getSnapshot().stage).toBe("issuance");
    journey.observe(exchange({ actorFrom: "browser", actorTo: "certify", request: { source: "har_import", capture: { ruleId: "certify-credential" } } }));
    expect(journey.getSnapshot().stage).toBe("storage");
    journey.confirmStorage("r1");
    const present = exchange({ id: "e2", stepId: "present", seq: 0, actorFrom: "browser", actorTo: "verify", request: { source: "har_import", capture: { ruleId: "verify-submit" } } });
    journey.observe(present);
    expect(journey.getSnapshot().stage).toBe("presentation");
    journey.observe({ ...present, seq: 2 });
    expect(journey.getSnapshot().stage).toBe("result");
    journey.dispose();
  });
});
