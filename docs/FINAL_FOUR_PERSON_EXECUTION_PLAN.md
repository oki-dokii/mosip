# Final four-person execution plan

Updated 26 October 2026. This is the current assignment for **all** remaining
engineering, quality, demo and submission work. It supersedes older task lists;
completed work is a baseline, not another assignment. Everyone can start now.
Dependencies determine execution order; no feature receives an invented pass just
because the team intends to implement it.

## Baseline: do not rebuild

- Official local Certify 0.14.0 → Inji Web 0.17.0 / Mimoto 0.22.0 → Verify 0.18.2
  JSON-LD direct-wallet flow passed exact-card reload and both verifier proof checks.
- Person 1 has also executed the **playground-managed local JSON-LD flow** with a
  BFF run ID, captured server hops and independent verifier result. [Clean-source evidence](../submission/evidence/2026-10-26-managed-local-jsonld/README.md)
  and the [capture/subject-name handoff](PERSON1_LOCAL_CAPTURE_HANDOFF.md) are the
  integration checkpoint; Person 2 should consume them rather than rebuild capture.
- Hosted managed A1 and hybrid Android A2 have separate dated evidence and limits.
- Mock services, six-case Docker demo, core CI, mock nightly, run comparison/archive,
  browser/axe checks, native Chromium zoom and mobile table contrast checks exist.
- Person 4's endpoint catalogue, readiness smoke and launcher are merged. The
  launcher reuses the proven projects; it does not start duplicate occupied ports.

## Person 1 — Soham / integrator, capture, security and authoritative records

Own this complete workstream:

1. Finish/review/push canonical local server-hop capture, lease/HMAC correlation,
   JSON-LD subject name/path projection and the managed local acceptance export.
   Include actual saved exchange IDs, coverage, byte-forwarding checks and raw
   PostgreSQL/API/socket canary-leak results. Keep unobserved hops explicit.
2. Integrate Person 2's inspector consumer and Person 3/4 contracts sequentially.
   Own shared types, root scripts, local HTTP/TLS policy, protocol adapter selection,
   version/provenance labels and the historical hosted wallet-metadata correction.
   Do not label hosted/Android records with local versions.
3. Refresh the aggregate report/matrix generator and committed outputs from actual
   source records. Reconcile README, readiness and gap-index references with Person
   3's facts. Do not synthesize BFF runs for historical direct/manual harnesses.
4. Complete concrete security improvements: outbound URL/SSRF policy, CSP,
   opt-in authentication before non-local exposure, bounded ingress, run retention,
   safe reset/backup and evidence-redaction regression checks. Coordinate only the
   deployment env knobs with Person 4; keep a loopback synthetic default.
5. Final fresh-clone privacy audit: inspect tracked filenames, secrets and all
   evidence images (especially Android). Record each inspected artifact/result;
   redact or remove exposed data and rerun checks. Never commit student IDs.
6. Repo/document cleanup: remove `docs/FEATURE_PARITY_ROADMAP.md` and its README link;
   review capture ADR and old Web handoff; archive obsolete person handoffs under
   `docs/archive/` and fix links. Keep the current capture contract and this plan
   easy to find. Remove competitive positioning and stale claims, while retaining
   required licenses, third-party attributions and evidence/source citations.
7. Put a 30-second judge path at the README top. Confirm the actual deadline with
   the team and write an agreed internal freeze 3–4 hours earlier. Do not infer an
   official deadline from another repository or a provisional planning date.
8. Final integration and submission ownership: approve evidence-backed deck claims
   with Person 2; collect team name/URLs; verify public/incognito reviewer access,
   cloud permissions and private individual-ID completion; send the final email
   with the team-authorized content and retain a private sent copy.

**Edit surface:** `apps/bff/src/capture/`, redaction/security modules, assisted/local
adapter seams, shared schemas, root scripts/package entries, README, aggregate
report generator, current readiness records and final audit docs. Other owners
request changes to these seams instead of editing them concurrently.

**Hand off:** capture contract + tested commit + sanitized managed run bundle;
current aggregate matrix/report; security/audit evidence; reviewed integrated main.

## Person 2 — real-wallet UI, complete UX, deck and video

Own this complete workstream:

