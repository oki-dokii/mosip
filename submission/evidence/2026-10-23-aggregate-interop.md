# Aggregate interoperability evidence — 23 October 2026

Compiled against merged `main` checkpoint `c4b00e3`. This report projects only metadata from committed sanitized run records; it does not execute a new wallet or Collab flow. Run IDs in the older memory-backed records are identifiers, not live web links. Open the linked record and search its run ID. Unknown deployment versions remain `unreported`.

## Observed mock interoperability with public Collab Verify

Two synthetic X.509 mock issuer → Reference Wallet → public Inji Verify SD-JWT runs from 21 October. The verifier deployment version was unreported; the issuer used a self-signed test certificate. These establish the recorded acceptance/rejection only, not production certificate trust or an Inji-wallet pass.

| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |
|---|---|---|---|---|---|---|---|
| `1328bfb9-d9cb-4390-8096-905c7fda2552` | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / none | valid / valid | not_recorded | — / — | 2026-10-21T15:36:10.316Z | [record](2026-10-21-mock-x509-valid.json) |
| `06243abe-61bb-4e0e-8e9f-a3f20f0533b6` | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / bad_signature | invalid / invalid | not_recorded | unreported / unreported | 2026-10-21T15:36:42.521Z | [record](2026-10-21-mock-x509-bad-signature.json) |

Known versions: issuer `mock-x509-1`, wallet `reference-wallet/0.1.0`, verifier `unreported`. Protocol profile and detailed rejection code were not recorded in these historical reports.

## Observed local mock protocol matrix

Six synthetic Docker mock issuer → Reference Wallet → mock verifier SD-JWT runs from 22 October, recorded in [the source matrix](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json). The source records commit `5a5e83b10bbb3dfdf45e226955f00f17c4c6b2e7` with `dirtyWorkingTree: true`; its exact code state is therefore not reproducible from that commit alone. Hosted CI on the merged tree separately passed the two-case Docker smoke in [run 27](https://github.com/oki-dokii/mosip/actions/runs/39901216659).

| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |
|---|---|---|---|---|---|---|---|
| `63665287-5de5-41f0-8e8c-9bad53849fde` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / none | valid / valid | correct_acceptance | PRESENT_RESULT / — | 2026-10-22T11:06:01.084Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |
| `7414c77e-e8c9-4d46-b607-ac6a69e9a54e` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / bad_signature | invalid / invalid | correct_rejection | PRESENT_RESULT / ISSUER_SIGNATURE_INVALID | 2026-10-22T11:06:02.623Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |
| `9fd63f79-99ba-4716-b994-9866bf200835` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / expired | invalid / invalid | correct_rejection | PRESENT_RESULT / CREDENTIAL_EXPIRED | 2026-10-22T11:06:04.213Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |
| `5bec166d-1d57-42ff-af99-bfe994eca251` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / wrong_type | invalid / invalid | correct_rejection | PRESENT_RESULT / CREDENTIAL_TYPE_MISMATCH | 2026-10-22T11:06:05.793Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |
| `736f032b-e1b9-458a-a341-fce619322bfb` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / missing_disclosure | invalid / invalid | correct_rejection | PRESENT_RESULT / REQUIRED_DISCLOSURE_MISSING | 2026-10-22T11:06:07.462Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |
| `8d72f454-745f-4652-84d3-23ffce3a2268` | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / replay_nonce | invalid / invalid | correct_rejection | PRESENT_RESULT / NONCE_MISMATCH | 2026-10-22T11:06:08.982Z | [record](../../spikes/fixtures/wallet-interop-bff-2026-10-22.json) |

Known versions: wallet `reference-wallet/0.1.0`, verifier `local-mock/1`; mock issuer build label was `unreported`. Profile `mock-sdjwt-flat-v1`, issuer representation `did:jwk`. The `replay_nonce` preset changes the nonce; a true byte replay is a separate local probe, not this matrix cell.

## Positive-control coverage still untested in committed full run records

| Issuer | Wallet | Verifier | Format | State |
|---|---|---|---|---|
| Inji Certify | Reference Wallet | Inji Verify | JSON-LD | `not_tested` in this full-record export; earlier sanitized spike summaries exist |
| Inji Certify | Reference Wallet | Inji Verify | SD-JWT | `not_tested` in this full-record export; earlier sanitized spike summaries exist |
| Inji Certify | Reference Wallet | Mock verifier | SD-JWT | `not_tested` in this full-record export |
| Mock issuer | Reference Wallet | Inji Verify | SD-JWT | observed above, 21 October |
| Mock issuer | Reference Wallet | Mock verifier | SD-JWT | observed above, 22 October |
| Inji Certify | Inji Web assisted | Inji Verify | JSON-LD | `not_tested`; A1 blocked on account and authenticated Web/Mimoto deployment |
| Inji Certify | Inji Wallet mobile | Inji Verify | SD-JWT | `not_tested`; A2 blocked on pinned installed app/device |

The last row is the A2 acceptance gate, beyond the current UI selector. `not_tested` is not a failed verifier result. The app's live `/api/v1/matrix/cells` endpoint derives its own current-run grid; this static report covers only the committed records linked above.

## Remaining acceptance boundaries

- A1 requires an actual logged-in Inji Web wallet to issue, persist, present and receive a correlated `valid` Verify result. The connected fixture and browser tests do not satisfy it. See [A1 evidence](../A1_WEB_EVIDENCE.md).
- A2 requires a pinned Inji Wallet mobile build and device, with the same full SD-JWT chain. See [A2 evidence](../A2_MOBILE_EVIDENCE.md).
- The pinned local Inji profile is configuration-only until Keymanager, eSignet and verifier trust settings are provisioned. See [local Inji status](../../deploy/INJI_LOCAL.md).
- Capture sees only explicitly recorded, allowlisted browser exchanges; server-to-server and native-wallet boundaries stay unobserved. See [capture limits](../../CAPTURE.md).

