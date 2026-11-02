# Interoperability evidence · 2 November 2026

The [claims table](CLAIMS_AND_EVIDENCE.md) and [protocol matrix](protocol-matrix.json) cover 79 observations. The following 12 historical run records overlap with those observations. They are not an additional pass count.

| Run or observation | Environment | Recorded outcome |
|---|---|---|
| [1328bfb9-d9cb-4390-8096-905c7fda2552](evidence/2026-10-21-mock-x509-valid.json) | mock_issuer_collab_verify | valid |
| [06243abe-61bb-4e0e-8e9f-a3f20f0533b6](evidence/2026-10-21-mock-x509-bad-signature.json) | mock_issuer_collab_verify | invalid |
| [77a1f577-9b5c-4695-a6b6-4ac895f89fc6](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | valid |
| [3e59c414-58a4-4687-84b2-6e6fc2541927](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | invalid |
| [bc667620-2c93-4096-abdc-54aed02d2dc8](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | invalid |
| [f589abb7-3c41-404e-8d27-80ee86dda3fc](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | invalid |
| [7c76f459-eb56-4cea-a095-2e774ca095c1](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | invalid |
| [00a3e2d0-9807-454a-a0ae-a2f8df6d1d9a](evidence/2026-10-23-ci-mock-matrix.json) | docker_mock_ci | invalid |
| [A2-20261023-1848](evidence/person3-a2-mobile-2026-10-23/attempt.json) | hybrid_local_certify_android_collab_verify | valid |
| [3dc6895d-ff87-45a2-a10b-46844198d83e](evidence/person2-managed-a1-2026-10-25/run-report.json) | hosted_collab_web | valid |
| [local-web-jsonld-2026-10-26](evidence/2026-10-26-local-web-jsonld/presentation.json) | local_synthetic_web_direct | valid |
| [f5f56b45-3160-49b3-96ff-e1238c412fb1](evidence/2026-10-26-managed-local-jsonld/run-report.json) | local_synthetic_web | valid |

## Protocol evidence by source

| Source file | Indexed rows |
|---|---:|
| [sd.json](evidence/2026-11-01-protocol/sd.json) | 20 |
| [ld.json](evidence/2026-11-01-protocol/ld.json) | 9 |
| [2026-10-25-local-inji-extended-matrix.json](evidence/2026-10-25-local-inji-extended-matrix.json) | 7 |
| [wallet-interop-live-2026-10-22.json](../spikes/fixtures/wallet-interop-live-2026-10-22.json) | 4 |
| [collab-reference-wallet-jsonld-2026-10-20.json](../spikes/fixtures/collab-reference-wallet-jsonld-2026-10-20.json) | 1 |
| [run-report.json](evidence/person2-managed-a1-2026-10-25/run-report.json) | 1 |
| [ui-checks.json](evidence/2026-10-26-person2-local-ui/ui-checks.json) | 1 |
| [verifier-result.json](evidence/person3-a2-mobile-2026-10-23/verifier-result.json) | 1 |
| [public-negative-pairs.json](evidence/2026-11-02-wallet-profile/public-negative-pairs.json) | 4 |
| [jsonld-pairs.json](evidence/2026-11-02-wallet-profile/jsonld-pairs.json) | 5 |
| [sd-grid.json](evidence/2026-11-02-wallet-profile/sd-grid.json) | 8 |
| [control.json](evidence/2026-11-02-wallet-profile/control.json) | 2 |
| [sd-only.json](evidence/2026-11-02-wallet-profile/sd-only.json) | 1 |
| [public-url.json](evidence/2026-11-02-wallet-profile/public-url.json) | 1 |
| [collab-refresh.json](evidence/2026-11-02-wallet-profile/collab-refresh.json) | 6 |
| [grid.json](evidence/2026-11-02-release/grid.json) | 2 |
| [accept-any-shape.json](evidence/2026-11-02-release/accept-any-shape.json) | 2 |
| [openwallet.json](evidence/2026-11-02-release/openwallet.json) | 1 |
| [dc-format.json](evidence/2026-11-02-release/dc-format.json) | 1 |
| [rejection.json](evidence/2026-11-02-release/rejection.json) | 1 |
| [alpha-routing.json](evidence/2026-11-02-release/alpha-routing.json) | 1 |

The [finding register](../docs/GAPS.md) tracks 14 entries. Two historical reference-holder cells stopped at the configured token endpoint. Both reruns obtained a credential using issuer discovery. Inji Verify returned an invalid verdict; the walt.id verifier run stopped at request retrieval (HTTP 406). The 2 MiB padding request is a size observation without a required verdict.
