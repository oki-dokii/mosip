import type { Exchange } from "@playground/shared";
import type { DriverContext, DriverResult, WalletDriver } from "./types.js";

export type AssistedObservation = { kind: "exchange"; exchange: Exchange } | { kind: "storage_confirmation"; runId: string; issuanceExchangeId: string; source: "fixture" | "wallet_confirmation" };
export interface AssistedObservationSource {
  // Source must contain only redacted exchanges. Subscribe first, then replay the snapshot.
  snapshot(): readonly AssistedObservation[];
  subscribe(listener: (observation: AssistedObservation) => void): () => void;
}
export class AssistedWaitError extends Error {
  constructor(readonly reason: "cancelled" | "timeout" | "unsupported" | "observation_error", readonly checkpoint: string) {
    super(`ASSISTED_${reason.toUpperCase()}: ${checkpoint}`);
    this.name = "AssistedWaitError";
  }
}
export interface AssistedDriverOptions {
  runId: string;
  stepIds: { ISSUE_CREDENTIAL: string; PRESENT_SUBMIT: string };
  source: AssistedObservationSource;
  signal: AbortSignal;
  timeoutMs?: number;
  presentationMatches?: (exchange: Exchange) => boolean;
}

// No wallet credentials, cookies, keys, token exchange or presentation generation here.
// Registry, API cancellation and capture-source wiring are an integrator handoff.
export class InjiWebAssistedDriver implements WalletDriver {
  readonly id = "inji_web_assisted" as const;
  private issued: Pick<Exchange, "id" | "seq"> | undefined;
  private stored = false;
  private presented = false;
  private terminal: AssistedWaitError | undefined;
  private waiting = false;
  constructor(private readonly options: AssistedDriverOptions) {}
  private check(context: DriverContext) {
    if (this.terminal) throw this.terminal;
    if (context.config.wallet !== this.id || context.config.format !== "ldp_vc" || context.config.issuer !== "inji_certify" || context.config.verifier !== "inji_verify" || context.config.tamper) {
      throw new AssistedWaitError("unsupported", "JSON-LD assisted Inji Web");
    }
    if (this.options.signal.aborted) throw new AssistedWaitError("cancelled", "wallet action");
  }
  private wait(checkpoint: string, matches: (observation: AssistedObservation) => boolean): Promise<AssistedObservation> {
    if (this.waiting) return Promise.reject(new AssistedWaitError("observation_error", "wallet action already pending"));
    this.waiting = true;
    const { source, signal } = this.options;
    const deadline = Date.now() + (this.options.timeoutMs ?? 60_000);
    return new Promise((resolve, reject) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: AssistedWaitError, observation?: AssistedObservation) => {
        if (settled) return;
        settled = true;
        this.waiting = false;
        if (error) this.terminal = error;
        if (timer !== undefined) clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        try { unsubscribe?.(); } catch { /* Never expose source cleanup errors. */ }
        if (error) reject(error); else resolve(observation!);
      };
      const abort = () => finish(signal.reason instanceof AssistedWaitError ? signal.reason : new AssistedWaitError("cancelled", checkpoint));
      const receive = (observation: AssistedObservation) => {
        if (signal.aborted) { abort(); return; }
        if (Date.now() >= deadline) { finish(new AssistedWaitError("timeout", checkpoint)); return; }
        if (matches(observation)) finish(undefined, observation);
      };
      signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => finish(new AssistedWaitError("timeout", checkpoint)), this.options.timeoutMs ?? 60_000);
      if (signal.aborted) { abort(); return; }
      try {
        unsubscribe = source.subscribe(receive);
        // Sources may deliver synchronously during subscribe.
        if (settled) { unsubscribe(); return; }
        for (const observation of source.snapshot()) {
          if (settled) break;
          receive(observation);
        }
      } catch { finish(new AssistedWaitError("observation_error", checkpoint)); }
    });
  }
  private exchange(observation: AssistedObservation, stepId: string, actorTo: string): boolean {
    if (observation.kind !== "exchange") return false;
    const value = observation.exchange;
    const request = value.request as { source?: unknown; capture?: { ruleId?: unknown } } | null;
    const fixture = request?.source === "fixture" && value.actorFrom === this.id && value.actorTo === actorTo;
    const browserSource = request?.source === "har_import" || request?.source === "live_bridge";
    const issuance = actorTo === "inji_certify" && ((value.actorTo === "certify" && request?.capture?.ruleId === "certify-credential") ||
      (request?.source === "live_bridge" && value.actorTo === "mimoto" && ["mimoto-download", "mimoto-wallet-credential"].includes(String(request?.capture?.ruleId))));
    const presentation = actorTo === "inji_verify" && ((value.actorTo === "verify" && request?.capture?.ruleId === "verify-submit") ||
      (request?.source === "live_bridge" && value.actorTo === "mimoto" && request?.capture?.ruleId === "mimoto-wallet-presentation"));
    const capture = browserSource && value.actorFrom === "browser" && (issuance || presentation);
    return value.runId === this.options.runId && value.stepId === stepId && (fixture || capture) && value.method === "POST" && value.status >= 200 && value.status < 300;
  }
  async authorize(context: DriverContext): Promise<DriverResult> {
    this.check(context);
    return { summary: { loginObserved: false, loginLocation: "Inji Web/Mimoto", awaiting: "issuance" } };
  }
  async requestCredential(context: DriverContext): Promise<DriverResult> {
    this.check(context);
    if (this.issued) throw new AssistedWaitError("observation_error", "issuance already observed");
    const observation = await this.wait("issuance", (value) => this.exchange(value, this.options.stepIds.ISSUE_CREDENTIAL, "inji_certify"));
    if (observation.kind === "exchange") this.issued = { id: observation.exchange.id, seq: observation.exchange.seq };
    const route = observation.kind === "exchange" ? (observation.exchange.request as { capture?: { ruleId?: string } })?.capture?.ruleId : undefined;
    return { summary: { issuanceObserved: true, exchangeId: observation.kind === "exchange" ? observation.exchange.id : undefined,
      issuanceTransport: route === "mimoto-wallet-credential" ? "mimoto_wallet_credential_post" : route === "mimoto-download" ? "mimoto_browser_download" : "certify_browser_credential",
      downstreamCertifyObserved: !["mimoto-download", "mimoto-wallet-credential"].includes(String(route)), storageConfirmed: false } };
  }
  async store(context: DriverContext): Promise<DriverResult> {
    this.check(context);
    if (!this.issued) throw new AssistedWaitError("observation_error", "issuance must precede storage");
    if (this.stored) throw new AssistedWaitError("observation_error", "storage already confirmed");
    const observation = await this.wait("storage confirmation", (value) => value.kind === "storage_confirmation" && value.runId === this.options.runId && value.issuanceExchangeId === this.issued?.id && ["fixture", "wallet_confirmation"].includes(value.source));
    this.stored = true;
    return { summary: { storageConfirmed: true, confirmationSource: observation.kind === "storage_confirmation" ? observation.source : undefined } };
  }
  async present(context: DriverContext): Promise<DriverResult> {
    this.check(context);
    if (!this.stored || this.presented) throw new AssistedWaitError("observation_error", "presentation ordering");
    const observation = await this.wait("presentation", (value) => this.exchange(value, this.options.stepIds.PRESENT_SUBMIT, "inji_verify") && value.kind === "exchange" && value.exchange.seq > (this.issued?.seq ?? Infinity) && (this.options.presentationMatches?.(value.exchange) ?? true));
    this.presented = true;
    const route = observation.kind === "exchange" ? (observation.exchange.request as { capture?: { ruleId?: string } })?.capture?.ruleId : undefined;
    return { summary: { presentationObserved: true, exchangeId: observation.kind === "exchange" ? observation.exchange.id : undefined,
      presentationTransport: route === "mimoto-wallet-presentation" ? "mimoto_browser_presentation" : route === "verify-submit" ? "verify_browser_direct_post" : "fixture",
      downstreamVerifyObserved: route === "verify-submit", verifierResultPending: true } };
  }
}
