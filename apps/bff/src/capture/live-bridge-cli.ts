import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureOrigins, type CaptureOrigins } from "./har.js";
import { tagCapture } from "./tagging.js";

type MinimalObservation = { observedAt: string; durationMs: number; method: "POST"; url: string; status: number; state?: string };
const supported = new Set(["certify-credential", "mimoto-download", "verify-submit"]);
const publicSegments = new Set(["v1", "v2", "mimoto", "issuers", "issuer", "credential", "credentials", "download", "issuance", "certify", "verify", "vp-submission", "direct-post", "vp-request", "oauth", "token", "openid4vp", "presentations", "presentation", "api"]);

function routeShape(pathname: string): string {
  return pathname.split("/").map((part) => part && publicSegments.has(part.toLowerCase()) ? part.toLowerCase() : part ? "{id}" : "").join("/");
}

export function discoverLiveRoutes(input: unknown, origins: CaptureOrigins = captureOrigins()) {
  const root = input as { log?: { entries?: unknown }; har?: { log?: { entries?: unknown } } } | null;
  const entries = root?.har?.log?.entries ?? root?.log?.entries;
  if (!Array.isArray(entries) || entries.length > 20_000) throw new Error("CAPTURE_BRIDGE_INVALID_HAR");
  const routes = new Map<string, { method: string; origin: string; path: string; service: string; ruleId: string | null; count: number }>();
  for (const entry of entries) {
    const request = entry?.request;
    if (!request || typeof request.method !== "string" || typeof request.url !== "string") continue;
    let url: URL;
    try { url = new URL(request.url); } catch { continue; }
    const service = origins.get(url.origin);
    if (!service || url.username || url.password) continue;
    const method = request.method.toUpperCase();
    if (!["GET", "POST"].includes(method)) continue;
    const rule = tagCapture(service, method, url.pathname);
    const path = routeShape(url.pathname);
    const key = JSON.stringify([method, url.origin, path, service, rule?.id ?? null]);
    const existing = routes.get(key);
    if (existing) existing.count += 1;
    else routes.set(key, { method, origin: url.origin, path, service, ruleId: rule?.id ?? null, count: 1 });
  }
  return [...routes.values()].sort((a, b) => `${a.origin}${a.path}${a.method}`.localeCompare(`${b.origin}${b.path}${b.method}`));
}

function stateFromPostData(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const part = raw as { mimeType?: unknown; text?: unknown; encoding?: unknown; params?: unknown };
  const mime = typeof part.mimeType === "string" ? part.mimeType.split(";")[0]?.trim().toLowerCase() : "";
  let text = typeof part.text === "string" ? part.text : "";
  if (Buffer.byteLength(text) > 131_072) return undefined;
  if (part.encoding === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text.replace(/\s/g, ""))) return undefined;
    text = Buffer.from(text, "base64").toString("utf8");
  }
  try {
    if (mime === "application/json" || mime?.endsWith("+json")) {
      const value: unknown = JSON.parse(text);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const state = (value as Record<string, unknown>).state;
        return typeof state === "string" ? state : undefined;
      }
    }
    if (mime === "application/x-www-form-urlencoded") {
      const fromText = new URLSearchParams(text).get("state");
      if (fromText) return fromText;
      if (Array.isArray(part.params)) {
        const value = part.params.find((item) => item && typeof item === "object" && item.name === "state");
        return typeof value?.value === "string" ? value.value : undefined;
      }
    }
  } catch { /* A malformed body supplies no correlation evidence. */ }
  return undefined;
}

