import { withExchangeLock } from "./exchangeLock.js";
import { randomUUID } from "node:crypto";
import type { Exchange, RunConfig } from "@playground/shared";
import type { Server } from "socket.io";
import type { RunRepository } from "./store.js";
import { createSteps, runDemo } from "./orchestrator.js";
import { createFixtureDrivers } from "./drivers/fixture.js";
import { createCollabDrivers } from "./drivers/collab.js";
import { AssistedWaitError, InjiWebAssistedDriver, type AssistedObservation } from "./drivers/injiWebAssisted.js";
import { snapshotVersions } from "./versions.js";

export class AssistedRuns {
  private sessions = new Map<string, { abort: AbortController; mode: "fixture" | "live"; confirmations: AssistedObservation[]; actions: Record<string, string>; deadlineAt: number }>();
  constructor(private readonly repository: RunRepository, private readonly io: () => Server) {}
  available() { return process.env.ASSISTED_LIVE_ENABLED === "true" && !!this.link(process.env.ASSISTED_WALLET_URL) && !!this.link(process.env.ASSISTED_OFFER_URL) && !!this.link(process.env.CERTIFY_BASE_URL) && !!this.link(process.env.VERIFY_BASE_URL) && !!process.env.VERIFY_CLIENT_ID; }
  private link(value?: string) { try { const u = new URL(value ?? ""); return u.protocol === "https:" && !u.username && !u.password ? u.href : null; } catch { return null; } }
  active(id: string) { const session = this.sessions.get(id); return !!session && !session.abort.signal.aborted; }
  async start(config: RunConfig, mode: "fixture" | "live", timeoutMs = 60_000) {
    if (config.wallet !== "inji_web_assisted" || config.format !== "ldp_vc" || config.issuer !== "inji_certify" || config.verifier !== "inji_verify" || config.tamper || config.scenarioId) throw new Error("ASSISTED_UNSUPPORTED");
    if (mode === "live" && !this.available()) throw new Error("ASSISTED_LIVE_BLOCKED");
    if (this.sessions.size >= 32) throw new Error("ASSISTED_CAPACITY");
    const id = randomUUID(); const steps = createSteps(id);
    await this.repository.create({ run: { id, parentRunId: null, config, status: "pending", expectedOutcome: "valid", actualOutcome: null, proofType: "Ed25519Signature2020", algorithm: "EdDSA", serviceVersions: snapshotVersions(config, mode === "fixture" ? "fixture" : "collab"), createdAt: new Date().toISOString(), startedAt: null, finishedAt: null }, steps, exchanges: [] });
    const session = { abort: new AbortController(), mode, confirmations: [] as AssistedObservation[], actions: {} as Record<string, string>, deadlineAt: Date.now() + timeoutMs };
    if (mode === "live") session.actions = { walletUrl: this.link(process.env.ASSISTED_WALLET_URL)!, offerUrl: this.link(process.env.ASSISTED_OFFER_URL)! };
    this.sessions.set(id, session);
    let cached: AssistedObservation[] = [];
    const source = {
      snapshot: () => [...cached, ...session.confirmations],
      subscribe: (listener: (event: AssistedObservation) => void) => {
        let stopped = false;
        const poll = async () => { const record = await this.repository.get(id); if (stopped) return; cached = (record?.exchanges ?? []).map(exchange => ({ kind: "exchange" as const, exchange })); for (const event of [...cached, ...session.confirmations]) listener(event); };
        const timer = setInterval(() => { void poll().catch(() => session.abort.abort(new AssistedWaitError("observation_error", "capture source"))); }, 50);
        void poll().catch(() => session.abort.abort(new AssistedWaitError("observation_error", "capture source")));
        return () => { stopped = true; clearInterval(timer); };
      },
    };
    const drivers = mode === "fixture" ? createFixtureDrivers(config) : createCollabDrivers(config);
    drivers.wallet = new InjiWebAssistedDriver({ runId: id, stepIds: { ISSUE_CREDENTIAL: steps.find(s => s.stepKey === "ISSUE_CREDENTIAL")!.id, PRESENT_SUBMIT: steps.find(s => s.stepKey === "PRESENT_SUBMIT")!.id }, source, signal: session.abort.signal, timeoutMs });
    const createRequest = drivers.verifier.createRequest.bind(drivers.verifier);
    drivers.verifier.createRequest = async context => { const result = await createRequest(context); const link = context.state.get("assisted.presentationUrl"); if (typeof link === "string") session.actions.presentationUrl = link; return result; };
    void runDemo(id, this.io(), this.repository, 0, drivers, session.abort.signal, timeoutMs, () => { session.deadlineAt = Date.now() + timeoutMs; }).catch(() => {}).finally(() => { session.abort.abort(); this.sessions.delete(id); });
    return id;
  }
  async status(id: string) { const record = await this.repository.get(id); if (!record || record.run.config.wallet !== "inji_web_assisted") return null;
    if (!this.sessions.has(id) && ["pending", "running"].includes(record.run.status)) {
      record.run.status = "errored"; record.run.actualOutcome = "error"; record.run.finishedAt = new Date().toISOString();
      for (const step of record.steps.filter(step => step.status === "running")) { step.status = "failed"; step.summary = { error: "ASSISTED_INTERRUPTED" }; await this.repository.updateStep(step); }
      await this.repository.updateRun(record.run);
    }
    return { run: record.run, steps: record.steps, actions: this.sessions.get(id)?.actions ?? {}, deadlineAt: this.sessions.get(id)?.deadlineAt ?? null }; }
  async cancel(id: string) { this.sessions.get(id)?.abort.abort(); return this.status(id); }
  async observe(id: string, kind: "issuance" | "storage" | "presentation") {
    const session = this.sessions.get(id); const record = await this.repository.get(id);
    if (!session || !record || session.abort.signal.aborted) throw new Error("ASSISTED_INACTIVE");
    const stepKey = kind === "issuance" ? "ISSUE_CREDENTIAL" : kind === "storage" ? "STORE" : "PRESENT_SUBMIT";
    const step = record.steps.find(s => s.stepKey === stepKey && s.status === "running");
    if (!step) throw new Error("ASSISTED_WRONG_STAGE");
    if (kind === "storage") {
      const issue = record.steps.find(s => s.stepKey === "ISSUE_CREDENTIAL")?.summary?.exchangeId;
      if (typeof issue !== "string") throw new Error("ASSISTED_NO_ISSUANCE");
      if (session.confirmations.length) return;
      session.confirmations.push({ kind: "storage_confirmation", runId: id, issuanceExchangeId: issue, source: session.mode === "fixture" ? "fixture" : "wallet_confirmation" });
      return;
    }
    if (session.mode !== "fixture") throw new Error("ASSISTED_FIXTURE_ONLY");
    await withExchangeLock(this.repository, id, async () => {
    const fresh = await this.repository.get(id);
    if (session.abort.signal.aborted || !fresh) throw new Error("ASSISTED_INACTIVE");
    const exchange: Exchange = { id: randomUUID(), runId: id, stepId: step.id, seq: Math.max(0, ...fresh.exchanges.map(e => e.seq)) + 1, actorFrom: "inji_web_assisted", actorTo: kind === "issuance" ? "inji_certify" : "inji_verify", method: "POST", url: "https://fixture.example/observed", status: 200, durationMs: 0, redactions: [], request: { source: "fixture" }, response: { observed: true } };
    await this.repository.addExchange(exchange);
    });
  }
}