1. Pull the capture handoff and consume `publicView` subject names/paths in the
   inspector. Handle absent, withheld and truncated projections without decoding
   raw credentials. Display browser and downstream exchanges separately and keep
   the verifier verdict distinct from transport 2xx.
2. Repeat the proven managed local command through the playground UI. Review the
   same-run issuance → exact-card reload → consent/presentation → independent
   Verify result and fill the existing acceptance checklist. Review hosted A1
   independently; do not turn team sign-off into an automatic evidence-tier change.
3. Complete a human UX pass: VoiceOver/NVDA, keyboard-only operation, enlarged text,
   actual 200%/400% visual review, real-phone layout, focus recovery and plain error
   messages. Automated axe/zoom checks do not fill human-result fields.
4. Implement same-device/deep-link support and a browser-supported Digital
   Credentials API path. Coordinate protocol inputs with Person 3; label any mock
   wallet/unsupported browser explicitly. Cover mobile layout, theme and i18n as
   coherent tested UI improvements rather than incomplete toggles.
5. Produce the evidence-backed deck: team name; problem/impact/architecture;
   local same-wallet JSON-LD chain with exact versions; hosted Web and Android
   evidence with limits; observed findings and narrow private-report status.
   Every number/claim must cite a committed evidence file. Export a PDF backup.
6. Produce a narrated 3–5 minute video: fresh mock run, real-wallet journey with
   inspector, one fault case, matrix and honest limits. Add captions; verify audio,
   playback and reviewer access. Supply final deck/video URLs to Person 1.

