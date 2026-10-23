# Aggregate interoperability evidence — 23 October 2026

Compiled against merged `main` checkpoint `b0f132d`. This report projects only metadata from committed sanitized run records; it does not execute a new wallet or Collab flow. Run IDs in the older memory-backed records are identifiers, not live web links. Open the linked record and search its run ID. Unknown deployment versions remain `unreported`.

## Observed mock interoperability with public Collab Verify

Two synthetic X.509 mock issuer → Reference Wallet → public Inji Verify SD-JWT runs from 21 October. The verifier deployment version was unreported; the issuer used a self-signed test certificate. These establish the recorded acceptance/rejection only, not production certificate trust or an Inji-wallet pass.

| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |
|---|---|---|---|---|---|---|---|
| `1328bfb9-d9cb-4390-8096-905c7fda2552` | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / none | valid / valid | not_recorded | — / — | 2026-10-21T15:36:10.316Z | [record](2026-10-21-mock-x509-valid.json) |
| `06243abe-61bb-4e0e-8e9f-a3f20f0533b6` | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / bad_signature | invalid / invalid | not_recorded | unreported / unreported | 2026-10-21T15:36:42.521Z | [record](2026-10-21-mock-x509-bad-signature.json) |

Known versions: issuer `mock-x509-1`, wallet `reference-wallet/0.1.0`, verifier `unreported`. Protocol profile and detailed rejection code were not recorded in these historical reports.

## Observed hosted CI mock protocol matrix

Six synthetic Docker mock issuer → Reference Wallet → mock verifier SD-JWT runs from 23 October, recorded in [the source matrix](2026-10-23-ci-mock-matrix.json). The source records commit `b0f132d9beb8536cc81bc4d468ef6b970b34a876`, capture time `2026-10-23T04:58:07.335Z`, PostgreSQL storage and `dirtyWorkingTree: false`. All six passed with exact expected verdicts in [hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583). This clean CI evidence supersedes the earlier 22 October dirty-tree mock matrix for the submission report.

| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |
|---|---|---|---|---|---|---|---|
| `77a1f577-9b5c-4695-a6b6-4ac895f89fc6` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / none | valid / valid | correct_acceptance | PRESENT_RESULT / — | 2026-10-23T04:57:59.414Z | [record](2026-10-23-ci-mock-matrix.json) |
| `3e59c414-58a4-4687-84b2-6e6fc2541927` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / bad_signature | invalid / invalid | correct_rejection | PRESENT_RESULT / ISSUER_SIGNATURE_INVALID | 2026-10-23T04:58:00.881Z | [record](2026-10-23-ci-mock-matrix.json) |
| `bc667620-2c93-4096-abdc-54aed02d2dc8` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / expired | invalid / invalid | correct_rejection | PRESENT_RESULT / CREDENTIAL_EXPIRED | 2026-10-23T04:58:02.465Z | [record](2026-10-23-ci-mock-matrix.json) |
| `f589abb7-3c41-404e-8d27-80ee86dda3fc` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / wrong_type | invalid / invalid | correct_rejection | PRESENT_RESULT / CREDENTIAL_TYPE_MISMATCH | 2026-10-23T04:58:03.990Z | [record](2026-10-23-ci-mock-matrix.json) |
| `7c76f459-eb56-4cea-a095-2e774ca095c1` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / missing_disclosure | invalid / invalid | correct_rejection | PRESENT_RESULT / REQUIRED_DISCLOSURE_MISSING | 2026-10-23T04:58:05.467Z | [record](2026-10-23-ci-mock-matrix.json) |
| `00a3e2d0-9807-454a-a0ae-a2f8df6d1d9a` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / replay_nonce | invalid / invalid | correct_rejection | PRESENT_RESULT / NONCE_MISMATCH | 2026-10-23T04:58:06.995Z | [record](2026-10-23-ci-mock-matrix.json) |

Known versions: wallet `reference-wallet/0.1.0`, verifier `local-mock/1`; mock issuer build label was `unreported`. Profile `mock-sdjwt-flat-v1`, issuer representation `did:jwk`. The `replay_nonce` preset changes the nonce; a true byte replay is a separate local probe, not this matrix cell.

## Positive-control coverage still untested in committed full run records

| Issuer | Wallet | Verifier | Format | State |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD | `not_tested` in this full-record export; earlier sanitized spike summaries exist |
| Inji Certify | Reference Wallet | Inji Verify | SD-JWT | `not_tested` in this full-record export; earlier sanitized spike summaries exist |
| Inji Certify | Reference Wallet | Mock verifier | SD-JWT | `not_tested` in this full-record export |
| Mock issuer | Reference Wallet | Inji Verify | SD-JWT | observed above, 21 October |
| Mock issuer | Reference Wallet | Mock verifier | SD-JWT | observed above, 23 October |
| Inji Certify | Inji Web assisted | Inji Verify | JSON-LD | `not_tested`; A1 blocked on account and authenticated Web/Mimoto deployment |
| Inji Certify | Inji Wallet mobile | Inji Verify | SD-JWT | `not_tested`; A2 blocked on pinned installed app/device |

The last row is the A2 acceptance gate, beyond the current UI selector. `not_tested` is not a failed verifier result. The app's live `/api/v1/matrix/cells` endpoint derives its own current-run grid; this static report covers only the committed records linked above.

## Remaining acceptance boundaries

- A1 requires an actual logged-in Inji Web wallet to issue, persist, present and receive a correlated `valid` Verify result. The connected fixture and browser tests do not satisfy it. See [A1 evidence](../A1_WEB_EVIDENCE.md).
- A2 requires a pinned Inji Wallet mobile build and device, with the same full SD-JWT chain. See [A2 evidence](../A2_MOBILE_EVIDENCE.md).
- The pinned local Inji profile is configuration-only until Keymanager, eSignet and verifier trust settings are provisioned. See [local Inji status](../../deploy/INJI_LOCAL.md).
- Capture sees only explicitly recorded, allowlisted browser exchanges; server-to-server and native-wallet boundaries stay unobserved. See [capture limits](../../CAPTURE.md).

