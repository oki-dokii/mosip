# Aggregate interoperability evidence — 26 October 2026

Generated from committed source records. This command executes no wallet or network flow. Hosted, local, direct-harness and Android evidence stay separate; direct/manual records have no invented BFF run IDs. Historical source files are preserved.

## Recorded results

| Record / source | Deployment | Participants | Format / fault | Expected / actual | Evaluation | Versions: issuer / wallet / verifier | Observed (UTC) |
|---|---|---|---|---|---|---|---|
| [1328bfb9-d9cb-4390-8096-905c7fda2552](2026-10-21-mock-x509-valid.json) | mock_issuer_collab_verify (bff_run) | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / none | valid / valid | not_recorded | mock-x509-1 / reference-wallet/0.1.0 / unreported | 2026-10-21T15:36:10.316Z |
| [06243abe-61bb-4e0e-8e9f-a3f20f0533b6](2026-10-21-mock-x509-bad-signature.json) | mock_issuer_collab_verify (bff_run) | mock_issuer → reference_wallet → inji_verify | vc_sd_jwt / bad_signature | invalid / invalid | not_recorded | mock-x509-1 / reference-wallet/0.1.0 / unreported | 2026-10-21T15:36:42.521Z |
| [77a1f577-9b5c-4695-a6b6-4ac895f89fc6](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / none | valid / valid | correct_acceptance | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:57:59.414Z |
| [3e59c414-58a4-4687-84b2-6e6fc2541927](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / bad_signature | invalid / invalid | correct_rejection | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:58:00.881Z |
| [bc667620-2c93-4096-abdc-54aed02d2dc8](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / expired | invalid / invalid | correct_rejection | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:58:02.465Z |
| [f589abb7-3c41-404e-8d27-80ee86dda3fc](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / wrong_type | invalid / invalid | correct_rejection | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:58:03.990Z |
| [7c76f459-eb56-4cea-a095-2e774ca095c1](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / missing_disclosure | invalid / invalid | correct_rejection | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:58:05.467Z |
| [00a3e2d0-9807-454a-a0ae-a2f8df6d1d9a](2026-10-23-ci-mock-matrix.json) | docker_mock_ci (bff_run) | mock_issuer → reference_wallet → mock_verifier | vc_sd_jwt / replay_nonce | invalid / invalid | correct_rejection | unreported / reference-wallet/0.1.0 / local-mock/1 | 2026-10-23T04:58:06.995Z |
| [A2-20261023-1848](person3-a2-mobile-2026-10-23/attempt.json) | hybrid_local_certify_android_collab_verify (manual_android_observation) | inji_certify → inji_mobile → inji_verify | vc_sd_jwt / none | valid / valid | observed_wallet_chain | 1.0.0-alpha.1 / 1.0.0-alpha.1 (About screen) / unreported | 2026-10-23T13:22:10.735Z |
| [3dc6895d-ff87-45a2-a10b-46844198d83e](person2-managed-a1-2026-10-25/run-report.json) | hosted_collab_web (bff_run) | inji_certify → inji_web_assisted → inji_verify | ldp_vc / none | valid / valid | correct_acceptance | unreported / unreported / unreported | 2026-10-24T21:35:40.396Z |
| [local-web-jsonld-2026-10-26](2026-10-26-local-web-jsonld/presentation.json) | local_synthetic_web_direct (direct_wallet_harness) | inji_certify → inji_web → inji_verify | ldp_vc / none | valid / valid | observed_wallet_chain | 0.14.0 / 0.17.0 / 0.18.2 | 2026-10-25T21:51:25.063Z |
| [f5f56b45-3160-49b3-96ff-e1238c412fb1](2026-10-26-managed-local-jsonld/run-report.json) | local_synthetic_web (bff_run) | inji_certify → inji_web_assisted → inji_verify | ldp_vc / none | valid / valid | correct_acceptance | 0.14.0 / 0.17.0 / 0.18.2 | 2026-10-26T05:07:45.170Z |

## Provenance and boundaries

### A2-20261023-1848

- Reopen persistence is user-confirmed.
- Installed APK/source identity and Collab build not independently attested.
- Hybrid path, not Android→local Verify; no native capture or BFF run ID.

### 3dc6895d-ff87-45a2-a10b-46844198d83e

- Historical export incorrectly labelled Inji Web as reference-wallet/0.1.0; corrected only in this projection.
- Browser→Mimoto observations only; downstream server hops not observed.
- Deployed versions unreported; final team review separate.

### local-web-jsonld-2026-10-26

- Separate direct harness; no fabricated BFF run ID.
- Synthetic authorization and DID adapter; public context dependency.

### f5f56b45-3160-49b3-96ff-e1238c412fb1

- Synthetic IAR authorization fixture and declared DID assertionMethod adapter.
- Canonical server hops observed; browser capture not attached; signed request passed by value.
- Public context network dependency and KERNEL health warning remain.
- Generic report evidence tier remains unverified; this is an observed functional pass, not conformance certification.

The local managed record has source commit `f959edc145b82da04695353a51e9c3cf4e32a9b0`, a clean source tree and running-image digests in [its provenance](2026-10-26-managed-local-jsonld/provenance.json). Exact-card reload, same-wallet selection and both proof checks are recorded separately in [browser checks](2026-10-26-managed-local-jsonld/browser-checks.json).

The original hosted wallet version was incorrectly reference-wallet/0.1.0. The current aggregate and archived API projection use unreported; the immutable source is not rewritten and local Web 0.17.0 is not substituted for the hosted release.

A passing HTTP transport is not a verifier verdict. A known invalid negative without exact reason diagnostics is not counted as an exact-reason conformance pass. The mock replay_nonce preset is a nonce mutation, not true byte replay.

## Still unobserved in these committed records

- Android wallet → fully local Verify
- Inji Web SD-JWT presentation
- Executed external ecosystem issuer/verifier
- mDoc/DC API/iOS wallet chain
- Independent-machine full local wallet rehearsal

Final team acceptance, independent setup, private gap reporting and current CI are separate release checks. See [readiness](../READINESS.md), [findings](../../docs/GAPS.md) and the [current assignment](../../docs/FINAL_FOUR_PERSON_EXECUTION_PLAN.md).
