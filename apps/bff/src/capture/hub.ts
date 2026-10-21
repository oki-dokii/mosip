import { randomUUID } from "node:crypto";
import type { CaptureOrigins } from "./har.js";
import type { CaptureService } from "./tagging.js";

type Claim = { runId: string; leaseId: string; expiresAt: number; inFlight: number };

// Attribution prototype only. No forwarding, listeners, URL rewriting, or request/body storage.
export class CaptureHub {
  private readonly claims = new Map<string, Claim>();
  private readonly counts = { attributed: 0, unmatched: 0, disabled: 0 };
  constructor(private readonly origins: CaptureOrigins, private readonly enabled = process.env.CAPTURE_HUB_ENABLED === "true", private readonly now = Date.now) {}
  claim(service: CaptureService, origin: string, runId: string, ttlMs = 60_000) {
    if (!this.enabled) throw new Error("CAPTURE_HUB_DISABLED");
    if (this.origins.get(origin) !== service || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(runId) || !Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 300_000) throw new Error("CAPTURE_HUB_INVALID_CLAIM");
    const key = `${service}|${origin}`;
    const previous = this.claims.get(key);
    if (previous && (previous.expiresAt > this.now() || previous.inFlight > 0)) throw new Error("CAPTURE_HUB_CLAIM_CONFLICT");
    if (!previous && this.claims.size >= 64) throw new Error("CAPTURE_HUB_FULL");
    const lease = { runId, leaseId: randomUUID(), expiresAt: this.now() + ttlMs, inFlight: 0 };
    this.claims.set(key, lease);
    return { leaseId: lease.leaseId, expiresAt: lease.expiresAt };
  }
  begin(service: CaptureService, origin: string) {
    if (!this.enabled) { this.counts.disabled++; return null; }
    const claim = this.claims.get(`${service}|${origin}`);
    if (!claim || claim.expiresAt <= this.now()) { this.counts.unmatched++; return null; }
    claim.inFlight++;
    this.counts.attributed++;
    let finished = false;
    return { runId: claim.runId, finish: () => { if (!finished) { claim.inFlight--; finished = true; } } };
  }
  release(service: CaptureService, origin: string, leaseId: string) {
    const key = `${service}|${origin}`;
    const claim = this.claims.get(key);
    if (!claim || claim.leaseId !== leaseId) throw new Error("CAPTURE_HUB_LEASE_MISMATCH");
    if (claim.inFlight) throw new Error("CAPTURE_HUB_DRAIN_REQUIRED");
    this.claims.delete(key);
  }
  stats() { return { ...this.counts }; }
}
