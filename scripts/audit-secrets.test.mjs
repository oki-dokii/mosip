import assert from "node:assert/strict";
import test from "node:test";
import { scanFilename, scanText, shouldScanContents } from "./audit-secrets.mjs";

test("flags high-confidence secrets without returning their values", () => {
  const jwt = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(24)}`;
  const canary = "test.person@private.example";
  const input = [
    "-----BEGIN PRIVATE KEY-----",
    jwt,
    "x".repeat(190),
    `${"A/".repeat(95)}==`,
    `openid-credential-offer://${"a".repeat(35)}`,
    "+919876543210",
    canary,
  ].join("\n");
  const findings = scanText(input);
  assert.deepEqual(findings.map((finding) => finding.rule), [
    "private-key-block", "jwt-like-value", "long-base64url-value", "long-base64-value", "credential-offer-uri", "phone-number", "email-address",
  ]);
  assert.equal(JSON.stringify(findings).includes(canary), false);
  assert.equal(JSON.stringify(findings).includes(jwt), false);
});

test("allows public contact and placeholder emails while finding unsafe filenames", () => {
  assert.deepEqual(scanText("decode@mosip.io and user@example.com"), []);
  assert.deepEqual(scanFilename(".env.example"), []);
  assert.equal(scanFilename("config/.env.production")[0]?.rule, "sensitive-filename");
  assert.equal(scanFilename("capture/session.har")[0]?.rule, "sensitive-filename");
  assert.equal(scanFilename("student-id.png")[0]?.rule, "sensitive-filename");
  assert.equal(shouldScanContents("submission/evidence/run.json"), true);
  assert.equal(shouldScanContents("spikes/fixtures/screen.png"), false);
  assert.equal(shouldScanContents("apps/bff/src/app.ts"), false);
});
