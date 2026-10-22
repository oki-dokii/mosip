import type { Exchange, RunConfig } from "@playground/shared";

export type JourneyStage = "idle" | "starting" | "issuance" | "storage" | "presentation" | "result" | "complete" | "cancelled" | "timeout" | "error";
export interface JourneySnapshot {
  runId: string;
  stage: JourneyStage;
  deadline: number | null;
  outcome: "valid" | "invalid" | null;
  message: string | null;
  exchangeIds: string[];
}
export interface JourneyClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
const clock: JourneyClock = { now: () => Date.now(), setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (timer) => clearTimeout(timer) };
export const activeStages: JourneyStage[] = ["starting", "issuance", "storage", "presentation", "result"];

export function assistedUnavailable(config: RunConfig): string | null {
  if (config.wallet !== "inji_web_assisted") return null;
  if (config.format !== "ldp_vc") return "Inji Web presentation supports JSON-LD only. SD-JWT Web presentation is unavailable.";
  if (config.issuer !== "inji_certify" || config.verifier !== "inji_verify") return "The assisted fixture journey models Inji Certify → Inji Web → Inji Verify.";
  if (config.tamper) return "Assisted wallet credential tampering is unavailable. Use the Reference Wallet for fault scenarios.";
  return null;
}

// A run-local state machine. It consumes already-redacted evidence, never credentials.
export class AssistedJourney {
  private snapshot: JourneySnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private issuanceSeq = Infinity;
  constructor(readonly runId: string, private readonly stepIds: Record<string, string>, private readonly durationMs = 60_000, private readonly time = clock) {
    this.snapshot = { runId, stage: "idle", deadline: null, outcome: null, message: null, exchangeIds: [] };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private move(stage: JourneyStage, message: string | null = null, outcome: JourneySnapshot["outcome"] = null) {
    if (this.timer !== undefined) this.time.clearTimeout(this.timer);
    this.timer = undefined;
    const waiting = activeStages.includes(stage);
    this.snapshot = { ...this.snapshot, stage, message, outcome, deadline: waiting ? this.time.now() + this.durationMs : null };
    if (waiting) this.timer = this.time.setTimeout(() => this.move("timeout", `Timed out waiting for ${stage}. No verifier verdict was established.`), this.durationMs);
    this.listeners.forEach((listener) => listener());
  }
  start() { if (this.snapshot.stage === "idle") this.move("starting"); }
  ready() { if (this.snapshot.stage === "starting") this.move("issuance"); }
  private expired() {
    if (this.snapshot.deadline !== null && this.time.now() >= this.snapshot.deadline) {
      this.move("timeout", `Timed out waiting for ${this.snapshot.stage}. No verifier verdict was established.`);
      return true;
    }
    return false;
  }
  observe(exchange: Exchange) {
    if (this.expired() || exchange.runId !== this.runId || this.snapshot.exchangeIds.includes(exchange.id) || exchange.method !== "POST" || exchange.status < 200 || exchange.status >= 300) return;
    const request = exchange.request as { source?: unknown; capture?: { ruleId?: unknown } } | null;
    const fixture = request?.source === "fixture" && exchange.actorFrom === "inji_web_assisted";
    const captured = request?.source === "har_import" && exchange.actorFrom === "browser";
    const issuanceSource = (fixture && exchange.actorTo === "inji_certify") || (captured && exchange.actorTo === "certify" && request?.capture?.ruleId === "certify-credential");
    const presentationSource = (fixture && exchange.actorTo === "inji_verify") || (captured && exchange.actorTo === "verify" && request?.capture?.ruleId === "verify-submit");
    const issuance = this.snapshot.stage === "issuance" && exchange.stepId === this.stepIds.ISSUE_CREDENTIAL && issuanceSource;
    const presentation = this.snapshot.stage === "presentation" && exchange.stepId === this.stepIds.PRESENT_SUBMIT && presentationSource && exchange.seq > this.issuanceSeq;
    if (!issuance && !presentation) return;
    if (issuance) this.issuanceSeq = exchange.seq;
    this.snapshot = { ...this.snapshot, exchangeIds: [...this.snapshot.exchangeIds, exchange.id] };
    this.move(issuance ? "storage" : "result");
  }
  // Explicit wallet confirmation is distinct from browser HTTP capture.
  confirmStorage(runId: string) { if (!this.expired() && runId === this.runId && this.snapshot.stage === "storage") this.move("presentation"); }
  verifierResult(runId: string, outcome: "valid" | "invalid") {
    if (!this.expired() && runId === this.runId && this.snapshot.stage === "result" && (outcome === "valid" || outcome === "invalid")) this.move("complete", null, outcome);
  }
  cancel() { if (activeStages.includes(this.snapshot.stage)) this.move("cancelled", "Cancelled. No verifier verdict was established."); }
  fail() { if (activeStages.includes(this.snapshot.stage)) this.move("error", "The assisted observation source could not continue. No verifier verdict was established."); }
  dispose() {
    this.cancel();
    if (this.timer !== undefined) this.time.clearTimeout(this.timer);
    this.listeners.clear();
  }
}
