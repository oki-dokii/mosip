# Phase 0 and Phase 1: baseline and contract spikes

**Started:** 2026-10-20  
**Status:** In progress

## Problem statement in plain language

The product is a test bench for digital credentials. A user chooses:

1. who issues a credential;
2. which wallet receives and shares it; and
3. which verifier checks it.

The playground then runs the journey, shows the protocol messages, and records whether that combination worked. The minimum useful demo proves this for two formats: JSON-LD and SD-JWT.

## Phase 0 baseline

The initial implementation defaults are:

- **Environment:** MOSIP Collab first, local mocks for the development loop, full local Inji stack later.
- **Wallet:** Inji Web first. If the pinned Collab version cannot complete the chosen presentation flow, use Inji Wallet mobile for the real all-Inji demonstration and retain the Reference Wallet for automation.
- **Delivery target:** one-week team MVP; mandatory flow before history, diagrams, tamper tools, mDoc, or same-device support.
- **First automated contract format:** `dc+sd-jwt`. The first Inji Web presentation uses `ldp_vc` because current upstream documentation lists SD-JWT presentation in Inji Web as pending; Inji Wallet mobile remains the SD-JWT all-Inji target.
- **Data:** synthetic identities only.

## Phase 1 findings

### Inji Certify on Collab

Observed against `https://injicertify-mock.collab.mosip.net` on 2026-10-20:

- `GET /.well-known/openid-credential-issuer` returns the live issuer metadata.
- The older configured path `/v1/certify/issuance/.well-known/openid-credential-issuer` returns 404.
- The issuer advertises `ldp_vc` and `dc+sd-jwt`, including `MockVerifiableCredential_SD_JWT`.
- `POST /v1/certify/pre-authorized-data` creates a short-lived credential offer from synthetic claims.
- `GET /v1/certify/credential-offer-data/{id}` returns a pre-authorized code.
- `POST /v1/certify/oauth/token` exchanges the code successfully.
- The live token response does not include `c_nonce`; the advertised `POST /v1/certify/nonce` endpoint supplies it separately.
- The current credential request schema uses `credential_configuration_id` and `proofs.jwt[]`.
- Complete repeatable attempts for both `dc+sd-jwt` (`MockVerifiableCredential_SD_JWT`) and JSON-LD (`MockVerifiableCredential_VCDM2.0`) reached the credential endpoint, which rejected each access token it had just issued with HTTP 401. No token or credential is written or printed.
- The rejected token has blank issuer and audience claims, and contains neither `c_nonce` nor `client_id`. Its signing key is also absent from the eSignet authorization server's advertised JWKS. The current Certify source validates those properties in production and supplies them in its newer pre-authorized implementation, so the evidence points to a Collab deployment/configuration mismatch rather than the generated wallet proof.

### Inji Verify on Collab

Observed against `https://injiverify.collab.mosip.net/v1/verify` on 2026-10-20:

- `GET /v3/api-docs` is publicly readable and is the contract source for the deployed service.
- The legacy planned `POST /vp-request` route returns 404.
- The current route is `POST /v2/vp-request` and requires a DCQL query.
- A synthetic SD-JWT request returned 201 with a transaction id, request id, expiry, and request URI.
- Fetching the request URI returned a signed `application/oauth-authz-req+jwt` request object.
- The response URI in that object is `/v2/vp-submission/direct-post`.
- A synthetic wallet cancellation submitted to that URI returned 200. Status then returned `VP_SUBMITTED`, and the result endpoint returned the expected 404 payload with `access_denied`. This confirms the create → signed request → submit → status → result-error lifecycle without presenting a credential.
- `GET /vp-request/{requestId}/status` long-polls while a request is active and returns immediately after submission.

### Inji Web and Mimoto on Collab

- Inji Web points to its same-origin Mimoto API at `/v1/mimoto`.
- The current Mimoto OpenAPI exposes `/issuers`, `/issuers/{issuer-id}`, and `/issuers/{issuer-id}/configuration`; the older `/credentialTypes` route returns 404.
- The public issuer catalog contained nine issuers during the spike but did not contain the `injicertify-mock` service used by the automated pre-authorized spike.
- `Farmer` is available and advertises two JSON-LD credential configurations through an authorization-code flow. It is the current first candidate for the real Inji Web issuance test.
- A browser spike confirmed the guest wallet lists Farmer, shows both advertised credential choices, and generates a PKCE authorization request to eSignet. Completing issuance now requires a Collab test UIN/VID and OTP. The authorization page identifies the shared client as `Land Registry Client`, which should be checked as a possible configuration-label mismatch.

## Consequences for implementation

1. Discover service capabilities from live metadata/OpenAPI and save a versioned snapshot; do not assume paths from old examples.
2. Add separate adapters for the legacy presentation-definition contract and the current v2/DCQL contract if both must be supported.
3. Treat `dc+sd-jwt` and legacy `vc+sd-jwt` as distinct format identifiers.
4. Capture traffic inside adapters first. A transparent rewriting proxy is optional because rewriting signed issuer, audience, request URI, DID, or redirect values can invalidate protocol messages.
5. Label the Reference Wallet clearly. It proves interoperability with Inji services but does not count as an all-Inji wallet.

## Repeatable spike

Run:

```bash
node spikes/collab-contract-spike.mjs
```

The script creates only short-lived synthetic offers and requests. It prints a sanitized capability summary and never prints or writes access tokens, pre-authorized codes, credentials, or private keys.

The pinned sanitized fixture is `spikes/fixtures/collab-contracts-2026-10-20.json`. Validate it with:

```bash
node --test spikes/collab-contracts.test.mjs
```

Optional endpoint overrides:

```bash
CERTIFY_BASE_URL=https://example-issuer.test \
VERIFY_BASE_URL=https://example-verifier.test/v1/verify \
MIMOTO_BASE_URL=https://example-wallet.test/v1/mimoto \
node spikes/collab-contract-spike.mjs
```

## Phase 1 exit checklist

- [x] Live Certify metadata discovered.
- [x] Synthetic pre-authorized offer created and token endpoint confirmed.
- [ ] Credential request accepted. The repeatable script currently records `fresh_pre_authorized_token_rejected` with HTTP 401 for both required formats on Collab.
- [x] Live Verify OpenAPI discovered.
- [x] Synthetic v2/DCQL VP request created and signed request object fetched.
- [x] Live Mimoto OpenAPI and issuer catalog discovered.
- [x] A real Inji Web issuer candidate selected (`Farmer`, JSON-LD, authorization code).
- [ ] Complete Farmer issuance in Inji Web. Browser flow reaches eSignet; a Collab test UIN/VID and OTP are required.
- [ ] The selected Inji wallet consumes the Verify request and submits a VP.
- [ ] Verify returns a result for both `dc+sd-jwt` and `ldp_vc`.
- [x] Verify request cancellation lifecycle confirmed through submission, status, and result-error APIs.
- [x] Sanitized contract fixtures are saved and covered by an automated secret-safety test.
