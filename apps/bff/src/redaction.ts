import { createHmac, randomBytes } from "node:crypto";

const SECRET_FIELDS = new Set([
  "access_token", "refresh_token", "c_nonce", "nonce", "state", "pre_authorized_code", "client_assertion", "challenge",
  "code_verifier", "authorization", "proxy_authorization", "cookie", "set_cookie", "d", "individualid", "individual_id", "otp", "proof", "vp_token",
  "tx_code", "id_token", "credential", "client_secret", "private_key", "private_key_jwk", "x_api_key", "x_csrf_token", "x_xsrf_token",
]);
const PRIVATE_JWK = new Set(["d", "p", "q", "dp", "dq", "qi", "oth", "k"]);
const COMPACT_SECRET_FIELDS = new Set([...SECRET_FIELDS].map((key) => key.replace(/_/g, "")));
const ERROR_CODES = new Set(["invalid_request", "invalid_grant", "invalid_token", "invalid_proof", "access_denied", "CAPTURE_INVALID_HAR", "CAPTURE_TOO_LARGE", "CAPTURE_RUN_MISMATCH"]);
const masterKey = randomBytes(32);
export const normalizedKey = (key: string) => key.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[.-]/g, "_");
export const runCorrelationKey = (runId: string) => createHmac("sha256", masterKey).update(runId).digest();

export function maskedValue(value: unknown, path: string, key?: Uint8Array): string {
  const field = normalizedKey(path.split(".").at(-1) ?? "").replace(/_/g, "");
  const scalar = typeof value === "string" ? value.replace(/^Bearer\s+/i, "") : "";
  if (!key || scalar.length < 32 || ["code", "otp", "txcode", "preauthorizedcode", ...PRIVATE_JWK].includes(field)) return "[REDACTED]";
  return `[REDACTED hmac:${createHmac("sha256", key).update(scalar).digest("hex").slice(0, 16)}]`;
}

export function createRedactor(correlationKey?: Uint8Array) {
  return (value: unknown, path = "$", redactions: string[] = []): { value: unknown; redactions: string[] } => {
    const seen = new WeakSet<object>();
    let budget = 2048;
    const mask = (item: unknown, itemPath: string) => { redactions.push(itemPath); return maskedValue(item, itemPath, correlationKey); };
    function walk(item: unknown, itemPath: string, depth: number): unknown {
      if (depth > 12 || budget-- <= 0) return mask(item, itemPath);
      if (item && typeof item === "object") {
        if (seen.has(item)) return mask(item, itemPath);
        seen.add(item);
        if (Array.isArray(item)) return item.slice(0, 64).map((child, i) => walk(child, `${itemPath}[${i}]`, depth + 1));
        const input = item as Record<string, unknown>;
        const output: Record<string, unknown> = Object.create(null);
        const kty = input.kty;
        const jwk = (typeof kty === "string" && ["RSA", "EC", "OKP", "oct"].includes(kty)) || /(?:jwk|private_key_jwk)$/i.test(itemPath);
        const authorizationCode = input.grant_type === "authorization_code";
        for (const [rawKey, child] of Object.entries(input).slice(0, 128)) {
          const key = normalizedKey(rawKey);
          const compactKey = key.replace(/_/g, "");
          const nextPath = `${itemPath}.${rawKey}`;
          const secretCode = compactKey === "code" && (authorizationCode || !(typeof child === "string" && ERROR_CODES.has(child)));
          // Non-ASCII identifiers can disguise secret field names; fail closed on their values.
          if (/[^\x20-\x7E]/.test(rawKey) || COMPACT_SECRET_FIELDS.has(compactKey) || secretCode || (jwk && PRIVATE_JWK.has(compactKey)) || (compactKey === "request" && typeof child === "string")) output[rawKey] = mask(child, nextPath);
          else output[rawKey] = walk(child, nextPath, depth + 1);
        }
        return output;
      }
      if (typeof item !== "string" || item === "[REDACTED]" || /^\[REDACTED hmac:[a-f0-9]{16}\]$/.test(item)) return item;
      if (Buffer.byteLength(item) > 131_072) return mask(item, itemPath);
      if (/^[A-Za-z0-9_+\/-]{64,}={0,2}$/.test(item) || /\bBearer\s+[^\s]+/i.test(item) || /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(item) || /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----/.test(item)) return mask(item, itemPath);
      if (/^\s*[\[{]/.test(item)) {
        try { return JSON.stringify(walk(JSON.parse(item), itemPath, depth + 1)); } catch { return mask(item, itemPath); }
      }
      if (/^(?:https?:|openid-credential-offer:)\/\//i.test(item)) {
        try {
          const url = new URL(item);
          if (url.username || url.password) { url.username = ""; url.password = ""; redactions.push(`${itemPath}.userinfo`); }
          const params = [...url.searchParams];
          url.search = "";
          for (const [name, content] of params) {
            const p = `${itemPath}.${name}`;
            if (/^\s*[\[{]/.test(content) && ["credential_offer", "presentation_definition", "dcql_query"].includes(name)) {
              try { url.searchParams.append(name, JSON.stringify(walk(JSON.parse(content), p, depth + 1))); } catch { url.searchParams.append(name, mask(content, p)); }
            } else url.searchParams.append(name, mask(content, p));
          }
          url.pathname = url.pathname.split("/").map((segment) => segment.length >= 32 ? mask(segment, `${itemPath}.path`) : segment).join("/");
          if (url.hash) { redactions.push(`${itemPath}.fragment`); url.hash = ""; }
          return url.toString();
        } catch { return mask(item, itemPath); }
      }
      if (/^[\w.%~-]+=/.test(item)) {
        const params = new URLSearchParams(item);
        return [...params].map(([name, content]) => `${encodeURIComponent(name)}=${encodeURIComponent(mask(content, `${itemPath}.${name}`))}`).join("&");
      }
      return item;
    }
    return { value: walk(value, path, 0), redactions };
  };
}

// Existing driver callers retain the same signature and plain-mask default.
export const redact = createRedactor();
