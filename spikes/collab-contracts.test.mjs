import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("./fixtures/collab-contracts-2026-10-20.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("fixture pins the deployed Phase 1 contracts", () => {
  assert.equal(fixture.containsSecrets, false);
  assert.equal(fixture.certify.format, "dc+sd-jwt");
  assert.equal(fixture.certify.observed.credentialStatus, 401);
  assert.equal(fixture.verify.queryLanguage, "DCQL");
  assert.equal(fixture.verify.observedCancellationLifecycle.status, "VP_SUBMITTED");
  assert.deepEqual(fixture.mimoto.candidate.grantTypes, ["authorization_code"]);
});

test("fixture contains no secret-bearing fields or JWT-like values", () => {
  const serialized = JSON.stringify(fixture);
  const forbiddenField = /"(?:access_token|pre-authorized_code|c_nonce|privateKey|transactionId|requestId)"\s*:/i;
  const jwtLikeValue = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

  assert.doesNotMatch(serialized, forbiddenField);
  assert.doesNotMatch(serialized, jwtLikeValue);
});
