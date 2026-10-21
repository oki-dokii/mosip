import { createHash } from "node:crypto";
import type { Exchange } from "@playground/shared";
import type { RunRecord } from "../store.js";

type Service = "mimoto" | "certify" | "esignet" | "verify";
export type CaptureOrigins = ReadonlyMap<string, Service>;

const DEFAULT_ORIGINS: [string, Service][] = [
  ["https://injiweb.collab.mosip.net", "mimoto"],
  ["https://injicertify-mock.collab.mosip.net", "certify"],
  ["https://injicertify-farmer.collab.mosip.net", "certify"],
  ["https://injicertify.collab.mosip.net", "certify"],
  ["https://esignet-mock.collab.mosip.net", "esignet"],
  ["https://injiverify.collab.mosip.net", "verify"],
];

export function captureOrigins(): CaptureOrigins {
  const origins = new Map(DEFAULT_ORIGINS);
  if (process.env.CAPTURE_ORIGINS_JSON) {
    const configured: unknown = JSON.parse(process.env.CAPTURE_ORIGINS_JSON);
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) throw new Error("Invalid capture origin configuration");
    for (const [origin, service] of Object.entries(configured)) {
      const url = new URL(origin);
      if (url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
        throw new Error("Invalid capture origin configuration");
      }
      if (!["mimoto", "certify", "esignet", "verify"].includes(String(service))) throw new Error("Invalid capture origin configuration");
      origins.set(origin, service as Service);
    }
  }
  return origins;
}

export class CaptureError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}

type Route = { stepKey: string; template: string; actorTo: string };

function routeFor(service: Service, path: string): Route | null {
  if (service === "mimoto") {
    if (!path.startsWith("/v1/mimoto/")) return null;
    if (/issuers|issuer-metadata|\.well-known/.test(path)) return { stepKey: "ISSUE_OFFER", template: "/v1/mimoto/issuers/{id}", actorTo: "mimoto" };
    if (/credential|download/.test(path)) return { stepKey: "ISSUE_CREDENTIAL", template: "/v1/mimoto/credential/{id}", actorTo: "mimoto" };
    if (/wallet|store/.test(path)) return { stepKey: "STORE", template: "/v1/mimoto/wallet/{id}", actorTo: "mimoto" };
    if (/authorize|consent/.test(path)) return { stepKey: "PRESENT_SUBMIT", template: "/v1/mimoto/authorize/{id}", actorTo: "mimoto" };
    return null;
  }
  if (service === "certify") {
    if (/\.well-known|credential-offer|issuer-metadata|credential-config/.test(path)) return { stepKey: "ISSUE_OFFER", template: "/issuer-metadata/{id}", actorTo: "certify" };
    if (/token|authorize/.test(path)) return { stepKey: "ISSUE_TOKEN", template: "/token/{id}", actorTo: "certify" };
    if (/credential/.test(path)) return { stepKey: "ISSUE_CREDENTIAL", template: "/credential/{id}", actorTo: "certify" };
    return null;
  }
  if (service === "esignet") {
    if (/authorize|token|oauth|login|authenticate|consent/.test(path)) return { stepKey: "ISSUE_TOKEN", template: "/authorization/{id}", actorTo: "esignet" };
    return null;
  }
  if (/vp-request|request-object/.test(path)) return { stepKey: "PRESENT_REQUEST", template: "/vp-request/{id}", actorTo: "verify" };
  if (/direct-post|vp-submission|presentation/.test(path)) return { stepKey: "PRESENT_SUBMIT", template: "/direct-post/{id}", actorTo: "verify" };
  if (/status/.test(path)) return { stepKey: "PRESENT_STATUS", template: "/status/{id}", actorTo: "verify" };
  if (/result/.test(path)) return { stepKey: "PRESENT_RESULT", template: "/result/{id}", actorTo: "verify" };
  return null;
}

const SAFE_ENUMS: Record<string, Set<string>> = {
  format: new Set(["vc+sd-jwt", "dc+sd-jwt", "ldp_vc", "jwt_vc_json", "vc_sd_jwt"]),
  grant_type: new Set(["urn:ietf:params:oauth:grant-type:pre-authorized_code", "authorization_code"]),
  response_mode: new Set(["direct_post", "direct_post.jwt", "fragment", "query"]),
  token_type: new Set(["Bearer", "DPoP"]),
  status: new Set(["valid", "invalid", "pending", "completed", "success", "failed", "error"]),
};

function safeKey(key: string) { return /^[a-zA-Z][\w.-]{0,63}$/.test(key) ? key : "[field]"; }

function bodyShape(value: unknown, path: string, redactions: string[], depth = 0): unknown {
  if (depth >= 8) { redactions.push(path); return "[REDACTED]"; }
  if (Array.isArray(value)) return value.slice(0, 32).map((item, index) => bodyShape(item, `${path}[${index}]`, redactions, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [rawKey, item] of Object.entries(value).slice(0, 64)) {
      const key = safeKey(rawKey);
      result[key] = bodyShape(item, `${path}.${key}`, redactions, depth + 1);
      if (typeof item === "string" && SAFE_ENUMS[key]?.has(item)) result[key] = item;
    }
    return result;
  }
  if (value === null) return null;
  redactions.push(path);
  return "[REDACTED]";
}

