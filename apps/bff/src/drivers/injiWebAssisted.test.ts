import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exchange } from "@playground/shared";
import { InjiWebAssistedDriver, type AssistedObservation, type AssistedObservationSource } from "./injiWebAssisted.js";
import type { DriverContext } from "./types.js";

class Source implements AssistedObservationSource {
  listeners = new Set<(event: AssistedObservation) => void>();
  events: AssistedObservation[] = [];
  snapshot = () => this.events;
  subscribe = (listener: (event: AssistedObservation) => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  emit(event: AssistedObservation) { this.events.push(event); this.listeners.forEach((listener) => listener(event)); }
}
const issue: Exchange = { id: "issued", runId: "run", stepId: "issue", seq: 1, actorFrom: "inji_web_assisted", actorTo: "inji_certify", method: "POST", url: "https://issuer.example/credential", status: 200, durationMs: 1, request: { source: "fixture" }, response: { received: true }, redactions: [] };
const presentation: Exchange = { ...issue, id: "presented", stepId: "present", seq: 2, actorTo: "inji_verify", url: "https://verifier.example/direct-post" };
const context = (): DriverContext => ({ config: { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null }, state: new Map() });
describe("Inji Web assisted wallet driver", () => {
  let source: Source;
  let abort: AbortController;
  let driver: InjiWebAssistedDriver;
  beforeEach(() => {
    vi.useFakeTimers(); source = new Source(); abort = new AbortController();
    driver = new InjiWebAssistedDriver({ runId: "run", stepIds: { ISSUE_CREDENTIAL: "issue", PRESENT_SUBMIT: "present" }, source, signal: abort.signal, timeoutMs: 1000 });
  });
  afterEach(() => { expect(source.listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
  const emit = (exchange: Exchange) => source.emit({ kind: "exchange", exchange });
  const storage = () => source.emit({ kind: "storage_confirmation", runId: "run", issuanceExchangeId: "issued", source: "fixture" });
  it("observes issuance, separately confirms storage, and leaves verification to the verifier", async () => {
    const c = context();
    expect((await driver.authorize(c)).summary).toMatchObject({ loginObserved: false });
    const pending = driver.requestCredential(c);
    expect(source.listeners.size).toBe(1);
    emit({ ...issue, runId: "wrong" }); emit({ ...issue, actorFrom: "reference_wallet" }); emit({ ...issue, status: 400 }); emit(presentation);
    expect(source.listeners.size).toBe(1);
    emit(issue);
    expect((await pending).summary).toMatchObject({ issuanceObserved: true, storageConfirmed: false });
    const storing = driver.store(c);
    emit(issue);
    source.emit({ kind: "storage_confirmation", runId: "wrong", issuanceExchangeId: "issued", source: "fixture" });
    source.emit({ kind: "storage_confirmation", runId: "run", issuanceExchangeId: "other", source: "fixture" });
    expect(source.listeners.size).toBe(1);
    storage();
    expect((await storing).summary).toMatchObject({ storageConfirmed: true, confirmationSource: "fixture" });
    const presenting = driver.present(c);
    expect((await presenting).summary).toMatchObject({ presentationObserved: true, verifierResultPending: true });
    expect(c.state.size).toBe(0);
  });
  it.each(["issuance", "storage", "presentation"])("cancels during %s and ignores late events", async (stage) => {
    const c = context();
    if (stage !== "issuance") { emit(issue); await driver.requestCredential(c); }
    if (stage === "presentation") { storage(); await driver.store(c); }
    const pending = stage === "issuance" ? driver.requestCredential(c) : stage === "storage" ? driver.store(c) : driver.present(c);
    const assertion = expect(pending).rejects.toMatchObject({ reason: "cancelled" });
    abort.abort(); emit(issue); storage(); emit(presentation);
    await assertion;
  });
  it.each(["issuance", "storage", "presentation"])("times out during %s and releases subscriptions", async (stage) => {
    const c = context();
    if (stage !== "issuance") { emit(issue); await driver.requestCredential(c); }
    if (stage === "presentation") { storage(); await driver.store(c); }
    const pending = stage === "issuance" ? driver.requestCredential(c) : stage === "storage" ? driver.store(c) : driver.present(c);
    const assertion = expect(pending).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1000); await assertion;
    emit(presentation);
  });
  it("rejects unsupported format and pre-cancelled runs", async () => {
    await expect(driver.authorize({ ...context(), config: { ...context().config, format: "vc_sd_jwt" } })).rejects.toMatchObject({ reason: "unsupported" });
    abort.abort();
    await expect(driver.requestCredential(context())).rejects.toMatchObject({ reason: "cancelled" });
  });
  it("rejects storage and presentation before issuance", async () => {
    await expect(driver.store(context())).rejects.toMatchObject({ reason: "observation_error" });
    await expect(driver.present(context())).rejects.toMatchObject({ reason: "observation_error" });
  });
  it("handles source failures without exposing their error text", async () => {
    source.snapshot = () => { throw new Error("private upstream error body"); };
    await expect(driver.requestCredential(context())).rejects.toMatchObject({ reason: "observation_error", message: "ASSISTED_OBSERVATION_ERROR: issuance" });
  });
  it("cleans up a source that delivers synchronously during subscribe", async () => {
    source.subscribe = (listener) => { source.listeners.add(listener); listener({ kind: "exchange", exchange: issue }); return () => { source.listeners.delete(listener); }; };
    expect((await driver.requestCredential(context())).summary).toMatchObject({ issuanceObserved: true });
  });
  it("does not accept presentation evidence sequenced before issuance", async () => {
    emit(issue); await driver.requestCredential(context()); storage(); await driver.store(context());
    emit({ ...presentation, seq: 0 });
    const pending = driver.present(context());
    expect(source.listeners.size).toBe(1);
    emit(presentation); await pending;
  });
  it("keeps timeout terminal even if more evidence arrives or the same driver is retried", async () => {
    const pending = driver.requestCredential(context());
    const assertion = expect(pending).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1000); await assertion;
    emit(issue); storage(); emit(presentation);
    await expect(driver.requestCredential(context())).rejects.toMatchObject({ reason: "timeout" });
    await expect(driver.store(context())).rejects.toMatchObject({ reason: "timeout" });
  });
  it("does not create two subscriptions for concurrent actions", async () => {
    const pending = driver.requestCredential(context());
    await expect(driver.requestCredential(context())).rejects.toMatchObject({ reason: "observation_error" });
    expect(source.listeners.size).toBe(1);
    emit(issue); await pending;
  });
  it("consumes the frozen capture actors/rules and never substitutes guest download for issuance", async () => {
    const pending = driver.requestCredential(context());
    emit({ ...issue, actorFrom: "browser", actorTo: "mimoto", request: { source: "har_import", capture: { ruleId: "mimoto-download" } } });
    expect(source.listeners.size).toBe(1);
    emit({ ...issue, actorFrom: "browser", actorTo: "certify", request: { source: "har_import", capture: { ruleId: "certify-credential" } } });
    await pending; storage(); await driver.store(context());
    const presenting = driver.present(context());
    emit({ ...presentation, actorFrom: "browser", actorTo: "verify", request: { source: "har_import", capture: { ruleId: "verify-submit" } } });
    expect((await presenting).summary).toMatchObject({ presentationObserved: true, verifierResultPending: true });
  });
  it("accepts a live Mimoto browser download as transport evidence with downstream Certify unobserved", async () => {
    const pending = driver.requestCredential(context());
    emit({ ...issue, actorFrom: "browser", actorTo: "mimoto", request: { source: "live_bridge", capture: { ruleId: "mimoto-download" } } });
    expect((await pending).summary).toMatchObject({ issuanceObserved: true, issuanceTransport: "mimoto_browser_download", downstreamCertifyObserved: false });
  });
});

it("does not advance presentation for unrelated same-run traffic", async () => {
  const source = new Source(); const abort = new AbortController();
  const driver = new InjiWebAssistedDriver({ runId: "run", stepIds: { ISSUE_CREDENTIAL: "issue", PRESENT_SUBMIT: "present" }, source, signal: abort.signal, presentationMatches: exchange => (exchange.request as any)?.correlation === "expected-request" });
  source.emit({ kind: "exchange", exchange: issue }); await driver.requestCredential(context());
  source.emit({ kind: "storage_confirmation", runId: "run", issuanceExchangeId: "issued", source: "fixture" }); await driver.store(context());
  let finished = false;
  const pending = driver.present(context()).then(result => { finished = true; return result; });
  source.emit({ kind: "exchange", exchange: presentation }); await Promise.resolve();
  expect(finished).toBe(false);
  source.emit({ kind: "exchange", exchange: { ...presentation, id: "matching", request: { source: "fixture", correlation: "expected-request" } } });
  expect((await pending).summary?.exchangeId).toBe("matching");
  expect(source.listeners.size).toBe(0);
});
