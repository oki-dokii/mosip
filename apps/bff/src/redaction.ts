const SECRET_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "c_nonce",
  "pre_authorized_code",
  "client_assertion",
  "challenge",
  "code",
  "code_verifier",
  "authorization",
  "cookie",
  "set_cookie",
  "d",
  "individualid",
  "individual_id",
  "otp",
  "proof",
  "vp_token",
  "tx_code",
  "id_token",
  "credential",
  "client_secret",
  "private_key",
  "private_key_jwk",
]);

const PRIVATE_JWK_FIELDS = new Set(["p", "q", "dp", "dq", "qi", "oth", "k"]);

function normalizedKey(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[.-]/g, "_");
}

function secretString(value: string) {
  return /\bBearer\s+[^\s]+/i.test(value)
    || /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(value)
    || /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----/.test(value);
}

export function redact(value: unknown, path = "$", redactions: string[] = []): { value: unknown; redactions: string[] } {
  if (Array.isArray(value)) {
    return {
      value: value.map((item, index) => redact(item, `${path}[${index}]`, redactions).value),
      redactions,
    };
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${path}.${key}`;
      const normalized = normalizedKey(key);
      const isPrivateJwkField = /(?:^|\.)(?:jwk|private_key_jwk)$/.test(path) && PRIVATE_JWK_FIELDS.has(normalized);
      if (SECRET_FIELDS.has(normalized) || isPrivateJwkField || (normalized === "request" && typeof item === "string")) {
        output[key] = "[REDACTED]";
        redactions.push(itemPath);
      } else {
        output[key] = redact(item, itemPath, redactions).value;
      }
    }
    return { value: output, redactions };
  }
  if (typeof value === "string" && secretString(value)) {
    redactions.push(path);
    return { value: "[REDACTED]", redactions };
  }
  return { value, redactions };
}
