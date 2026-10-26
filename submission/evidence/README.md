# Evidence index

[Person 1's 26 October audit](2026-10-26-person1-audit/README.md) records fresh-clone
privacy checks, reviewed media hashes, the public synthetic-alias confirmation and
engineering verification. It does not replace independent-machine or final media review.

## Connected local Web wallet — 26 October 2026

[The local JSON-LD bundle](2026-10-26-local-web-jsonld/README.md) records official Certify 0.14.0 → actual official Inji Web/Mimoto wallet → local official Verify 0.18.2, with exact-card reload persistence, same-wallet consent/presentation and Valid with both proofs true. It uses a synthetic authorization fixture and explicit DID adapter. The direct browser harness is separate from managed BFF capture, hosted A1 and clean-machine evidence.

The [26 October aggregate report](2026-10-26-aggregate-interop.md) projects the historical Collab/mock records, hosted managed A1, clean-source local managed Web, direct local harness and separate Android observation. [Machine-readable matrix](2026-10-26-aggregate-matrix.json) preserves their deployments and record kinds. It executes no new flow. Regenerate it with `node scripts/build-aggregate-report.mjs` from the repository root and check it with `node scripts/build-aggregate-report.mjs --check`.

## Fresh synthetic live evidence — 21 October 2026

These are **actual exported BFF run reports**, not manually reconstructed outcomes. Both runs used source commit `ec1cbbd` on `main`, `PLAYGROUND_DRIVER_MODE=collab`, an ephemeral self-signed X.509 mock issuer (`mock-x509-1`), Reference Wallet `reference-wallet/0.1.0`, and the public Collab Inji Verify deployment (release label `unreported`). Run IDs are from temporary memory storage and are not persistent web links. The key and certificate were generated in a temporary directory by `pnpm dev:x509-mock` and removed when the process stopped.

| UTC start | Test | Expected | Actual | Run status | Evidence | Export |
|---|---|---|---|---|---|---|
| 2026-10-21 15:36:07 | Mock X.509 issuer → Reference Wallet → Inji Verify, SD-JWT | `valid` | `valid` | `passed` | `mock_interop` | [Sanitized JSON report](2026-10-21-mock-x509-valid.json) |
| 2026-10-21 15:36:40 | Same path with corrupted signature | `invalid` | `invalid` | `passed` | `mock_interop` | [Sanitized JSON report](2026-10-21-mock-x509-bad-signature.json) |

The [standalone matrix](2026-10-21-matrix.md) was exported from those two in-memory run records. Its table separator was corrected from the app's exported Markdown (which contained one extra separator cell); the run rows and values were not changed. The JSON reports are the BFF's direct `GET /api/v1/runs/:id/report?format=json` output. A local scan found no private-key PEM, unmasked access token, proof, or JWT-like value in either export; the token and nonce fields shown there are `[REDACTED]`.

This pair proves the tested mock issuer / Reference Wallet / Inji Verify behavior on that date. It does **not** prove an all-Inji wallet flow or that Verify validated a trusted certificate chain. The issuer certificate was self-signed. Prior Certify → Reference Wallet results remain documented in [Phase 2](../../docs/PHASE2.md) and [fixture snapshots](../../spikes/fixtures/), but their full run records were not retained; do not present those fixture summaries as fresh exported run reports.

**Separate gap probe, same source commit and synthetic roles:** [nonce-mismatch JSON report](2026-10-21-nonce-mismatch.json), run `f8756c3d-1389-4196-85d8-8b1e2909cc1a`. The new presentation used a nonce different from the verifier request. Verify returned HTTP 400 `invalid_request` at direct-post; the playground then timed out in `PRESENT_STATUS` and classified the run `errored`. This is not part of the positive/negative matrix above, and it does not test replaying a previously accepted token. See [GAPS.md](../../docs/GAPS.md) for the exact interpretation.

## Synthetic capture checks — 22 October 2026

[Capture v2 check record](2026-10-22-capture-checks.json) records the local PostgreSQL/API/socket redaction, public projection, route tagging, filter and ingress checks. It is synthetic capture evidence, separate from the live Collab verifier reports above. It does not close the Inji Web/mobile or canonical-proxy acceptance gates.


[Person 1 hardening check record](2026-10-22-person1-hardening-checks.json) records 116 passing tests with both PostgreSQL checks enabled, plus typecheck, build and secret audit. It covers the requested items 1–10; the four mock presentation probes remain a Person 3 handoff. Socket emission assertions use a test double, and the generated JSON-LD credential is a sanitization specimen, not a signature-validation result.

[October 21 run shape comparison](2026-10-22-capture-shape-diff.json) was generated from committed reports with `scripts/evidence-tools.mjs`. It shows differing result/submission shapes between the valid and bad-signature scenarios. It is not a new Collab run or an upstream regression claim. See [CAPTURE.md](../../docs/CAPTURE.md) for commands, comparison limits and private issue-draft export.

[Reviewer follow-up check record](2026-10-22-reviewer-followup-checks.json) covers the additional redaction and projection tests, split filter, documentation cleanup, and remaining UI handoff. It is synthetic local proof, not real-wallet acceptance evidence.

## Actual Android A2 acceptance — 23 October 2026

[Manual mobile bundle](person3-a2-mobile-2026-10-23/README.md) records official local Certify issuance into actual Inji Wallet, user-confirmed persistence after reopening, native consent/share screens and the correlated valid Inji Verify result with both proof flags true. This is distinct from [the automated setup control](2026-10-23-person4-mobile-control.json) and [the earlier blocked Collab attempt](person3-a2-2026-10-23/README.md). The bundle documents APK/deployment attestation and native-observation limits.

- [26 October playground-managed local JSON-LD acceptance](2026-10-26-managed-local-jsonld/README.md): clean-source BFF run with canonical server-hop capture, exact-card reload, independent Verify Valid, coverage and image provenance.

## 26 October Person 2 completion

[UI-managed local acceptance, media validation and browser limits](2026-10-26-person2-local-ui/README.md). [Final handoff](../PERSON2_COMPLETION.md).
