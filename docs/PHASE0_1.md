# Phase 0 and Phase 1: baseline and contract spikes

**Started:** 2026-10-20  
**Status:** Complete

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
- A browser run using the public test identity and mock OTP documented in Certify's official quickstart completed `FarmerCredential_VCDM2.0` issuance. Inji Web reported success and downloaded the rendered Farmer ID Card.
- The flow is guest wallet → Farmer → Farmer ID Card → eSignet authorization code with PKCE → Mimoto/Certify credential download. The authorization page identifies the shared client as `Land Registry Client`, confirming a configuration-label mismatch worth reporting.
- This proves real Inji Web issuance and download for JSON-LD. It does not prove wallet storage or OpenID4VP presentation; those remain separate checkpoints.
- A redacted success screenshot is saved at `spikes/fixtures/inji-web-farmer-success.png`. No test identifier, OTP, authorization code, or credential is stored in the repository.
- A live JSON-LD request created by Inji Verify reached Inji Web's `/user/authorize` route. Inji Web recognized it as a credential-sharing request but required `Continue With Google`; guest presentation was unavailable and the earlier guest download was not retained as a wallet credential.
- The official Inji Web source at commit `a9f4f829d3070be34ae11649327ea1561e123a2b` confirms OpenID4VP presentation is limited to JSON-LD and that SD-JWT presentation is still pending. Its presentation APIs operate on a persistent wallet id and stored credentials.

### Reference Wallet end-to-end proof on Collab

- The headless Reference Wallet uses the official public `wallet-demo` Collab client, authorization code with PKCE, the documented synthetic identity, and fresh in-memory Ed25519 holder keys. The official Postman environment supplies the public test client configuration at runtime; no client key, identity value, OTP, access token, credential, or holder key is committed.
- Authorization-code issuance succeeds for `FarmerCredential_VCDM2.0` at the Farmer issuer and `MockVerifiableCredential_SD_JWT` at the mock issuer. This provides a working path while the mock issuer's separate pre-authorized token path remains misconfigured.
- The token response nonce is not the nonce accepted by either credential endpoint. Calling the issuer's advertised `/v1/certify/nonce` endpoint produces the accepted nonce.
- The Reference Wallet creates an `Ed25519Signature2020` JSON-LD presentation with the Verify request's nonce and client id as challenge and domain. It uses the holder's equivalent `did:key` verification method because the deployed Verify service rejects a presentation proof expressed as `did:jwk`.
- For SD-JWT, the wallet adds an EdDSA key-binding JWT containing the request audience, nonce, and `sd_hash`.
- The deployed v2/DCQL direct-post response is a JSON object from credential-query id to an array of tokens. It rejects `presentation_submission` for DCQL, despite the checked-out Verify documentation describing that field for presentation-definition flows.
- Both formats returned HTTP 200 from issuance, direct post, and `/v2/vp-results`. Verify reported `allChecksSuccessful: true`, a valid credential proof, a valid holder proof, and a holder key matching the issued credential.

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

The pinned sanitized fixtures are `spikes/fixtures/collab-contracts-2026-10-20.json`, `spikes/fixtures/collab-reference-wallet-jsonld-2026-10-20.json`, and `spikes/fixtures/collab-reference-wallet-sdjwt-2026-10-20.json`. Validate them with:

```bash
node --test spikes/collab-contracts.test.mjs
```

Run the end-to-end Reference Wallet with the official Certify Postman environment clone kept outside this repository:

```bash
OFFICIAL_POSTMAN_ENV_PATH=/path/to/inji-certify-with-mock-identity.postman_environment.json \
MOCK_OTP=<official-public-mock-otp> \
node spikes/collab-reference-wallet.mjs

CERTIFY_BASE_URL=https://injicertify-mock.collab.mosip.net \
CREDENTIAL_CONFIGURATION_ID=MockVerifiableCredential_SD_JWT \
CREDENTIAL_FORMAT=dc+sd-jwt \
OFFICIAL_POSTMAN_ENV_PATH=/path/to/inji-certify-with-mock-identity.postman_environment.json \
MOCK_OTP=<official-public-mock-otp> \
node spikes/collab-reference-wallet.mjs
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
- [x] Credential request accepted for both required formats through authorization code with PKCE. The mock issuer's separate pre-authorized path remains a recorded Collab defect.
- [x] Live Verify OpenAPI discovered.
- [x] Synthetic v2/DCQL VP request created and signed request object fetched.
- [x] Live Mimoto OpenAPI and issuer catalog discovered.
- [x] A real Inji Web issuer candidate selected (`Farmer`, JSON-LD, authorization code).
- [x] Complete `FarmerCredential_VCDM2.0` issuance and download in Inji Web using the official public Collab test identity.
- [x] The Reference Wallet consumes the signed Verify request and submits holder-bound presentations. Inji Web's persistent-login boundary is separately pinned below.
- [x] Verify returns a successful result for both `dc+sd-jwt` and `ldp_vc`.
- [x] Inji Web presentation capability isolated: JSON-LD requires a logged-in persistent wallet; guest presentation is unavailable; SD-JWT presentation is not implemented upstream.
- [x] Verify request cancellation lifecycle confirmed through submission, status, and result-error APIs.
- [x] Sanitized contract fixtures are saved and covered by an automated secret-safety test.
