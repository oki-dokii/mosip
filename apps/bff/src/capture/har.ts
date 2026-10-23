import { createHash } from "node:crypto";
import type { Exchange } from "@playground/shared";
import type { RunRecord } from "../store.js";
import { tagCapture, type CaptureService } from "./tagging.js";
import { publicViewForHarPart } from "./public-view.js";
import { maskedValue, publicParameter, runCorrelationKey } from "../redaction.js";

type Service = CaptureService;
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

const SAFE_ENUMS: Record<string, Set<string>> = {
  format: new Set(["vc+sd-jwt", "dc+sd-jwt", "ldp_vc", "jwt_vc_json", "vc_sd_jwt"]),
  grant_type: new Set(["urn:ietf:params:oauth:grant-type:pre-authorized_code", "authorization_code"]),
  response_mode: new Set(["direct_post", "direct_post.jwt", "fragment", "query"]),
  token_type: new Set(["Bearer", "DPoP"]),
  status: new Set(["valid", "invalid", "pending", "completed", "success", "failed", "error"]),
};

const PUBLIC_FIELD_NAMES = new Set([
  "format", "grant_type", "response_mode", "response_type", "token_type", "status", "error", "error_description", "code", "otp", "state", "nonce", "request_uri", "request", "response_uri", "client_id", "redirect_uri", "scope",
  "access_token", "refresh_token", "id_token", "tx_code", "pre-authorized_code", "pre_authorized_code", "authorization_code", "proof", "jwt", "jwk", "kty", "crv", "x", "y", "n", "e", "d", "p", "q", "dp", "dq", "qi", "oth", "k", "alg", "typ", "kid", "cnf",
  "credential", "credentials", "credentialSubject", "individualId", "given_name", "family_name", "name", "birthdate", "age_over_18", "address", "email", "type", "issuer", "id", "iss", "aud", "exp", "iat", "nbf", "vct", "_sd", "_sd_alg",
  "credential_issuer", "credential_configuration_ids", "credential_configuration_id", "grants", "credential_offer", "credential_offer_uri", "c_nonce", "expires_in", "vp_token", "presentation_definition", "presentation_submission", "dcql_query", "dcqlQuery", "input_descriptors", "constraints", "fields", "path", "filter", "const", "enum", "meta", "claims", "vct_values",
  "allChecksSuccessful", "credentialChecksSuccessful", "credentialProofValid", "holderProofValid",
]);
function safeKey(key: string) { return PUBLIC_FIELD_NAMES.has(key) ? key : "[field]"; }

function bodyShape(value: unknown, path: string, redactions: string[], depth = 0, correlationKey?: Uint8Array): unknown {
  if (depth >= 8) { redactions.push(path); return "[REDACTED]"; }
  if (Array.isArray(value)) {
    if (value.length > 32) redactions.push(`${path}.[truncated:${value.length - 32}]`);
    return value.slice(0, 32).map((item, index) => bodyShape(item, `${path}[${index}]`, redactions, depth + 1, correlationKey));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value);
    if (entries.length > 64) redactions.push(`${path}.[truncated:${entries.length - 64}]`);
    for (const [rawKey, item] of entries.slice(0, 64)) {
      const key = safeKey(rawKey);
      const outputKey = key === "[field]" ? `[field:${Object.keys(result).filter((name) => name.startsWith("[field:")).length + 1}]` : key;
      result[outputKey] = typeof item === "string" && Object.hasOwn(SAFE_ENUMS, key) && SAFE_ENUMS[key]?.has(item) ? item : bodyShape(item, `${path}.${outputKey}`, redactions, depth + 1, correlationKey);
    }
    return result;
  }
  if (value === null) return null;
  redactions.push(path);
  return maskedValue(value, path, correlationKey);
}

function headers(value: unknown, path: string, redactions: string[], correlationKey?: Uint8Array) {
  if (!Array.isArray(value)) return {};
  if (value.length > 64) throw new CaptureError("CAPTURE_ENTRY_TOO_LARGE", 413);
  const output: Record<string, string> = {};
  for (const item of value) {
    if (!item || typeof item.name !== "string") continue;
    const name = item.name.toLowerCase();
    if (name === "content-type") {
      const mime = (typeof item.value === "string" ? item.value : "").split(";")[0]?.trim().toLowerCase();
      if (mime && ["application/json", "application/jwt", "application/oauth-authz-req+jwt", "application/x-www-form-urlencoded", "text/plain"].includes(mime)) output[name] = mime;
    } else if (["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key", "x-xsrf-token", "x-csrf-token", "www-authenticate"].includes(name)) {
      output[name] = maskedValue(item.value, `${path}.${name}`, correlationKey);
      redactions.push(`${path}.${name}`);
    }
  }
  return output;
}

