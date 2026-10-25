# Remaining technical work: four owners

Updated 2026-10-25. This assigns the improvement list supplied by the team. It excludes the deck, video, judge guide, submission logistics, and final publication audit. It does not turn proposed features or another team's results into evidence for this project.

## Starting point

- The local official Certify → reference holder → Verify SD-JWT path works. The separate pinned Web/Mimoto stack supports synthetic sign-in and wallet persistence, but its local issuer catalogue, issuance, and presentation are not yet proven end to end.
- A hosted, playground-managed Inji Web JSON-LD journey and a hybrid Android journey have evidence. Neither proves an all-local wallet path.
- The mock playground, capture/redaction pipeline, six-case mock matrix, CI, browser smoke, and some axe checks already exist. Extend them instead of rebuilding them.
- Keep evidence tiers explicit: `mock`, `reference_wallet`, `inji_web`, `inji_mobile`, and `not_tested`. Record component versions as `unreported` when unavailable. Never store raw real-session HARs, credentials, OTPs, private keys, or student IDs.

## Work lanes

| Owner | P0: finish first | Independent files | Hand-off proof |
| --- | --- | --- | --- |
| **Person 1 — capture and BFF security** | Complete a loopback-only canonical-URL capture proxy for *local* Mimoto → Certify/Verify calls. Tag each hop and its visibility boundary; keep the browser → Mimoto hop distinct. Add adversarial persistence/API/socket leak tests. | `apps/bff/src/capture/`, `apps/bff/src/redaction*`, `CAPTURE.md`, new capture/security tests | One synthetic local flow with exchange IDs for both hops, a coverage report, and tests proving canary secrets absent from DB/API/socket output. If a hop remains invisible, label it `not_observed`. |
| **Person 2 — Web wallet and UI** | Connect the pinned local Web/Mimoto wallet to a synthetic JSON-LD issuer catalogue. Automate login → issue → refresh → present → Verify result with Playwright and attach the playground run ID. Then attempt SD-JWT Web presentation and record pass or exact unsupported point. | `apps/web/`, `apps/web/browser/`, Web journey scripts/fixtures under `spikes/`; new local Web evidence files | Repeatable browser command, wallet screenshot after refresh, correlated run/exchange IDs, Verify verdict, and an honest SD-JWT result. |
| **Person 3 — protocol and cross-ecosystem evidence** | Define a small version-pinned live matrix with positive controls. Re-run the strongest existing local Verify findings, then attempt Android wallet → local Verify with local Certify. Add one independently implemented external issuer *or* verifier profile only if protocol versions align. | `apps/mock-issuer/`, `apps/mock-verifier/`, `apps/bff/src/tamper/`, `spikes/` protocol probes, `GAPS.md`, `submission/SCENARIO_SPEC_MAP.md`, mobile evidence | For each case: exact versions/profile, spec citation, one changed variable, expected/actual verdict, run ID, and evidence tier. Device-dependent cells may remain `not_tested`. |
| **Person 4 — local stack and CI** | Join the already pinned Certify/Verify and Web/Mimoto Compose stacks into one opt-in local profile with synthetic IdP, isolated DBs, generated local keys, health/readiness checks, and a one-command smoke. Wire Person 2's proven browser command and Person 3's proven matrix command into CI after they land. | `deploy/`, Compose/Dockerfiles, `scripts/` staging/smoke, `.github/workflows/`, `DEPLOYMENT.md` | Fresh checkout startup, all component versions/digests, local login/wallet persistence, endpoint map, smoke output, and CI links. A healthy container alone is not an end-to-end pass. |

## Exact interface between lanes

