# Person 4: setup required before the next Person 3 mobile test

Updated: 23 October 2026. Implemented on `main`. **The recorded actual Android A2 chain now passes through the controlled official-Certify route.** This file retains the original setup handoff and authorization-code requirements as history; that Collab client registration was not changed. See [mobile acceptance evidence](../submission/evidence/person3-a2-mobile-2026-10-23/README.md) for the observed scope and remaining attestation/version limits.

## Implemented route after this handoff

The controlled mobile launcher is now implemented on `main`: `pnpm mobile:inji`. See [the executable mobile runbook](../deploy/MOBILE_INJI.md). It runs a digest-pinned official Certify instance with its own pre-authorized token service and generated keys, then checks a Reference Wallet issuance/presentation against Collab Verify before opening a local QR console. This is an alternative supported flow; it does not fix or administer Collab's rejected authorization-code client. The actual phone subsequently issued, stored, reopened and presented the credential; the correlated Verify result is valid with both proof flags true. The [runtime control record](../submission/evidence/2026-10-23-person4-mobile-control.json) records actual issuance and Verify `valid`, with both credential/holder proof flags true.

The checklists below retain the original authorization-code setup requirements for deployment owners. For the implemented pre-authorized route, external OAuth client registration, native OAuth callback and Mimoto catalog onboarding are not applicable; the token exchange is checked against the local official issuer. Collab Verify version attribution and APK attestation remain limitations.

## 1. Current evidence and the exact blocker

The user installed Inji Wallet, whose About page displays `1.0.0-alpha.1`, on an Android phone. The configured registry is `https://api.collab.mosip.net`. The displayed catalog does not include the mock SD-JWT issuer used by our protocol work.

A public inline authorization-code offer for `https://injicertify-mock.collab.mosip.net`, configuration `MockVerifiableCredential_SD_JWT`, was rendered as a QR. The phone scanned it, opened Authenticate, requested permission to use `mosip.net`, and reached eSignet. eSignet displayed **“Client ID is invalid. Please try again.”** before user authentication. No credential was issued or observed in storage, and no presentation or Verify result followed.

Evidence:

- [Mobile evidence bundle and five screenshots](../submission/evidence/person3-a2-2026-10-23/README.md).
- [Machine-readable attempt/checkpoint/hash manifest](../submission/evidence/person3-a2-2026-10-23/attempt.json).
- [A2 report and diagnosis](../submission/A2_MOBILE_EVIDENCE.md).
- [Acceptance gate](WALLET_VALIDATION.md).

