# Phase 3: regression and cross-ecosystem runs

Status: **Core P1 regression tools and local mock paths implemented on 2026-10-21.** Standalone OpenID4VCI/OpenID4VP mock services and assisted Inji Web remain open.

Phase 3 makes repeat runs easier to compare and tests two non-Inji roles using the same run lifecycle. The web app now filters history by role, format, outcome, and recorded issuer/verifier version. Sequence playback reveals one recorded message at a time and selects the exact exchange in the inspector. The BFF rejects unsupported live combinations before creating a run.

## Live combinations

| Issuer | Wallet | Verifier | Format | Result |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD, SD-JWT | Both passed in Phase 2 |
| Inji Certify | Reference Wallet | Local non-Inji mock verifier | SD-JWT | Valid credential passed; bad signature rejected |
| Local non-Inji mock issuer | Reference Wallet | Inji Verify | SD-JWT | Submission completed; Verify rejected issuer schema/signature |
| Local non-Inji mock issuer | Reference Wallet | Local non-Inji mock verifier | SD-JWT | Signed credential passed local cryptographic checks |

The mock issuer signs a holder-bound SD-JWT using a per-run Ed25519 key and a `did:jwk` issuer identifier. Inji Verify accepted the presentation submission but returned an invalid result, with `credentialProofValid: false`. The [upstream VC verifier documentation](https://github.com/inji/vc-verifier) lists X.509 certificate support for SD-JWT issuers and says JWT VC issuer metadata is not supported. That matches the observed compatibility gap, though the run alone does not isolate every possible schema rule. The run remains a mismatch and is visible in history, matrix, report, and the step detail.

The mock verifier validates the SD-JWT issuer signature, expiry, credential type, holder key-binding JWT, audience, nonce, hash, and disclosed digest values. For Certify credentials it uses the certificate embedded in the JWT header; it **does not validate the certificate chain or trust anchor**. A pass proves cryptographic consistency, not issuer trust. It runs in the BFF process and uses `mock://` exchanges so the inspector clearly distinguishes simulated transport from live HTTP.

These local mocks exercise the role contracts and cryptography, but they are not standalone HTTP OpenID4VCI/OpenID4VP services. FR-90's external protocol boundary and a full trust-policy verifier remain follow-up work.

In Collab mode, the mock roles support SD-JWT only. The mock verifier also declines the missing-disclosure fault because its request has no required-disclosure policy; treating an omitted optional claim as invalid would give a false result. Assisted Inji Web still requires a dedicated persistent wallet account, and transparent Tap capture still requires a no-rewrite protocol design. Those remain future integrations; the selector explains unavailable combinations.

## Version labels

Each run snapshots issuer, wallet, and verifier version labels. Local mock and fixture versions are assigned by the app. Collab services do not expose a reliable release version through the tested public endpoints, so their labels default to `unreported`. Set `CERTIFY_VERSION_LABEL` and `VERIFY_VERSION_LABEL` to the deployment's actual version or image tag when known; only letters, numbers, `.`, `_`, `+`, and `-` are accepted. History and reports then show and filter those labels. Older runs have no version snapshot.

## Evidence

- Inji Certify → mock verifier: valid SD-JWT run `0112e753-df10-40fd-960e-9b0ecacfb8ad` passed; bad-signature run `bd9a24dd-7b1d-4e61-933d-81f7df582a8d` passed with expected `invalid`.
- Mock issuer → Inji Verify: run `37fb15a8-a4df-456e-a4d5-eb4c17a7c2e2` completed submission and produced `invalid` with the recorded detail “Verifier rejected the credential schema or issuer signature”; the run is correctly marked as a mismatch.
- Mock issuer → mock verifier: run `624faf7a-f5a9-40f5-a6b3-c8aae8117e1f` passed all ten application steps with an in-memory signed credential and no certificate trust check.
- Version-filtered history returned two local-mock issuer runs; the matrix showed both tested combinations. A fresh PostgreSQL 18 cluster applied all four migrations and persisted a fixture run with its version snapshot.
- These smoke run IDs came from temporary memory-mode BFF processes; they are evidence identifiers, not permanent links. The official public Collab test environment remained outside the repository.
