import { createHash } from "node:crypto";
import { decodeJson, object } from "./http.js";
import { Rejection } from "./diagnostics.js";
export function digest(value: string) { return createHash("sha256").update(value, "ascii").digest("base64url"); }
export function verifyDisclosures(payload: Record<string, unknown>, disclosures: string[], strict: boolean) {
  if (payload._sd_alg !== undefined && payload._sd_alg !== "sha-256") throw new Rejection("UNSUPPORTED_DISCLOSURE_PROFILE");
  const commitments: string[] = [];
  const collect = (value: unknown, depth: number): void => {
    if (depth > 16) throw new Rejection("UNSUPPORTED_DISCLOSURE_PROFILE");
    if (Array.isArray(value)) { value.forEach((entry) => collect(entry, depth + 1)); return; }
    if (!object(value)) return;
    if (strict && (Object.hasOwn(value, "...") || (depth > 0 && Object.hasOwn(value, "_sd")))) throw new Rejection("UNSUPPORTED_DISCLOSURE_PROFILE");
    if (Object.hasOwn(value, "_sd")) {
      if (!Array.isArray(value._sd) || value._sd.some((entry) => typeof entry !== "string")) throw new Rejection("MALFORMED_DISCLOSURE");
      commitments.push(...value._sd as string[]);
    }
    Object.values(value).forEach((entry) => collect(entry, depth + 1));
  };
  collect(payload, 0);
  if (strict && new Set(commitments).size !== commitments.length) throw new Rejection("MALFORMED_DISCLOSURE");
  const seen = new Set<string>(), claims = new Map<string, unknown>();
  for (const disclosure of disclosures) {
    const hash = digest(disclosure);
    if (!commitments.includes(hash)) throw new Rejection("DISCLOSURE_DIGEST_MISMATCH");
    if (seen.has(hash)) throw new Rejection("MALFORMED_DISCLOSURE");
    seen.add(hash);
    if (!strict) continue;
    let decoded;
    try { decoded = decodeJson(disclosure, 4096); } catch { throw new Rejection("MALFORMED_DISCLOSURE"); }
    if (!Array.isArray(decoded) || decoded.length !== 3 || typeof decoded[0] !== "string" || !decoded[0] || typeof decoded[1] !== "string") throw new Rejection("MALFORMED_DISCLOSURE");
    const name = decoded[1];
    if (!["given_name", "family_name"].includes(name)) throw new Rejection("UNSUPPORTED_DISCLOSURE_PROFILE");
    if (claims.has(name) || Object.hasOwn(payload, name)) throw new Rejection("MALFORMED_DISCLOSURE");
    claims.set(name, decoded[2]);
  }
  return claims;
}
