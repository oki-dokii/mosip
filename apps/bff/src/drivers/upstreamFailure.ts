/** Only allowlisted transport metadata may cross from a live upstream failure into run evidence. */
export class UpstreamHttpFailure extends Error {
  readonly method: string;
  readonly origin: string;
  readonly status: number;
  readonly durationMs: number;
  readonly errorCode: string | null;

  constructor(input: { method: string; url: string; status: number; durationMs: number; body: unknown }) {
    super(`Upstream request failed with HTTP ${input.status}`);
    this.name = "UpstreamHttpFailure";
    this.method = input.method;
    this.origin = new URL(input.url).origin;
    this.status = input.status;
    this.durationMs = input.durationMs;
    const body = input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? input.body as Record<string, unknown> : null;
    const candidate = body?.errorCode ?? body?.error;
    const publicCodes = new Set(["invalid_request", "invalid_client", "invalid_grant", "invalid_token", "invalid_proof", "invalid_vp_token", "access_denied", "unsupported_response_type"]);
    this.errorCode = typeof candidate === "string" && publicCodes.has(candidate) ? candidate : null;
  }
}