**Edit surface:** `apps/web/` (except Person 1's agreed local-action policy seam),
UI/browser fixtures, Person 2 evidence/checklists, deck/video/wireframe assets.
Do not edit capture, protocol drivers, Compose or shared schemas without a contract.

**Hand off:** inspector + UI acceptance commit, manual accessibility record,
same-device/DC API results, reviewed deck/PDF and narrated captioned video.

## Person 3 — protocol correctness, devices, independent ecosystems and gaps

Own this complete workstream:

1. Execute the strongest version-pinned scenarios on both formats where supported:
   valid controls, deliberately signed expiry/not-yet-valid, wrong type/holder,
   disclosure faults, forged certificate material, trust/DID variants, replay,
   nonce/audience and descriptor checks. For every case record one changed
   variable, spec expectation, actual result, exact versions/date and evidence.
   An entry in a catalogue is not an executed test.
2. Repeat Android issuance/reopen/presentation against **local Verify**. Own the
   phone session and device-specific setup with the operator. Keep the existing
   hybrid A2 pass separate. If iOS/another phone is available, execute and record
   that path; otherwise record the concrete device blocker without inventing results.
3. Run a separate SD-JWT presentation attempt on the pinned Inji Web release.
   Distinguish wallet capability from a playground selector/backend restriction;
   record a pass or the exact observed unsupported checkpoint. Give UI needs to P2.
4. Execute one protocol-aligned independent external issuer or verifier flow;
   progress beyond a documentation-only walt.id comparison. Coordinate any new
   container profile with P4. Then investigate a second external role and a
   meaningful mDoc/mDL chain; stop only with implemented proof or a precise blocker.
5. Own GAPS.md facts, scenario/spec mapping, expected-fail registry and sanitized
   issue drafts. Check for duplicates and file non-sensitive upstream findings
   such as G-05/G-09/G-10 with positive controls and exact reproductions.
6. Coordinate the private G-06/G-07 report with MOSIP: bounded reproduction,
   configuration, run IDs and positive control. Record sent date/status privately
   and update only the agreed narrow public wording. Do not publish sensitive
   reproduction material or change status to sent before the report is actually sent.
7. Give Person 1 normalized, dated evidence facts for the aggregate matrix/report
   and Person 4 a settled matrix runner with exit-code/expected-fail semantics.
   Do not edit the integrator's aggregate generator concurrently.

**Edit surface:** mock issuer/verifier, tamper/protocol probes and scenario fixtures,
protocol/device/external-ecosystem evidence, GAPS.md and issue drafts. Changes to
`collab.ts`, local adapters, shared types and deployment files go through P1/P4.

**Hand off:** executed matrix + controls + expected-fail registry, Android/local
result, external-format results, gap register, filed issue links/private-report status.

## Person 4 — reproducible deployment, CI, operations and dependency hygiene

Own this complete workstream:

1. Rehearse the final integrated commit from a clean clone: locked install,
   typecheck, tests, build, secret audit, `pnpm demo:docker`, official reference
   control and connected/managed Web commands where supported. Record OS, versions,
   exact commit, commands, actual counts and blockers in the clean-checkout record.
2. Arrange an independent-machine rehearsal by a teammate who did not write setup.
   Have them follow the README without undocumented fixes. Commit a pass **or** the
   exact failed checkpoint. A second directory on the same Mac is not another host.
3. Add an **opt-in connected local wallet CI job**, using P1/P2's proven command,
   and a scheduled local matrix with P3's expected-fail registry. Keep existing mock
   CI separate; never make Collab credentials a required public CI gate. Preserve
   positive controls and unexpected-regression failure behavior.
4. Confirm hosted CI green on the exact integrated final commit, not an earlier
   branch. Export only allowlisted sanitized summaries on failures: never raw HAR,
   browser auth state, credentials or unrestricted container logs.
5. Complete image digest pinning, dependency/security and transitive-license/asset
   notices, useful lint/format checks and Docker health/readiness. Keep the proven
   version set available and preserve separate DBs/runtime secrets and volumes.
6. Improve repeatability: preflight resource/port checks, clean startup/stop, bounded
   timeouts and recovery instructions. Implement a local public-context mirror if
   the network dependency is addressed; do not call the current stack offline.
   Coordinate real auth/HSM work with P1 rather than concealing existing limits.
7. Own privacy-safe telemetry plumbing and operational dashboards/export. Agree a
   small source contract with P1: counts, outcomes, durations and stable error codes
   only; no state, tokens, subject values or high-cardinality run IDs as metric labels.
   Ask P2 for any in-playground view; keep the new telemetry module separate from
   capture/driver files and wire it through the integrator.

**Edit surface:** `deploy/`, Compose/Dockerfiles, CI workflows, staging/CI smoke
scripts, reproducibility records, dependency/notice outputs, a new isolated telemetry
module. Root scripts and BFF/UI hook changes are integrated by P1/P2.

**Hand off:** clean/independent-host results, exact-commit CI links, opt-in local
runner, pinned manifests/notices, operational and privacy-safe telemetry evidence.

## Work together only at these checkpoints

| Checkpoint | Producer → consumer | Contract |
|---|---|---|
| Local capture + names | P1 → P2 | Read the current handoff, implement its consumer; no raw credentials/HAR |
| Local acceptance | P1 + P2 → P4 | Fresh run ID, exchange IDs, reload confirmation, independent Verify result and exact command |
| Protocol matrix | P3 → P4 | Version-pinned runner, positive control, expected-fail registry, bounded sanitized artifact list |
| Deployment/profile changes | P3/P1 → P4 | Endpoint/protocol/format requirements first; one Compose owner |
| Public facts | P3 + P2/P4 → P1 | Dated evidence files and limitations; P1 aggregates and fixes narrative drift |
| Security/telemetry seams | P1 ↔ P4; P4 → P2 | Fixed low-cardinality metadata contract; no raw claims or authentication data |
| Final release | Everyone → P1 | Focused authored commits, tested commands, evidence, declared blockers and accessible artifact URLs |

## Sequence and completion rule

Start independent work in all four lanes immediately. First complete the local
capture/inspector acceptance handoff, protocol positive controls and local CI runner.
Then broaden the requested format/device/protocol features while P2 develops the
pitch/video and P4 rehearses installation. P1 continuously integrates small changes
and keeps the public evidence inventory current.

Before the agreed freeze, every assigned feature must have a reproducible result:
implemented and tested, explicitly unsupported by the pinned upstream component,
or blocked with a recorded attempted checkpoint and next requirement. Feature count
alone never changes that result. External device/account/browser support may need
human help; assign that dependency immediately rather than leaving it implicit.

Use the existing agreed Git workflow. Do not create new branches automatically.
Preserve each contributor's authorship, coordinate pushes to main and never force
push/squash shared history. Only P1 edits shared seams during integration. No one
marks another owner's task done without the handoff evidence.
