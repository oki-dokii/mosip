import { describe, expect, it } from "vitest";
import { redact } from "./redaction.js";

describe("redact", () => {
  it("masks nested protocol secrets before recording", () => {
    const result = redact({ access_token: "token", nested: { c_nonce: "nonce", visible: true } });
    expect(result.value).toEqual({ access_token: "[REDACTED]", nested: { c_nonce: "[REDACTED]", visible: true } });
    expect(result.redactions).toEqual(["$.access_token", "$.nested.c_nonce"]);
  });
});
