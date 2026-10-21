import { describe, expect, it, vi } from "vitest";
import { createRedactor, redact, runCorrelationKey } from "./redaction.js";

describe("reproducible randomized redaction regression", () => {
  for (const seed of [1, 42, 20261022, 0xdeadbeef]) {
    it(`nested objects and mixed-case identifiers; seed=${seed}`, () => {
      let state = seed >>> 0;
      const rand = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
      const keys = ["access_token", "refresh_token", "vp_token", "tx_code", "id_token", "client_secret", "private_key", "code", "request", "nonce"];
      for (let n = 0; n < 250; n++) {
        const canary = `FUZZ_SECRET_${seed}_${n}`;
        let key = keys[Math.floor(rand() * keys.length)]!;
        key = [...key].map((c) => c === "_" ? ["_", "-", "."][Math.floor(rand() * 3)] : rand() < .5 ? c.toUpperCase() : c).join("");
        if (n % 7 === 0) key = key.replace(/./g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
        if (n % 11 === 0) key = `\u200b${key}`;
        let value: unknown = { [key]: canary, harmless: true, opaque: "LongOpaqueCanary".repeat(12) };
        for (let d = Math.floor(rand() * 18); d > 0; d--) value = rand() < .5 ? [value, null] : { child: value };
        const result = JSON.stringify(redact(value));
        expect(result, `seed ${seed}, case ${n}`).not.toContain(canary);
        expect(result).not.toContain("LongOpaqueCanary");
      }
    });
  }
  it("masks confusable identifiers and bounds very wide, cyclic and deep structures", () => {
    expect(JSON.stringify(redact({ "аccess_token": "CANARY_LOOKALIKE" }))).not.toContain("CANARY_LOOKALIKE");
    const cyclic: Record<string, unknown> = {}; cyclic.next = cyclic;
    expect(JSON.stringify(redact(cyclic))).toContain("[REDACTED]");
    const wide = Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => [`branch${i}`, { access_token: "CANARY_WIDE" }]));
    const output = JSON.stringify(redact(wide));
    expect(output.length).toBeLessThan(20_000);
    expect(output).not.toContain("CANARY_WIDE");
  });
});

it("derives stable 256-bit run keys from fresh process entropy, without serializing keys with tags", async () => {
  const a = runCorrelationKey("same-run");
  const b = runCorrelationKey("another-run");
  expect(a.byteLength).toBe(32);
  expect(a).toEqual(runCorrelationKey("same-run"));
  expect(a).not.toEqual(b);
  const secret = "synthetic-correlation-secret-".repeat(4);
  const outputA = JSON.stringify(createRedactor(a)({ access_token: secret }));
  expect(outputA).not.toEqual(JSON.stringify(createRedactor(b)({ access_token: secret })));
  for (const encoding of ["hex", "base64", "base64url"] as const) expect(outputA).not.toContain(a.toString(encoding));
  // A fresh module initialization models process restart; no key is recovered from disk/config.
  vi.resetModules();
  const restarted = await import("./redaction.js");
  expect(restarted.runCorrelationKey("same-run")).not.toEqual(a);
  expect(JSON.stringify(restarted.createRedactor(restarted.runCorrelationKey("same-run"))({ access_token: secret }))).not.toEqual(outputA);
});


it("never correlates codes or private JWK members even with mixed casing", () => {
  const output = createRedactor(runCorrelationKey("codes"))({ tX_cOdE: "synthetic-code-".repeat(5), cOdE: "synthetic-code-".repeat(5), jwk: { kty: "RSA", dP: "synthetic-private-".repeat(5) } });
  expect(JSON.stringify(output)).not.toContain("hmac:");
  expect(JSON.stringify(output)).not.toContain("synthetic-");
});