export function collectLiveObservations(input: unknown, origins: CaptureOrigins = captureOrigins()) {
  const root = input as { log?: { entries?: unknown }; har?: { log?: { entries?: unknown } } } | null;
  const entries = root?.har?.log?.entries ?? root?.log?.entries;
  if (!Array.isArray(entries) || entries.length > 20_000) throw new Error("CAPTURE_BRIDGE_INVALID_HAR");
  const counts: Record<string, number> = {};
  const count = (reason: string) => { counts[reason] = (counts[reason] ?? 0) + 1; };
  const observations: MinimalObservation[] = [];
  for (const entry of entries) {
    const request = entry?.request;
    const response = entry?.response;
    if (!request || !response || typeof request.url !== "string" || request.method !== "POST" || !Number.isInteger(response.status) ||
      response.status < 200 || response.status > 299 || typeof entry.startedDateTime !== "string" || !Number.isFinite(Date.parse(entry.startedDateTime)) ||
      !Number.isFinite(entry.time) || entry.time < -1 || entry.time > 120_000) { count("invalid_or_unfinished"); continue; }
    let url: URL;
    try { url = new URL(request.url); } catch { count("invalid_or_unfinished"); continue; }
    const service = origins.get(url.origin);
    if (!service || url.username || url.password) { count("other_origin"); continue; }
    const rule = tagCapture(service, "POST", url.pathname);
    if (!rule || !supported.has(rule.id)) { count("untagged"); continue; }
    const state = rule.id === "verify-submit" ? stateFromPostData(request.postData) : undefined;
    if (rule.id === "verify-submit" && (!state || state.length < 32 || state.length > 2048)) { count("state_unavailable"); continue; }
    observations.push({ observedAt: new Date(entry.startedDateTime).toISOString(), durationMs: entry.time,
      method: "POST", url: `${url.origin}${url.pathname}`, status: response.status, ...(state ? { state } : {}) });
  }
  observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return { observations, skippedReasons: counts };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const discovery = args[0] === "--routes";
    const [inputPath, runId, baseUrl, extra] = discovery ? args.slice(1) : args;
    if (discovery && (!inputPath || runId || baseUrl || extra)) throw new Error("CAPTURE_BRIDGE_ARGUMENTS");
    if (!inputPath) throw new Error("CAPTURE_BRIDGE_ARGUMENTS");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of createReadStream(inputPath)) {
      size += chunk.length;
      if (size > 32 * 1024 * 1024) throw new Error("CAPTURE_BRIDGE_TOO_LARGE");
      chunks.push(chunk as Buffer);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (discovery) {
      console.log(JSON.stringify({ code: "CAPTURE_BRIDGE_ROUTES", routes: discoverLiveRoutes(input) }));
      return;
    }
    if (!inputPath || !runId || !baseUrl || extra || !/^[a-f0-9-]{36}$/i.test(runId)) throw new Error("CAPTURE_BRIDGE_ARGUMENTS");
    const base = new URL(baseUrl);
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/" ||
      (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)))) throw new Error("CAPTURE_BRIDGE_TARGET");
    const token = process.env.CAPTURE_BRIDGE_TOKEN;
    if (!token || token.length < 32) throw new Error("CAPTURE_BRIDGE_TOKEN_MISSING");
    const { observations, skippedReasons } = collectLiveObservations(input);
    let imported = 0;
    let duplicates = 0;
    const rules: Record<string, number> = {};
    for (const observation of observations) {
      const response = await fetch(new URL(`/api/v1/assisted/runs/${runId}/capture/observation`, base), {
        method: "POST", headers: { "content-type": "application/json", "x-capture-bridge-token": token }, body: JSON.stringify(observation),
      });
      // The response is a codes-only contract. Never print remote error bodies or source HAR data.
      if (!response.ok) throw new Error(`CAPTURE_BRIDGE_HTTP_${response.status}`);
      const result = await response.json() as { accepted?: boolean; duplicate?: boolean; ruleId?: string };
      if (result.accepted) imported += 1;
      if (result.duplicate) duplicates += 1;
      if (typeof result.ruleId === "string" && supported.has(result.ruleId)) rules[result.ruleId] = (rules[result.ruleId] ?? 0) + 1;
    }
    console.log(JSON.stringify({ code: "CAPTURE_BRIDGE_COMPLETE", imported, duplicates, rules, skippedReasons }));
  } catch { console.error("CAPTURE_BRIDGE_FAILED: check local HAR, configured token, live run and endpoint; no source data printed."); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