function body(part: Record<string, unknown>, path: string, redactions: string[], correlationKey?: Uint8Array) {
  const payload = part.postData ?? part.content;
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const rawText = data.text;
  if (typeof rawText !== "string") return null;
  let text: string = rawText;
  if (Buffer.byteLength(text) > 131_072) throw new CaptureError("CAPTURE_ENTRY_TOO_LARGE", 413);
  if (data.encoding === "base64") {
    const normalized = text.replace(/\s/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
      redactions.push(path);
      return "[REDACTED: malformed base64]";
    }
    const decoded = Buffer.from(normalized, "base64");
    if (decoded.length > 131_072) throw new CaptureError("CAPTURE_ENTRY_TOO_LARGE", 413);
    text = decoded.toString("utf8");
  }
  const mime = ((typeof data.mimeType === "string" ? data.mimeType : "").split(";")[0] ?? "").toLowerCase();
  if (mime === "application/json" || mime.endsWith("+json")) {
    try { return bodyShape(JSON.parse(text), path, redactions, 0, correlationKey); }
    catch { redactions.push(path); return "[REDACTED: malformed JSON]"; }
  }
  if (mime === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    for (const [rawKey, value] of params) {
      const key = safeKey(rawKey);
      const publicValue = key === "[field]" ? null : publicParameter(key, value);
      // Match the verifier challenge only through a run-scoped in-process HMAC.
      result[key] = publicValue ?? (key === "state" ? maskedValue(value, `${path}.${key}`, correlationKey) : "[REDACTED]");
      if (publicValue === null) redactions.push(`${path}.${key}`);
    }
    return result;
  }
  redactions.push(path);
  return "[REDACTED]";
}