The [official release source](https://github.com/inji/inji-wallet/blob/v1.0.0-alpha.1/shared/vciClient/VciClient.ts#L166) uses client ID `wallet` and callback `io.mosip.residentapp.inji://oauthredirect` for credential-offer issuance. These are source defaults, not a captured or attested authorization request from the installed APK. The screenshot establishes rejection; a registration mismatch is the current hypothesis.

Public issuer discovery identified authorization server `https://esignet-mock.collab.mosip.net`. Its discovery advertised `private_key_jwt` token authentication and no dynamic client-registration endpoint. The earlier pre-authorized flow separately reached credential HTTP 401. Neither a different QR nor a different grant is an established fix.

## 2. Person 4 checklist, in execution order

### P4-1 — Establish the target and ownership

- [ ] Choose a reachable pinned local Inji deployment, or obtain configuration support from the Collab deployment owner.
- [ ] Record the Certify, authorization server, Mimoto/catalog and Verify public base URLs and release/image identities. Keep unknown versions `unreported`.
- [ ] Confirm the phone can reach the canonical HTTPS endpoints. Record the registry actually used by this APK; the separate Web catalog inspection does not establish every native backend route.
- [ ] Identify who can manage clients on the authorization server. No client registration has been created by this branch.

**Deliverable:** target URL/version table and the person controlling client/catalog configuration. A browser/Reference Wallet success alone does not establish native-wallet compatibility.

### P4-2 — Confirm the actual mobile OAuth request

- [ ] Inspect the failed attempt through authorized server logs or device debugging, if available.
- [ ] Confirm the authorization host, `client_id`, callback, requested scope and PKCE method. If direct evidence is unavailable, retain the source-default diagnosis as an inference.
- [ ] Establish whether the chosen installed build supports the intended client configuration through catalog onboarding, deployment configuration or a rebuilt app.

**Deliverable:** a sanitized parameter/configuration comparison. Keep session state, codes, nonces, complete authentication URLs and tokens outside Git.

### P4-3 — Configure a supported native client and token exchange

- [ ] Register/configure the native wallet client at the selected authorization server using the exact callback emitted by the app.
- [ ] Allow the intended SD-JWT configuration/scope and configure the client's actual PKCE behavior.
- [ ] Resolve token authentication as well as authorization lookup. If a public native PKCE client is supported, use the server-supported configuration. If confidential `private_key_jwt` is required, provide the supported server-side Mimoto/client integration or another compatible official deployment/build path; the phone must not receive a confidential server signing key.
- [ ] Confirm that the registered client, callback and token exchange belong to the same end-to-end mobile flow. The existing Reference Wallet client credentials are not a drop-in replacement.

**Deliverable:** configuration/build references and an authorized test showing the app can get beyond client validation and complete its callback/token exchange. Registering an arbitrary `wallet` entry without checking the app's request and server policy is insufficient.

### P4-4 — Make the SD-JWT issuer available to that client

- [ ] Onboard the mock Certify SD-JWT issuer in the wallet/Mimoto catalog with its supported client settings, or provide a supported direct-offer configuration/build.
- [ ] Confirm issuer metadata advertises the selected configuration, format `dc+sd-jwt`, binding/proof algorithms and authorization server.
- [ ] Confirm the issued scope and permitted configuration match. The inspected Collab SD-JWT configuration advertises scope `mock_identity_vc_ldp`; use discovery/registration rather than inferring the format from that scope name.
- [ ] Provide documented synthetic test-identity instructions through the appropriate private/local channel. Do not commit identity values or OTPs.
- [ ] Provide a reproducible issuance entry point, including a new QR if its offer contains an expiring or single-use value. The committed QR contains only public authorization-code offer parameters.

**Deliverable:** supported entry point, client/catalog configuration reference and exact SD-JWT configuration ID. A JSON-LD Farmer card does not satisfy A2.

### P4-5 — Prepare matching Verify presentation

- [ ] Confirm the target Verify supports the mobile build's request profile/client-ID representation, DCQL query and credential type.
- [ ] Establish a way to create a fresh cross-device request for the issued SD-JWT and retrieve its result. The portal is suitable if it offers that exact type; otherwise prepare a bounded request/result helper.
- [ ] Confirm the phone can retrieve the request and reach its signed response URI using canonical HTTPS URLs.
- [ ] Define how to retain a sanitized correlated result, including available holder-proof checks and the actual target version.

**Deliverable:** a tested request-generation/result-retrieval procedure. This branch's BFF has no mobile-wallet driver; do not manufacture a BFF run ID for the manual attempt.

### P4-6 — Hand back a concrete ready-to-test package

Before the user retries, supply:

| Required item | Fill in |
| --- | --- |
| Target environment and deployment/configuration owner | Pending |
| Certify / authorization / Mimoto / Verify public URLs | Pending confirmation |
| Deployment versions or image digests | Pending; use unreported when unknown |
| Wallet version/build and official artifact or rebuilt source identity | Pending attestation |
| Actual registered client ID and exact callback | Pending confirmation |
| PKCE and supported token-authentication mechanism | Pending |
| Issuer/catalog configuration and SD-JWT type/scope | Pending |
| Issuance QR/entry point and synthetic authentication instructions | Pending |
| Fresh Verify request and bounded result retrieval procedure | Pending |
| Evidence that client validation/callback/token exchange works | Pending |

A phone installation, a service health check or the previous six mock cases cannot close this checklist. If Collab configuration cannot be changed, document the dependency and move to the pinned reachable target or compatible build; keep the gate blocked until prerequisites exist.

## 3. What Person 3 prepares after Person 4's handoff

- [ ] Review the supplied configuration against the actual wallet and issuer/verifier profiles.
- [ ] Record APK SHA-256, package/build/signing identity where available, phone model and Android version. A displayed version alone is insufficient build attestation.
- [ ] Check the fresh issuance offer and presentation request and prepare sanitized checkpoint/result recording.
- [ ] Guide one continuous issuance → wallet storage → presentation → verification attempt; separate retries with their own labels.
- [ ] Investigate observed protocol failures and update the findings; do not classify configuration rejection as a confirmed upstream defect.

## 4. What the user does on the phone after setup is ready

1. Keep the installed wallet and recorded settings; apply only the concrete configuration/build provided by the setup owner.
2. Start the supported SD-JWT issuance entry point.
3. Authenticate with the documented synthetic test identity and complete consent.
4. Confirm the credential appears in the wallet; close/reopen and confirm it remains.
5. Scan a fresh matching Verify request from the Mac, review the requested claims and approve presentation from that same wallet.
6. Observe the correlated terminal Verify result and capture only reviewed evidence.

**A2 passes only if the same-wallet chain completes and Verify returns valid.** Any inaccessible holder-binding detail remains unobserved rather than inferred from a screenshot. Reaching eSignet or downloading a file alone is insufficient.

## 5. Closeout and existing completed work

Person 3 updates [A2 evidence](../submission/A2_MOBILE_EVIDENCE.md), [wallet acceptance](WALLET_VALIDATION.md), findings and sanitized artifacts, then commits/pushes the result. If blocked, record the exact owner/dependency and retain the unpassed gate.

Already implemented/pushed in `39fceaf`: strict mock protocol profile, signed expiry/type variants, twelve independent cases, in-process/HTTP BFF parity, exact-reason evaluation, error/polling fixes, reports/UI/matrix identity and six Docker presets. The recorded 22 October checkpoint passed 266 tests with PostgreSQL enabled, typecheck, build, secret audit, twelve probes and six Docker scenarios. Those are historical verified results; this documentation/evidence change does not rerun or extend them.

See [protocol handoff](PERSON3_PROTOCOL_HANDOFF.md) and [check record](../spikes/fixtures/wallet-interop-integration-checks-2026-10-22.json). The recorded A2 chain is complete. Deployment version attribution, installed-binary/signing attestation and the separate Collab pre-authorized HTTP 401 remain limits; A1 and a fully local Verify/Web stack remain separate work.
