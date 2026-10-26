# Test cases and evidence snapshot

Snapshot: 23 October 2026, merged `main` checkpoint `b0f132d`. [Hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) passed frozen install, typecheck, unit/contract tests, production build, secret audit, three Chromium browser checks and a PostgreSQL-backed six-case Docker mock matrix. The same source passed locally and in a fresh same-host clone. None of these commands performed a fresh Collab or real Inji-wallet journey.

24 October follow-up on `main` (`ad06775`): after the evidence catalog, URL redaction, failed-HTTP recording and cookie-origin fix, the **BFF suite alone** passed 199 tests with three opt-in PostgreSQL tests skipped. BFF and Web typechecks and the text secret audit passed. This is not a new whole-monorepo, browser, Docker, PostgreSQL or real-wallet result; the table below remains the dated 23 October full checkpoint.

25 October review of `main` (`2a500bc`): the fresh [managed A1 evidence](evidence/person2-managed-a1-2026-10-25/README.md) links one BFF run ID to Mimoto issuance and presentation observations, explicit storage confirmation, a request-URI HMAC marker, and that run's independent Verify `valid` result. The BFF suite passed **201** tests with three opt-in PostgreSQL tests skipped; the Web suite passed **58** tests. BFF and Web typechecks and the secret audit passed. The exported run/step/exchange/report IDs and verdicts were cross-checked. These are targeted current-code checks, not a repeat of the full-repo Docker/browser/clean-machine suite, and they do not independently replay the live wallet session.

| Test area | Result | What it establishes |
|---|---:|---|
| Script and contract checks | 36 passed | Committed contracts, protocol evaluation helpers, evidence tools and secret-audit behavior |
| Shared schemas | 3 passed | Configuration and evidence contracts |
| Mock issuer | 11 passed | Synthetic issuance, signed fault variants and HTTP boundaries |
| Mock verifier | 71 passed | Verification, required disclosure, negative reasons and HTTP boundaries |
| Web unit/component | 50 passed | Assisted state machine, safe evidence UI, matrix and cancellation behavior |
| BFF | 168 passed by default; 171 passed with PostgreSQL configured | Orchestration, capture/redaction, assisted APIs, reports and protocol evaluation; three persistence checks are opt-in |
| Chromium browser | 3 passed locally and in hosted CI | Assisted fixture, independent mock/capture flow, keyboard navigation and scoped axe/contrast checks |
| Typecheck, build, secret audit | Passed locally and in CI | Source compiles/builds; text and tracked-file secret scanner found no match |
| Docker Compose smoke | Passed in CI | Core + mocks started, PostgreSQL migrations completed, HTTP smoke and six exact-reason mock cases worked |

**Total:** the ordinary suite passed 339 tests and skipped three opt-in PostgreSQL checks. On 23 October, those three checks were run against a disposable PostgreSQL 16 container with all four migrations applied: **342 tests passed, none skipped**. The container was stopped and removed afterward. The browser count is separate from 342. Its synthetic fixtures and scoped axe results do not certify the whole product. [Hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) uploaded a [clean six-case matrix](evidence/2026-10-23-ci-mock-matrix.json) and browser evidence. The older [local protocol checkpoint](../spikes/fixtures/wallet-interop-integration-checks-2026-10-22.json) remains useful but recorded a dirty working tree.

## Functional evidence and limits

| Case | Source | Conclusion |
|---|---|---|
| Fixture issue → hold → present → verify | Unit/browser checks | Simulated flow works; no live interoperability claim |
| Certify → Reference Wallet → Verify, JSON-LD and SD-JWT | Earlier sanitized [Phase 2](../docs/PHASE2.md) and [spike fixtures](../spikes/fixtures/) | Recorded prior Reference Wallet behavior; full fresh run records are unavailable |
| Mock X.509 issuer → Reference Wallet → public Collab Verify | [21 October sanitized reports](evidence/README.md) | Valid and bad-signature outcomes observed; self-signed certificate does not prove production trust |
| Mock issuer → Reference Wallet → mock verifier | [23 October hosted six-case matrix](evidence/2026-10-23-ci-mock-matrix.json) | Clean-checkout Docker mock protocol outcomes with exact reasons; still no real Inji wallet |
| HAR import and secret handling | Capture/redaction tests, audit, browser mock test | Synthetic canaries absent from stored/API/socket/browser projections; passive capture has unobservable boundaries |
| A1: actual Inji Web JSON-LD wallet | [Managed run and capture limits](evidence/person2-managed-a1-2026-10-25/README.md) | **Managed technical chain observed:** signed-in wallet, Mimoto issuance/presentation transport, reload-backed storage confirmation, request-URI correlation, and independent Verify `valid` result for the same run. Server-side Mimoto calls were not observed; final team review remains pending |
| A2: actual Inji mobile SD-JWT wallet | [Mobile acceptance evidence](evidence/person3-a2-mobile-2026-10-23/README.md) | **Passed observed hybrid chain**: actual Android issuance/storage/share, user-confirmed reopening and correlated valid credential/holder proof result; installed binary and Collab release not independently attested |
| A6: playground + mocks packaging | [CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) and [deployment guide](../docs/DEPLOYMENT.md) | Hosted clean-checkout six-case Docker matrix passed; separate-machine human rehearsal and real local Inji profile remain open |

The [standalone aggregate report](evidence/2026-10-26-aggregate-interop.md) groups the committed run records and marks missing full-record cells `not_tested`. A passing mock or Reference Wallet result never closes A1/A2. All public fixtures use synthetic identities; keep actual `.env`, OTPs, private keys, full VCs, raw HAR and student IDs outside Git.

To repeat the ordinary checks, run `CI=true pnpm install --frozen-lockfile`, then `CI=true pnpm test`, `CI=true pnpm typecheck`, `CI=true pnpm build`, and `CI=true pnpm audit:secrets`. The browser suite additionally needs Playwright Chromium and starts four local services; see [README](../README.md#tests-and-evidence). To repeat the 342-test run, create a disposable PostgreSQL database, apply `pnpm db:deploy` with its `DATABASE_URL`, then set `CAPTURE_POSTGRES_TEST_URL` to that same database when running `pnpm test`. Never target a production or shared database: the tests create and delete synthetic run rows.

## Actual Android A2 acceptance — 23 October 2026

[Manual mobile evidence](evidence/person3-a2-mobile-2026-10-23/README.md) records the real Inji Wallet journey and correlated Verify result, separate from the automated control and unit-test counts. No new test suite was run for this evidence update. The same-wallet functional chain passes for the recorded hybrid profile; installed APK/signing identity, exact Collab release and native internal traffic remain unverified/unobserved.
