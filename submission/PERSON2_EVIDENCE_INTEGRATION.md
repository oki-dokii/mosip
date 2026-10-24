# Real-wallet evidence integration — 24 October 2026

The playground now exposes the recorded A1 Web JSON-LD and A2 Android SD-JWT successes in an evidence catalog, compatibility view and downloadable reports. These are curated manual observations of named credentials/deployments. They are not reconstructed managed runs, protocol captures or general conformance claims.

## Product behavior

- The **Observed real-wallet compatibility** panel shows actual wallet identity, observed Valid outcome and its source, date, versions, deployment, checkpoint provenance, review status and limits. A2 persistence remains explicitly user-confirmed; A1 integrator review remains pending.
- Source artifacts link to pinned Git commits. The backend contains only the reviewed public summary and immutable links; login state, credentials and HAR files are not imported. The source images remain in the repository, so container images need no broad inclusion of submission files.
- JSON, Markdown and CSV evidence reports work even with an empty runtime database. No fake run/step/exchange IDs or database migration is introduced.
- Supported Web matrix cells link to the manual observation separately. A cell with no managed run still says `not_tested`; a failed run stays failed. Android observations remain Android, never Reference Wallet or Inji Web.
- Matrix JSON and Markdown exports include manual observations; CSV appends separately labeled observation rows with an empty run ID. Existing run columns retain their order; additional provenance columns identify record kind, evidence ID, outcome source and validation limits.
- A matching Web run report can link related manual observations, explicitly stating that they are not evidence for that run. A Reference Wallet or negative-test report receives no such association. Automated evidence tiers and verdicts are unchanged.
- Stale account-unavailable and real-wallet-unobserved product text has been corrected.

## API

- `GET /api/v1/wallet-evidence`: versioned catalog of source-backed manual observations.
- `GET /api/v1/wallet-evidence/report?format=json|md|csv`: self-contained evidence reports.
- `GET /api/v1/matrix` and JSON export: existing `items` plus separate `walletEvidence`.
- `GET /api/v1/matrix/cells`: existing managed status plus `manualEvidenceIds` on matching Web cells.
- `GET /api/v1/runs/:id/report`: existing report plus `relatedWalletEvidence`; never overrides run outcome/tier.

The catalog is curated source code in `apps/bff/src/walletEvidence.ts`; it has no upload/edit endpoint. Adding observations requires reviewing public facts, source artifacts and provenance in a code review. Existing shared schemas and capture internals were not changed for this integration.

## Remaining live validation

This fixes presentation of successful real-wallet evidence in the product and exports. It does not retroactively create a managed-run capture chain. Person 1's hosted-route bridge is now available on main; a fresh managed trial, exact issuer/profile confirmation and integrator A1 sign-off are still separate acceptance work. Reports expose these limits rather than treating the catalog as a completed managed trial.

Validation: full unit/API/contract suite, typecheck, production build, secret audit and aggregate-report consistency passed. Four Chromium browser tests passed, including the catalog/report/matrix flow. Scoped catalog axe checks reported zero violations; see `submission/evidence/person2/wallet-evidence-catalog.png` and `wallet-evidence-accessibility.json`. Optional database tests retain their opt-in requirement.
