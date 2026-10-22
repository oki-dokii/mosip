# Person B / Person 2 — Phase 2 handoff

Branch: `codex/person-b-phase-1`. This deliverable completes the independently available capture UI and QA work. Live assisted integration and A1 remain blocked; do not describe Phase 2 as fully signed off.

## Implemented

- Inspector renders validated v1 public protocol summaries for request/response, `not_verified`, projection counters, capture rule/reason, redaction counts and unknown timing. Empty unsupported projections explain `Format not decoded`. Existing sanitized JSON is a collapsible detail view; no browser credential/token decoder was added.
- A run's capture panel uploads a bounded synthetic JSON envelope to the existing capture endpoint. It checks the explicit run ID, clears the file input, handles rejection without echoing bodies, and uses the server's returned coverage/projection totals. No coverage states are inferred in the browser. Coverage is session-only because no read contract exists; reload/history explicitly says unavailable.
- Coverage distinguishes observed traffic, missing traffic and non-observable internal operations using text and neutral styling for gaps. It never marks wallet storage or validity from endpoint access.
- Capture import refreshes exchanges through the existing API. Stale responses from another selected run are ignored. History has keyboard-operable run-opening buttons.
- Added public-view/coverage component tests and a Playwright browser command for the independent mock journey, synthetic capture import/API/DOM checks, keyboard-assisted fixture journey, axe and color-contrast checks, and screenshots. Tests/configuration are under `apps/web`; Person 4 can wire the command into CI.
- Prepared the dedicated-account A1 checklist in `submission/A1_WEB_EVIDENCE.md`.

## Integration dependencies that still prevent live completion

| Owner | Required change / dependency | Current evidence |
|---|---|---|
| Integrator | Register assisted driver with run/step IDs, observation source and abort signal | Registry still resolves existing fixture/Collab drivers; UI intentionally never calls these as a live assisted wallet |
| Integrator | Assisted start, status and cancellation routes; preserve timeout/cancel reasons | No cancellation endpoint; generic orchestrator collapses thrown errors |
| Person 1 + integrator | Active-run observation ingress and authoritative coverage read contract | Current HAR endpoint rejects pending/running runs (`CAPTURE_RUN_ACTIVE`), so it cannot unblock a wallet driver waiting inside an active run; coverage is import-response-only |
| Person 1 + integrator | Storage-confirmation provenance and normalized verifier-result input | Browser capture cannot establish persistent wallet storage; decoded metadata is not proof validity |
| Person 4 | Canonical pinned Web/Mimoto, Certify, Verify endpoints and dedicated account | Not supplied; live A1 remains blocked |
| Integrator | Explicit matrix `not_tested` response contract | Current matrix returns `RunSummary[]`; no unsupported inferred grid was added |

These seams are recorded rather than implemented in another owner's files. No capture internals, shared schemas, orchestration, matrix backend, mocks, Compose or CI files were edited. The injectable assisted driver and fixture state machine retain their Phase 1 tests. No raw wallet credentials are accepted by them.

## Reproduce QA

Run `pnpm install --frozen-lockfile`, `pnpm --filter @playground/web exec playwright install chromium`, then `pnpm --filter @playground/web test:browser`. The browser config starts isolated local mock issuer/verifier, in-memory BFF and Vite on ports 4101/4102/4000/5173; it refuses to reuse existing servers. Stop existing services first. Browser artifacts go to `/tmp/person2-playwright-results`; curated synthetic screenshots and axe results go to `submission/evidence/person2/`. Do not run against real accounts.

The browser smoke uses local independent mock services with Reference Wallet for the automated positive control. The assisted journey is explicitly fixture evidence, and the imported HAR is synthetic. This is not a real Inji Web run. `pnpm test`, `pnpm typecheck`, `pnpm build` and `pnpm audit:secrets` remain the general checks; database-specific tests retain their existing opt-in requirement.

## Proposed integrator contract (not an implemented API)

The start seam should return the existing run ID and step IDs plus transient `walletUrl`, `offerUrl`, `presentationUrl` and server deadline. Redacted exchanges continue through the existing exchange API/socket channel with their original browser actors. The source needs an authoritative snapshot plus subscription so reconnects can replay/deduplicate evidence. Store explicit storage confirmation with its issuance exchange ID and provenance separately from capture. A normalized verifier result must correlate to the same transaction; never infer it from `passed` on a generic fixture run or a direct-post HTTP 200.

Use an idempotent cancel operation wired to the per-run abort signal; late events must not reactivate cancelled/timed-out runs. Existing `RunStatus.cancelled` and step summary reason codes can represent this without changing the frozen Exchange schema. Timeout should remain an execution/observation error with its reason, not `invalid`. Coverage needs an authoritative read response for reload/history. Until those owner-applied seams exist, the live-start gate must remain closed.

## Recorded validation, 23 October 2026

- `pnpm test`: passed (47 web tests, 115 BFF tests, shared/mock/script suites; two database-dependent BFF tests skipped).
- `pnpm --filter @playground/web test:browser`: two Chromium tests passed against independent local mocks plus the assisted fixture and synthetic capture variant.
- Scoped axe/contrast scans: zero violations for the assisted panel and added capture/public-evidence sections. Keyboard wallet-action navigation and fixture completion passed.
- `pnpm typecheck`, `pnpm build`, `pnpm audit:secrets`, `git diff --check`: passed.
- Screenshots inspected and captioned in `submission/evidence/person2/README.md`; the countdown refresh fix also has a component regression assertion.

These results establish the available UI/capture/fixture slice. They do not close active-run capture integration, API cancellation, A1 or the pending matrix contract.
