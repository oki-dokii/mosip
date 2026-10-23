# Test cases and evidence snapshot

Snapshot: 23 October 2026, merged `main` checkpoint `b0f132d`. [Hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) passed frozen install, typecheck, unit/contract tests, production build, secret audit, three Chromium browser checks and a PostgreSQL-backed six-case Docker mock matrix. The same source passed locally and in a fresh same-host clone. None of these commands performed a fresh Collab or real Inji-wallet journey.

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
| Certify → Reference Wallet → Verify, JSON-LD and SD-JWT | Earlier sanitized [Phase 2](../PHASE2.md) and [spike fixtures](../spikes/fixtures/) | Recorded prior Reference Wallet behavior; full fresh run records are unavailable |
| Mock X.509 issuer → Reference Wallet → public Collab Verify | [21 October sanitized reports](evidence/README.md) | Valid and bad-signature outcomes observed; self-signed certificate does not prove production trust |
| Mock issuer → Reference Wallet → mock verifier | [23 October hosted six-case matrix](evidence/2026-10-23-ci-mock-matrix.json) | Clean-checkout Docker mock protocol outcomes with exact reasons; still no real Inji wallet |
| HAR import and secret handling | Capture/redaction tests, audit, browser mock test | Synthetic canaries absent from stored/API/socket/browser projections; passive capture has unobservable boundaries |
| A1: actual Inji Web JSON-LD wallet | [A1 evidence](A1_WEB_EVIDENCE.md) | **Blocked**: no persistent account and authenticated Web/Mimoto target |
| A2: actual Inji mobile SD-JWT wallet | [A2 evidence](A2_MOBILE_EVIDENCE.md) | **Blocked**: no pinned installed build/device journey |
| A6: playground + mocks packaging | [CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583) and [deployment guide](../DEPLOYMENT.md) | Hosted clean-checkout six-case Docker matrix passed; separate-machine human rehearsal and real local Inji profile remain open |

The [standalone aggregate report](evidence/2026-10-23-aggregate-interop.md) groups the committed run records and marks missing full-record cells `not_tested`. A passing mock or Reference Wallet result never closes A1/A2. All public fixtures use synthetic identities; keep actual `.env`, OTPs, private keys, full VCs, raw HAR and student IDs outside Git.

To repeat the ordinary checks, run `CI=true pnpm install --frozen-lockfile`, then `CI=true pnpm test`, `CI=true pnpm typecheck`, `CI=true pnpm build`, and `CI=true pnpm audit:secrets`. The browser suite additionally needs Playwright Chromium and starts four local services; see [README](../README.md#tests-and-evidence). To repeat the 342-test run, create a disposable PostgreSQL database, apply `pnpm db:deploy` with its `DATABASE_URL`, then set `CAPTURE_POSTGRES_TEST_URL` to that same database when running `pnpm test`. Never target a production or shared database: the tests create and delete synthetic run rows.