function deterministicId(publicIdentity: unknown[]) {
  // Persisted IDs must not be unkeyed hashes of tokens embedded in a URL.
  const digest = createHash("sha256").update(JSON.stringify(publicIdentity)).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function prepareHarImport(input: unknown, record: RunRecord, origins: CaptureOrigins = captureOrigins(), allowActive = false) {
  if (!input || typeof input !== "object") throw new CaptureError("CAPTURE_INVALID_HAR");
  const wrapper = input as Record<string, unknown>;
  if (wrapper.runId !== record.run.id) throw new CaptureError("CAPTURE_RUN_MISMATCH", 409);
  const har = wrapper.har as Record<string, unknown> | undefined;
  const log = har?.log as Record<string, unknown> | undefined;
  if (!Array.isArray(log?.entries) || log.entries.length > 100) throw new CaptureError("CAPTURE_INVALID_HAR");
  if (!allowActive && ["pending", "running"].includes(record.run.status)) throw new CaptureError("CAPTURE_RUN_ACTIVE", 409);
  const stepByKey = new Map(record.steps.map((step) => [step.stepKey, step]));
  const existing = new Set(record.exchanges.map((exchange) => exchange.id));
  let seq = Math.max(0, ...record.exchanges.map((exchange) => exchange.seq));
  const skippedReasons: Record<string, number> = {};
  const skip = (reason: string) => { skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1; };
  const exchanges: Exchange[] = [];
  const correlationKey = runCorrelationKey(record.run.id);
  const seenInput = new Set<string>();
  const occurrences = new Map<string, number>();
  const entries = [...log.entries].sort((left, right) => {
    const leftTime = Date.parse(typeof left?.startedDateTime === "string" ? left.startedDateTime : "");
    const rightTime = Date.parse(typeof right?.startedDateTime === "string" ? right.startedDateTime : "");
    return (Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY) - (Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY);
  });
  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) { skip("malformed_entry"); continue; }
    const entry = rawEntry as Record<string, unknown>;
    const request = entry.request as Record<string, unknown> | undefined;
    const response = entry.response as Record<string, unknown> | undefined;
    if (!request || !response || typeof request.url !== "string" || typeof request.method !== "string" || !Number.isInteger(response.status) || typeof entry.startedDateTime !== "string" || !Number.isFinite(Date.parse(entry.startedDateTime))) { skip("malformed_entry"); continue; }
    if (!Number.isFinite(entry.time) || (Number(entry.time) < 0 && Number(entry.time) !== -1) || Number(entry.time) > 120_000 || Number(response.status) < 0 || Number(response.status) > 599) { skip("malformed_entry"); continue; }
    let url: URL;
    try { url = new URL(request.url); } catch { skip("malformed_entry"); continue; }
    const service = origins.get(url.origin);
    if (!service || url.username || url.password || url.protocol === "file:") throw new CaptureError("CAPTURE_ORIGIN_NOT_ALLOWED", 422);
    if (response.status === 0) { skip("unfinished_request"); continue; }
    if (Number(response.status) < 100) { skip("malformed_entry"); continue; }
    const method = request.method.toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method)) { skip("unsupported_method"); continue; }
    const route = tagCapture(service, method, url.pathname);
    if (!route) { skip("untagged"); continue; }
    const step = stepByKey.get(route.stepKey);
    if (!step) throw new CaptureError("CAPTURE_STEP_MISSING", 409);
    const fingerprint = JSON.stringify([entry.startedDateTime, method, request.url, entry.time, response.status]);
    if (seenInput.has(fingerprint)) { skip("duplicate"); continue; }
    seenInput.add(fingerprint);
    const identity = [record.run.id, new Date(entry.startedDateTime).toISOString(), method, url.origin, route.id, entry.time, response.status];
    const base = JSON.stringify(identity);
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    const id = deterministicId([...identity, occurrence]);
    if (existing.has(id)) { skip("duplicate"); continue; }
    const redactions: string[] = [];
    const query = [...url.searchParams].map(([key, value]) => {
      const outputKey = safeKey(key);
      const publicValue = outputKey === "[field]" ? null : publicParameter(outputKey, value);
      if (publicValue === null) redactions.push(`$.url.${outputKey}`);
      return `${encodeURIComponent(outputKey)}=${publicValue ?? "[REDACTED]"}`;
    }).join("&");
    if (url.hash) redactions.push("$.url.fragment");
    const template = route.id === "certify-metadata" ? `/.well-known/${url.pathname.split("/").filter(Boolean).at(-1)}` : route.template;
    if (url.pathname !== template) redactions.push("$.url.path");
    const sanitizedUrl = `${url.origin}${template}${query ? `?${query}` : ""}`;
    const captured: Exchange = {
      id, runId: record.run.id, stepId: step.id, seq: ++seq,
      actorFrom: "browser", actorTo: service, method, url: sanitizedUrl,
      status: Number(response.status), durationMs: Math.max(0, Math.round(Number(entry.time))),
      request: { source: "har_import", headers: headers(request.headers, "$.request.headers", redactions, correlationKey), body: body(request, "$.request.body", redactions, correlationKey), publicView: publicViewForHarPart(request, origins) },
      response: { source: "har_import", headers: headers(response.headers, "$.response.headers", redactions, correlationKey), body: body(response, "$.response.body", redactions, correlationKey), publicView: publicViewForHarPart(response, origins) },
      redactions,
    };
    (captured.request as Record<string, unknown>).capture = { schemaVersion: 1, ruleId: route.id, why: route.why, redactionCount: new Set(redactions).size, timingKnown: Number(entry.time) !== -1, observedAt: new Date(entry.startedDateTime).toISOString() };
    exchanges.push(captured);
    existing.add(id);
  }
  return {
    exchanges, skipped: Object.values(skippedReasons).reduce((total, count) => total + count, 0), skippedReasons,
    coverage: browserCoverage(record, exchanges),
    gaps: ["Browser HAR omits server-to-server traffic, wallet-local operations, native wallet traffic, encrypted content, missing response bodies, and calls outside the recording window."],
  };
}

export function browserCoverage(record: RunRecord, added: Exchange[] = []) {
  const observed = [...new Map([...record.exchanges, ...added].map((exchange) => [exchange.id, exchange])).values()]
    .filter((exchange) => ["har_import", "live_bridge"].includes(String((exchange.request as Record<string, unknown> | null)?.source)));
  return record.steps.map((step) => {
    const stepExchanges = observed.filter((exchange) => exchange.stepId === step.id);
    const count = stepExchanges.length;
    const projections = stepExchanges.flatMap((exchange) => [exchange.request, exchange.response].map((part) => (part as Record<string, unknown>).publicView as Record<string, unknown> | undefined));
    const projection = { withheldNames: 0, truncatedItems: 0, unsupportedKinds: 0 };
    for (const part of projections) for (const field of Object.keys(projection) as (keyof typeof projection)[]) {
      const value = part?.[field];
      if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) projection[field] += value;
    }
    const internal = ["INIT", "STORE", "REPORT"].includes(step.stepKey);
    return { stepKey: step.stepKey, state: count ? "captured" : internal ? "not_observable" : "missing", count, projection,
      reason: count ? "Browser HTTP exchange observed; endpoint access does not prove wallet storage or protocol validity."
        : internal ? "Browser HAR cannot establish internal run operations or wallet-local storage."
        : "No matching browser HTTP exchange observed; this may be server-side, out of window, or absent. This is not a failed-step verdict." };
  });
}
