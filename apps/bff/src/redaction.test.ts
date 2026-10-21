import { describe, expect, it } from "vitest";
import { createRedactor, redact, runCorrelationKey } from "./redaction.js";

describe("redact", () => {
  it("masks nested protocol secrets before recording", () => {
    const result = redact({ access_token: "token", nested: { c_nonce: "nonce", proof: "signed-jwt", visible: true } });
    expect(result.value).toEqual({ access_token: "[REDACTED]", nested: { c_nonce: "[REDACTED]", proof: "[REDACTED]", visible: true } });
    expect(result.redactions).toEqual(["$.access_token", "$.nested.c_nonce", "$.nested.proof"]);
  });

  it("normalizes secret field names and masks private RSA JWK parameters", () => {
    const result = redact({ txCode: "one", idToken: "two", credential: { subject: "three" }, request: { safe: true },
      jwk: { n: "public", e: "AQAB", p: "private", dq: "private" } });
    expect(result.value).toEqual({ txCode: "[REDACTED]", idToken: "[REDACTED]", credential: "[REDACTED]", request: { safe: true },
      jwk: { n: "public", e: "AQAB", p: "[REDACTED]", dq: "[REDACTED]" } });
    expect(result.redactions).toContain("$.jwk.p");
  });

  it("masks bearer values, compact JWTs, private PEMs, and request objects safely", () => {
    const result = redact({ note: "Bearer token-value", jwt: "abcdefghijk.abcdefghijk.abcdefghijk",
      pem: "-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----", request: { method: "POST" },
      requestObject: "visible" });
    expect(result.value).toEqual({ note: "[REDACTED]", jwt: "[REDACTED]", pem: "[REDACTED]", request: { method: "POST" }, requestObject: "visible" });
  });
});

describe("redaction v2", () => {
  it("recognizes private JWK fields by kty under arbitrary nesting", () => {
    for (const kty of ["RSA", "EC", "OKP", "oct"]) {
      const result = redact({ arbitrary: { kty, n: "public", p: "CANARY_PRIVATE", q: "CANARY_PRIVATE", k: "CANARY_PRIVATE", d: "CANARY_PRIVATE" } });
      expect(JSON.stringify(result)).not.toContain("CANARY_PRIVATE");
      expect(result.value).toMatchObject({ arbitrary: { n: "public" } });
    }
  });
  it("retains a known diagnostic code while masking authorization codes and embedded forms/JSON/URLs", () => {
    expect(redact({ code: "invalid_proof" }).value).toEqual({ code: "invalid_proof" });
    expect(redact({ grant_type: "authorization_code", code: "invalid_proof" }).value).toMatchObject({ code: "[REDACTED]" });
    const input = { form: "code=CANARY_FORM&otp=CANARY_OTP", embedded: JSON.stringify({ access_token: "CANARY_JSON" }),
      url: `https://issuer.example/path?code=CANARY_URL&credential_offer=${encodeURIComponent(JSON.stringify({ grants: { authorization_code: { code: "CANARY_NESTED" } } }))}` };
    expect(JSON.stringify(redact(input))).not.toContain("CANARY_");
  });
});

it("uses keyed per-run correlation for long secrets and plain masks for short secrets", () => {
  const secret = "synthetic-token-".repeat(5);
  const first = createRedactor(runCorrelationKey("run-a"));
  const second = createRedactor(runCorrelationKey("run-b"));
  const a = first({ access_token: secret, authorization: `Bearer ${secret}`, otp: "123456", code: secret });
  expect(a.value).toMatchObject({ otp: "[REDACTED]", code: "[REDACTED]" });
  const values = a.value as Record<string, unknown>;
  expect(values.access_token).toBe(values.authorization);
  expect(values.access_token).toMatch(/^\[REDACTED hmac:[a-f0-9]{16}\]$/);
  expect((second({ access_token: secret }).value as Record<string, unknown>).access_token).not.toBe(values.access_token);
  expect(JSON.stringify(a)).not.toContain(secret);
});

it("keeps canaries out across generated key variants, nesting, JWKs and encoded forms", () => {
  const keys = ["access_token", "access-token", "accessToken", "AccessToken", "idToken", "tx_code"];
  for (let i = 0; i < 120; i++) {
    const value = `CANARY_VALUE_${i}`;
    const key = keys[i % keys.length]!;
    const payload = { nested: [{ [key]: value }], embedded: JSON.stringify({ [key]: value }), form: `code=${value}`, keyMaterial: { kty: "RSA", p: value, q: value } };
    expect(JSON.stringify(redact(payload))).not.toContain(value);
  }
  const opaque = "syntheticOpaqueValue".repeat(8);
  expect(JSON.stringify(redact({ unknown: opaque }))).not.toContain(opaque);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(() => redact(cyclic)).not.toThrow();
});