1. **Person 4 publishes the endpoint sheet first**: public browser origins, container origins, health routes, OIDC callback, Certify issuer/credential URL, Verify request/result URL, version/digest and protocol draft. Use synthetic configuration only. Person 2 and Person 3 consume it; they do not edit Compose.
2. **Person 1 publishes the capture contract next**: actor labels, rule IDs, permitted origins, proxy URL mapping and correlation fields. Person 4 only routes local traffic through it after the contract passes leakage tests. Person 2 consumes sanitized exchanges; raw values never cross into UI or run records.
3. **Person 2 and Person 3 own separate evidence directories.** Person 2 tests the Web wallet; Person 3 tests Android and protocol cases. Both use the same version labels and run ID format. A browser request to Mimoto does not prove a downstream request to Verify.
4. **One integrator handles shared seams**: `apps/bff/src/app.ts`, shared types, root `package.json`, `README.md`, and the final matrix/report aggregation. Owners send a short contract note and tests when those files need a change. No concurrent edits to them.
5. **No new branches until the user changes the rule.** Work in separate local copies, make focused commits with each person's Git identity, and have the integrator apply/review them sequentially on `main` and push. Preserve author metadata; do not squash or rewrite it.

## After the P0 path works

These are assigned, but must not displace the all-local wallet path. Every addition needs a runnable positive control and a clearly labelled limitation.

| Owner | P1 additions | Stretch only if P1 is stable |
| --- | --- | --- |
| Person 1 | Threat model, SSRF controls on credential-selected URLs, rate/content limits, CSP and an opt-in authenticated mode for non-local access; run-store retention/reset and safe backup; shape-only contract tests plus redactor/decoder property tests. | Mutation tests for security-sensitive code; privacy-safe success/latency/error counters and dashboard/export. Coordinate CI wiring with Person 4. |
| Person 2 | Claim-name/structure-only credential inspector, run comparison, filtered shareable URLs, keyboard/contrast/reduced-motion/screen-reader checks across every page. | Same-device deep link, then browser-supported Digital Credentials API with stand-in wallet clearly labelled; mobile layout, theme, i18n, brief integrator usability check. |
| Person 3 | Grow the spec-cited catalogue toward 25–40 **independent** cases only where executable. Cover signed expiry/not-yet-valid, holder/audience/type, true replay, nonce/disclosure faults, forged `x5c`, issuer trust, DID variants, JSON-LD context failure and malformed/oversized requests. Keep a version-pinned expected-fail registry and reproduce each proposed gap before promoting it. | Second Android device/OS, iOS if available, external ecosystem second role, release-to-release regression matrix, auth-code/tx_code/status-list flows, conformance-style probes and mDoc/mDL exploratory chain. Check for existing upstream issues and prepare sanitized issue drafts; security-impact findings require private coordination. |
| Person 4 | CI for typecheck/test/build, local Docker smoke, browser e2e, secret audit and a local nightly matrix; pin images by digest once the working versions are recorded. Add dependency/license scanning and code formatting/linting without destabilizing the baseline. | Generate OpenAPI/client from the settled API, architecture decisions, and per-version Compose profiles. Do not make Collab a required CI gate; run optional permitted Collab comparisons with drift recorded as data. |

Person 3 owns protocol semantics and the expected-fail registry; Person 4 owns only the runner/schedule. Person 1 owns telemetry data boundaries; Person 2 owns its display. For `collab.ts`, the integrator schedules a single post-integration refactor by Person 3, with behavior-preserving tests, after the live journey stops changing it.

## Gates and stopping rules

1. **First gate:** local stack starts; Person 1 can observe both server hops safely; Person 2 has a real Web JSON-LD run; Person 3 has positive controls and actual local Verify outcomes. If any dependency blocks the path, record the exact failed checkpoint and continue other P0 work.
2. **Second gate:** add only P1 items that can be completed and checked. One isolated negative case with a good positive control is more valuable than many unexplained red cells. Do not claim a phone pass, SD-JWT Web pass, cross-vendor pass, or conformance badge from a reference holder or synthetic fixture.
3. **Stretch gate:** same-device and one external profile take priority over mDoc, iOS, broad i18n, or a large case count. Stop an exploratory track when it cannot produce a reviewable result before the working code freeze; mark it `not_implemented` or `not_tested`.

This plan intentionally leaves presentation and submission work to a separate checklist. The four owners should hand off code, commands, test output, and sanitized evidence—not a claim of completion without a reproducible run.
