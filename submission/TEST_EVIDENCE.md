# Test cases and evidence snapshot

Snapshot: 23 October 2026, merged `main` checkpoint `c4b00e3`. [Hosted CI run 27](https://github.com/oki-dokii/mosip/actions/runs/39901216659) passed frozen install, typecheck, unit/contract tests, production build, secret audit, and a PostgreSQL-backed Docker mock smoke. The same merged source passed locally. None of these commands performed a fresh Collab or real Inji-wallet journey.

| Test area | Result | What it establishes |
|---|---:|---|
| Script and contract checks | 36 passed | Committed contracts, protocol evaluation helpers, evidence tools and secret-audit behavior |
| Shared schemas | 3 passed | Configuration and evidence contracts |
| Mock issuer | 11 passed | Synthetic issuance, signed fault variants and HTTP boundaries |
| Mock verifier | 71 passed | Verification, required disclosure, negative reasons and HTTP boundaries |
| Web unit/component | 50 passed | Assisted state machine, safe evidence UI, matrix and cancellation behavior |
| BFF | 168 passed, 3 skipped | Orchestration, capture/redaction, assisted APIs, reports and protocol evaluation; skipped checks need `CAPTURE_POSTGRES_TEST_URL` |
| Chromium browser | 3 passed locally | Assisted fixture, independent mock/capture flow, keyboard navigation and scoped axe/contrast checks |
| Typecheck, build, secret audit | Passed locally and in CI | Source compiles/builds; text and tracked-file secret scanner found no match |
| Docker Compose smoke | Passed in CI | Core + mocks started, PostgreSQL migrations completed, fixture/mock HTTP flow worked |

**Total:** 339 runnable automated tests passed; three opt-in PostgreSQL checks skipped in the ordinary suite. The browser count is separate from 339. The browser checks use synthetic fixtures and local mocks; their scoped axe results do not certify the whole product. The merged CI run used the two-case HTTP smoke. The six controlled SD-JWT cases passed at the earlier local [protocol checkpoint](../spikes/fixtures/wallet-interop-integration-checks-2026-10-22.json); its stored matrix records a dirty working tree. The six-case exporter is now wired into the next CI/nightly run, pending hosted confirmation.

## Functional evidence and limits

| Case | Source | Conclusion |
|---|---|---|
| Fixture issue → hold → present → verify | Unit/browser checks | Simulated flow works; no live interoperability claim |
| Certify → Reference Wallet → Verify, JSON-LD and SD-JWT | Earlier sanitized [Phase 2](../PHASE2.md) and [spike fixtures](../spikes/fixtures/) | Recorded prior Reference Wallet behavior; full fresh run records are unavailable |
| Mock X.509 issuer → Reference Wallet → public Collab Verify | [21 October sanitized reports](evidence/README.md) | Valid and bad-signature outcomes observed; self-signed certificate does not prove production trust |
| Mock issuer → Reference Wallet → mock verifier | [22 October six-case matrix](../spikes/fixtures/wallet-interop-bff-2026-10-22.json) | Local mock protocol outcomes with exact reasons; source says dirty tree |
| HAR import and secret handling | Capture/redaction tests, audit, browser mock test | Synthetic canaries absent from stored/API/socket/browser projections; passive capture has unobservable boundaries |
| A1: actual Inji Web JSON-LD wallet | [A1 evidence](A1_WEB_EVIDENCE.md) | **Blocked**: no persistent account and authenticated Web/Mimoto target |
| A2: actual Inji mobile SD-JWT wallet | [A2 evidence](A2_MOBILE_EVIDENCE.md) | **Blocked**: no pinned installed build/device journey |
| A6: playground + mocks packaging | [CI run 27](https://github.com/oki-dokii/mosip/actions/runs/39901216659) and [deployment guide](../DEPLOYMENT.md) | Hosted clean-checkout Docker smoke passed; separate-machine human rehearsal and real local Inji profile remain open |

The [standalone aggregate report](evidence/2026-10-23-aggregate-interop.md) groups the committed run records and marks missing full-record cells `not_tested`. A passing mock or Reference Wallet result never closes A1/A2. All public fixtures use synthetic identities; keep actual `.env`, OTPs, private keys, full VCs, raw HAR and student IDs outside Git.

To repeat the ordinary checks, run `CI=true pnpm install --frozen-lockfile`, then `CI=true pnpm test`, `CI=true pnpm typecheck`, `CI=true pnpm build`, and `CI=true pnpm audit:secrets`. The browser suite additionally needs Playwright Chromium and starts four local services; see [README](../README.md#tests-and-evidence). Set `CAPTURE_POSTGRES_TEST_URL` only against a dedicated disposable test database to run the three opt-in checks.
