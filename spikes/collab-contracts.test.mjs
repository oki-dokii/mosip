import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("./fixtures/collab-contracts-2026-10-20.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const walletFixtureUrls = [
  new URL("./fixtures/collab-reference-wallet-jsonld-2026-10-20.json", import.meta.url),
  new URL("./fixtures/collab-reference-wallet-sdjwt-2026-10-20.json", import.meta.url),
];
const walletFixtures = await Promise.all(walletFixtureUrls.map(async (url) =>
  JSON.parse(await readFile(url, "utf8"))));

test("fixture pins the deployed Phase 1 contracts", () => {
  assert.equal(fixture.containsSecrets, false);
  assert.equal(fixture.certify.credentialConfigurations.sdJwt.format, "dc+sd-jwt");
  assert.equal(fixture.certify.credentialConfigurations.jsonLd.format, "ldp_vc");
  assert.equal(fixture.certify.observed.sdJwtCredentialStatus, 401);
  assert.equal(fixture.certify.observed.jsonLdCredentialStatus, 401);
  assert.equal(fixture.verify.queryLanguage, "DCQL");
  assert.equal(fixture.verify.observedCancellationLifecycle.status, "VP_SUBMITTED");
  assert.deepEqual(fixture.mimoto.candidate.grantTypes, ["authorization_code"]);
  assert.equal(fixture.mimoto.observedIssuance.credentialConfiguration, "FarmerCredential_VCDM2.0");
  assert.equal(fixture.mimoto.observedIssuance.downloadSucceeded, true);
  assert.equal(fixture.mimoto.observedPresentation.jsonLdRequestRecognized, true);
  assert.equal(fixture.mimoto.observedPresentation.guestPresentationAvailable, false);
  assert.equal(fixture.mimoto.observedPresentation.sdJwtPresentationSupported, false);
});

test("fixture contains no secret-bearing fields or JWT-like values", () => {
  const serialized = JSON.stringify([fixture, ...walletFixtures]);
  const forbiddenField = /"(?:access_token|pre-authorized_code|c_nonce|privateKey|transactionId|requestId)"\s*:/i;
  const jwtLikeValue = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

  assert.doesNotMatch(serialized, forbiddenField);
  assert.doesNotMatch(serialized, jwtLikeValue);
});

test("reference wallet completes JSON-LD and SD-JWT on Collab", () => {
  const [jsonLd, sdJwt] = walletFixtures;

  assert.equal(jsonLd.credentialStatus, 200);
  assert.equal(jsonLd.verification.holderProofType, "Ed25519Signature2020");
  assert.equal(sdJwt.credentialStatus, 200);
  assert.equal(sdJwt.verification.holderProofType, "kb+jwt");

  for (const result of walletFixtures) {
    assert.equal(result.credentialReturned, true);
    assert.equal(result.verification.submissionStatus, 200);
    assert.equal(result.verification.resultStatus, 200);
    assert.equal(result.verification.allChecksSuccessful, true);
    assert.equal(result.verification.credentialProofValid, true);
    assert.equal(result.verification.holderProofValid, true);
    assert.equal(result.verification.holderKeyMatchesCredential, true);
  }
});
