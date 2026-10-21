import { describe, expect, it } from "vitest";
import { redact } from "./redaction.js";

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