function headers(value: unknown, path: string, redactions: string[]) {
  if (!Array.isArray(value)) return {};
  if (value.length > 64) throw new CaptureError("CAPTURE_ENTRY_TOO_LARGE", 413);
  const output: Record<string, string> = {};
  for (const item of value) {
    if (!item || typeof item.name !== "string") continue;
    const name = item.name.toLowerCase();
    if (name === "content-type") {
      const mime = String(item.value ?? "").split(";")[0]?.trim().toLowerCase();
      if (mime && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)) output[name] = mime;
    } else if (["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key", "x-xsrf-token", "x-csrf-token", "www-authenticate"].includes(name)) {
      output[name] = "[REDACTED]";
      redactions.push(`${path}.${name}`);
    }
  }
  return output;
}

function body(part: Record<string, unknown>, path: string, redactions: string[]) {
  const payload = part.postData ?? part.content;
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const text = data.text;
  if (typeof text !== "string") return null;
  if (text.length > 131_072) throw new CaptureError("CAPTURE_ENTRY_TOO_LARGE", 413);
  const mime = (String(data.mimeType ?? "").split(";")[0] ?? "").toLowerCase();
  if (mime === "application/json" || mime.endsWith("+json")) {
    try { return bodyShape(JSON.parse(text), path, redactions); }
    catch { redactions.push(path); return "[REDACTED: malformed JSON]"; }
  }
  if (mime === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [rawKey] of params) {
      const key = safeKey(rawKey);
      result[key] = "[REDACTED]";
      redactions.push(`${path}.${key}`);
    }
    return result;
  }
  redactions.push(path);
  return "[REDACTED]";
}

function deterministicId(runId: string, entry: Record<string, unknown>) {
  const request = entry.request as Record<string, unknown>;
  const digest = createHash("sha256").update(JSON.stringify([runId, entry.startedDateTime, request.method, request.url, entry.time, (entry.response as Record<string, unknown>).status])).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function prepareHarImport(input: unknown, record: RunRecord, origins: CaptureOrigins = captureOrigins()) {
  if (!input || typeof input !== "object") throw new CaptureError("CAPTURE_INVALID_HAR");
  const wrapper = input as Record<string, unknown>;
  if (wrapper.runId !== record.run.id) throw new CaptureError("CAPTURE_RUN_MISMATCH", 409);
  const har = wrapper.har as Record<string, unknown> | undefined;
  const log = har?.log as Record<string, unknown> | undefined;
  if (!Array.isArray(log?.entries) || log.entries.length > 100) throw new CaptureError("CAPTURE_INVALID_HAR");
  if (["pending", "running"].includes(record.run.status)) throw new CaptureError("CAPTURE_RUN_ACTIVE", 409);
  const stepByKey = new Map(record.steps.map((step) => [step.stepKey, step]));
  const existing = new Set(record.exchanges.map((exchange) => exchange.id));
  let seq = Math.max(0, ...record.exchanges.map((exchange) => exchange.seq));
  let skipped = 0;
  const exchanges: Exchange[] = [];
  for (const rawEntry of log.entries) {
    if (!rawEntry || typeof rawEntry !== "object") throw new CaptureError("CAPTURE_INVALID_HAR");
    const entry = rawEntry as Record<string, unknown>;
    const request = entry.request as Record<string, unknown> | undefined;
    const response = entry.response as Record<string, unknown> | undefined;
    if (!request || !response || typeof request.url !== "string" || typeof request.method !== "string" || !Number.isInteger(response.status) || typeof entry.startedDateTime !== "string" || !Number.isFinite(Date.parse(entry.startedDateTime))) throw new CaptureError("CAPTURE_INVALID_HAR");
    if (!Number.isFinite(entry.time) || Number(entry.time) < 0 || Number(entry.time) > 120_000 || Number(response.status) < 100 || Number(response.status) > 599) throw new CaptureError("CAPTURE_INVALID_HAR");
    let url: URL;
    try { url = new URL(request.url); } catch { throw new CaptureError("CAPTURE_INVALID_HAR"); }
    const service = origins.get(url.origin);
    if (!service || url.username || url.password || url.protocol === "file:") throw new CaptureError("CAPTURE_ORIGIN_NOT_ALLOWED", 422);
    const route = routeFor(service, url.pathname);
    if (!route) { skipped += 1; continue; }
    const step = stepByKey.get(route.stepKey);
    if (!step) throw new CaptureError("CAPTURE_STEP_MISSING", 409);
    const method = request.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new CaptureError("CAPTURE_INVALID_HAR");
    const id = deterministicId(record.run.id, entry);
    if (existing.has(id)) { skipped += 1; continue; }
    const redactions: string[] = [];
    const query = [...url.searchParams.keys()].map((key) => {
      redactions.push(`$.url.${safeKey(key)}`);
      return `${encodeURIComponent(safeKey(key))}=[REDACTED]`;
    }).join("&");
    if (url.hash) redactions.push("$.url.fragment");
    const sanitizedUrl = `${url.origin}${route.template}${query ? `?${query}` : ""}`;
    const captured: Exchange = {
      id, runId: record.run.id, stepId: step.id, seq: ++seq,
      actorFrom: "browser", actorTo: route.actorTo, method, url: sanitizedUrl,
      status: Number(response.status), durationMs: Math.round(Number(entry.time)),
      request: { source: "har_import", headers: headers(request.headers, "$.request.headers", redactions), body: body(request, "$.request.body", redactions) },
      response: { source: "har_import", headers: headers(response.headers, "$.response.headers", redactions), body: body(response, "$.response.body", redactions) },
      redactions,
    };
    exchanges.push(captured);
    existing.add(id);
  }
  return { exchanges, skipped, gaps: ["Browser HAR omits server-to-server traffic and any encrypted or non-browser wallet exchange."] };
}
