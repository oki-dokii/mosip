import type { RequestHandler } from "express";

// Per process and transport peer. Express trust-proxy stays disabled; forwarded headers cannot reset the bucket.
export class CaptureRateGate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly limit = 10, private readonly windowMs = 60_000, private readonly now = Date.now) {}
  check(peer: string) {
    const now = this.now();
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
    let bucket = this.buckets.get(peer);
    if (!bucket) {
      if (this.buckets.size >= 1024) return 60;
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(peer, bucket);
    }
    bucket.count += 1;
    return bucket.count > this.limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
  }
}

export function captureIngress(gate = new CaptureRateGate()): RequestHandler {
  return (request, response, next) => {
    response.locals.captureRequest = true;
    if (request.method !== "POST") return next();
    const retryAfter = gate.check(request.socket.remoteAddress ?? "unknown");
    if (retryAfter) return void response.set("Retry-After", String(retryAfter)).status(429).json({ code: "CAPTURE_RATE_LIMITED" });
    if (!request.is("application/json")) return void response.status(415).json({ code: "CAPTURE_JSON_REQUIRED" });
    next();
  };
}
