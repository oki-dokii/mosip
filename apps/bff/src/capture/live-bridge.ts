import { timingSafeEqual } from "node:crypto";
import type { Exchange } from "@playground/shared";
import { z } from "zod";
import type { RunRecord } from "../store.js";
import { captureOrigins, CaptureError, prepareHarImport, type CaptureOrigins } from "./har.js";
import { tagCapture } from "./tagging.js";

// A live collector sends only transport metadata and the verifier's opaque state.
// Never accept HAR, credentials, headers, response bodies or arbitrary payloads here.
const observationSchema = z.object({
  observedAt: z.string().datetime({ offset: true }),
  durationMs: z.number().finite().min(-1).max(120_000),
  method: z.literal("POST"),
  url: z.string().url().max(2048),
  status: z.number().int().min(200).max(299),
  state: z.string().min(32).max(2048).optional(),
}).strict();

const liveRules = new Set(["certify-credential", "mimoto-download", "verify-submit"]);

export function validBridgeToken(provided: unknown, configured = process.env.CAPTURE_BRIDGE_TOKEN): boolean {
  if (typeof configured !== "string" || configured.length < 32 || typeof provided !== "string") return false;
  const expected = Buffer.from(configured);
  const candidate = Buffer.from(provided);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function prepareLiveObservation(input: unknown, record: RunRecord, origins: CaptureOrigins = captureOrigins()): Exchange {
  const parsed = observationSchema.safeParse(input);
  if (!parsed.success) throw new CaptureError("CAPTURE_BRIDGE_INVALID");
  const observed = parsed.data;
  const observedAt = Date.parse(observed.observedAt);
  if (observedAt < Date.parse(record.run.createdAt) - 5_000 || observedAt > Date.now() + 5_000) throw new CaptureError("CAPTURE_BRIDGE_OUT_OF_WINDOW", 409);
  let url: URL;
  try { url = new URL(observed.url); } catch { throw new CaptureError("CAPTURE_BRIDGE_INVALID"); }
  if (url.search || url.hash || url.username || url.password) throw new CaptureError("CAPTURE_BRIDGE_INVALID");
  const service = origins.get(url.origin);
  if (!service) throw new CaptureError("CAPTURE_ORIGIN_NOT_ALLOWED", 422);
  const rule = tagCapture(service, observed.method, url.pathname);
  if (!rule || !liveRules.has(rule.id)) throw new CaptureError("CAPTURE_BRIDGE_UNTAGGED", 422);
  if (rule.id === "verify-submit" ? !observed.state : observed.state !== undefined) throw new CaptureError("CAPTURE_BRIDGE_INVALID");
  const entry = {
    startedDateTime: observed.observedAt,
    time: observed.durationMs,
    request: {
      method: observed.method,
      url: observed.url,
      headers: [],
      ...(observed.state ? { postData: { mimeType: "application/json", text: JSON.stringify({ state: observed.state }) } } : {}),
    },
    response: { status: observed.status, headers: [] },
  };
  const exchange = prepareHarImport({ runId: record.run.id, har: { log: { entries: [entry] } } }, record, origins, true).exchanges[0];
  if (!exchange) throw new CaptureError("CAPTURE_BRIDGE_INVALID");
  const request = exchange.request as Record<string, unknown>;
  const response = exchange.response as Record<string, unknown>;
  request.source = "live_bridge";
  response.source = "live_bridge";
  request.capture = { ...(request.capture as Record<string, unknown>), provenance: "operator_browser_har_metadata", payloadCaptured: false,
    downstreamCertifyObserved: rule.id === "certify-credential" };
  return exchange;
}
