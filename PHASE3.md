# Phase 3: regression and cross-ecosystem runs

Status: **Core P1 regression tools and standalone OpenID4VCI/OpenID4VP mock services implemented on 2026-10-21.** Assisted Inji Web and transparent Tap capture remain open.

Phase 3 makes repeat runs easier to compare and tests two non-Inji roles using the same run lifecycle. The web app now filters history by role, format, outcome, and recorded issuer/verifier version. Sequence playback reveals one recorded message at a time and selects the exact exchange in the inspector. The BFF rejects unsupported live combinations before creating a run.

## Live combinations

| Issuer | Wallet | Verifier | Format | Result |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD, SD-JWT | Both passed in Phase 2 |
| Inji Certify | Reference Wallet | Standalone non-Inji mock verifier | SD-JWT | Valid credential passed; bad signature rejected |
| Standalone non-Inji mock issuer | Reference Wallet | Inji Verify | SD-JWT | Submission completed; Verify rejected issuer schema/signature |
| Standalone non-Inji mock issuer | Reference Wallet | Standalone non-Inji mock verifier | SD-JWT | Signed credential passed cross-service cryptographic checks |

The standalone mock issuer in `apps/mock-issuer` serves discovery, a pre-authorized token endpoint, and a JWT-proof credential endpoint over HTTP. It signs holder-bound SD-JWTs using an in-memory Ed25519 key and a `did:jwk` issuer identifier. Set `MOCK_ISSUER_BASE_URL=http://127.0.0.1:4101` to select this separate service; `pnpm dev` starts it. Without that setting the BFF retains its in-process mock for a zero-setup test loop.

Inji Verify accepted the standalone issuer presentation submission but returned an invalid result, with `credentialProofValid: false`. The [upstream VC verifier documentation](https://github.com/inji/vc-verifier) lists X.509 certificate support for SD-JWT issuers and says JWT VC issuer metadata is not supported. That matches the observed compatibility gap, though the run alone does not isolate every possible schema rule. The run remains a mismatch and is visible in history, matrix, report, and the step detail.

The standalone mock verifier in `apps/mock-verifier` serves presentation request, direct-post submission, status, and result endpoints. Set `MOCK_VERIFIER_BASE_URL=http://127.0.0.1:4102` to select it; `pnpm dev` starts it. Without that setting the BFF retains its in-process mock verifier for quick tests. Both validate the SD-JWT issuer signature, expiry, credential type, holder key-binding JWT, audience, nonce, hash, and disclosed digest values. For Certify credentials they use the certificate embedded in the JWT header; they **do not validate the certificate chain or trust anchor**. A pass proves cryptographic consistency, not issuer trust.

Both mock roles now have separate HTTP protocol boundaries when their base URLs are configured. Full certificate trust-policy validation remains follow-up work.

In Collab mode, the mock roles support SD-JWT only. The mock verifier also declines the missing-disclosure fault because its request has no required-disclosure policy; treating an omitted optional claim as invalid would give a false result. Assisted Inji Web still requires a dedicated persistent wallet account, and transparent Tap capture still requires a no-rewrite protocol design. Those remain future integrations; the selector explains unavailable combinations.

## Version labels

Each run snapshots issuer, wallet, and verifier version labels. Local mock and fixture versions are assigned by the app. Collab services do not expose a reliable release version through the tested public endpoints, so their labels default to `unreported`. Set `CERTIFY_VERSION_LABEL` and `VERIFY_VERSION_LABEL` to the deployment's actual version or image tag when known; only letters, numbers, `.`, `_`, `+`, and `-` are accepted. History and reports then show and filter those labels. Older runs have no version snapshot.

## Evidence

- Inji Certify → mock verifier: valid SD-JWT run `0112e753-df10-40fd-960e-9b0ecacfb8ad` passed; bad-signature run `bd9a24dd-7b1d-4e61-933d-81f7df582a8d` passed with expected `invalid`.
- Mock issuer → Inji Verify: run `37fb15a8-a4df-456e-a4d5-eb4c17a7c2e2` completed submission and produced `invalid` with the recorded detail “Verifier rejected the credential schema or issuer signature”; the run is correctly marked as a mismatch.
- Mock issuer → mock verifier: run `624faf7a-f5a9-40f5-a6b3-c8aae8117e1f` passed all ten application steps with an in-memory signed credential and no certificate trust check.
- Standalone mock issuer → mock verifier: run `15118b76-f0e4-4d6e-b1f0-e20864d8b2f2` passed using HTTP discovery, form token exchange, JWT proof, and credential issuance.
- Standalone mock issuer → Inji Verify: run `27be569a-ff0a-4ef2-9595-3806adf47ad9` completed issuance and submission, then recorded the same signature/schema mismatch.
- Standalone issuer → standalone verifier: run `71ffda4f-a783-403c-ba8a-4b0123b3f2ff` passed. Certify → standalone verifier with a corrupted issuer signature: run `d8864dcd-6304-40d3-b6ee-8e1c349d0924` passed with expected `invalid`. The latter exposed and fixed a base64url fault-injection bug: changing a trailing character did not always change the decoded signature bytes.
- Version-filtered history returned two local-mock issuer runs; the matrix showed both tested combinations. A fresh PostgreSQL 18 cluster applied all four migrations and persisted a fixture run with its version snapshot.
- These smoke run IDs came from temporary memory-mode BFF processes; they are evidence identifiers, not permanent links. The official public Collab test environment remained outside the repository.
