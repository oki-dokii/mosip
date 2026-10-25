# Person 2 Phase 3 — independent UI work

Implemented locally on 26 October 2026 at the user's explicit reprioritization. This work does not assert that the local P0 wallet journey or Phase 2 has passed. The user subsequently authorized committing and pushing this Phase 3 change to `main`.

## Delivered

- Extended `Inspector` and `PublicEvidence` with readable, allowlisted public structure. Claim/disclosure names, credential/proof types, supported algorithms, safe DCQL paths and presentation-definition field shapes come exclusively from Person 1's `publicView` v1 projection. Arbitrary summary fields and raw bodies are not rendered, including expandable details. No JWT/credential decoding is performed in the browser. A withheld segment suppresses the whole path.
- Added two-run comparison beside the existing archive. Existing run, steps and exchanges endpoints supply configuration, all three service versions, protocol profile, record provenance, recorded step outcomes and expected/actual normalized verifier verdicts. Sanitized structure is displayed side by side, with withholding/truncation counts and authenticity warnings. Missing fields and differences in profiles/versions are explicit. Cross-run step/exchange records are excluded; a mismatched run response fails closed. Selection changes discard obsolete responses; failed reads use generic errors and offer retry without echoing API error bodies.
- Extended the existing history/latest-matrix controls with comparison selectors and a share link. History/latest-record table filters, selected run and comparison IDs restore after reload and browser back/forward. Empty selections, identical comparison IDs, no matches, absent projections and denied/missing runs have explicit states.
- Preserved existing shared evidence-tier labels, archived/manual evidence distinctions, the separate real-wallet observation panel and the server-reported supported-combinations matrix. Neither UI comparison nor filtering changes backend aggregation or compatibility conclusions.

## URL and data boundary

Only these query fields are serialized: `view`, `run`, `compareA`, `compareB`, `issuer`, `wallet`, `verifier`, `format`, `status`, `issuerVersion`, `verifierVersion`.

Run IDs must have UUID syntax. Filters use existing enum allowlists; version filters must occur in the authorized archive's service-version registry. Duplicate fields, unknown enums, malformed IDs, arbitrary versions, unknown parameters and fragments are removed. Initial version candidates remain only in React memory while the archive loads; they are not shared until validated. The share link contains no exchange bodies or arbitrary query fields. No browser storage is used for this state. Existing same-origin APIs and their access decisions are reused; possession of a link grants no new access. URL cleanup cannot erase a URL someone already pasted from their browser's prior navigation history; the application never generates sensitive fields.

Tests use synthetic records and canaries. No real credentials, authentication state, raw HAR, network traces or wallet session artifacts are required or written.

## Integrator contract requests / remaining limits

1. **Explicit recorded deployment provenance:** current `RunSummary` exposes wallet role, `recordKind`, versions and `protocolProfile`; shared `evidenceTier` distinguishes fixture/mock/Reference Wallet/unverified. It does not provide an authoritative hosted-Web/local-Web/Android deployment discriminator. The manual-wallet evidence catalog has a deployment description but is a separate contract. Please settle how recorded runs reference that provenance, including unknown/not-tested states. The UI preserves existing labels, describes HTTP origins only as observations, and never promotes loopback traffic to proof of a local wallet journey or merges Android manual observations into managed Web runs. This requires an integrator contract decision, not an invented frontend/shared schema.
2. **JSON-LD subject structure:** Person 1's `verifiable_credential` public projection currently includes `types`, `issuer` and `proofTypes`, but no credential-subject claim-name list. JSON-LD inspection therefore shows available type/proof structure and explicitly says subject names are unavailable. If subject-name inspection is required, Person 1 must publish an allowlisted, count-bearing name/path projection with withholding semantics. The UI will not recover names from sanitized/raw bodies.
3. The public vocabulary in `apps/web/src/lib/publicStructure.ts` mirrors the existing publisher in `apps/bff/src/capture/public-view.ts`. Expand it only with a reviewed publisher-contract change. Projected verification flags are never treated as the normalized verifier verdict.
4. No Phase 2 issuance/storage/presentation result is fabricated. When actual local runs become available through existing endpoints, the comparison and deep links can consume them; the provenance limitation above still applies.

## Files

- UI: `apps/web/src/App.tsx`, `components/Inspector.tsx`, `components/PublicEvidence.tsx`, `components/RunArchive.tsx`, new `components/RunComparison.tsx`.
- Helpers: new `apps/web/src/lib/publicStructure.ts`, `lib/archiveLocation.ts`.
- Tests: updated `apps/web/src/App.test.tsx`; new `components/StructurePrivacy.test.tsx`, `components/RunComparison.test.tsx`, `lib/archiveLocation.test.tsx`, `apps/web/browser/phase3.pw.ts`.
- This handoff. No BFF, shared-schema, capture, staging, Compose or root package changes.

## Validation commands

Run from the repository root:

```sh
pnpm --filter @playground/web test
pnpm --filter @playground/web build
PLAYGROUND_BROWSER_ISSUER_PORT=4501 PLAYGROUND_BROWSER_VERIFIER_PORT=4502 PLAYGROUND_BROWSER_BFF_PORT=4500 PLAYGROUND_BROWSER_WEB_PORT=5175 pnpm --filter @playground/web exec playwright test browser/phase3.pw.ts
node scripts/audit-secrets.mjs
git diff --check
```

The focused browser suite uses isolated local fixture services and intercepted synthetic run records, without Docker or Collab. It covers comparison/profile/step differences, selected-run and filter restoration, reload/back/forward, withholding and value canaries, rejected URLs, empty archives, denied reads and suppression of stale results. Test output is under `/tmp/person2-playwright-results`, without authentication state or raw captures. Browser server startup needs local listener permission; it fails with `listen EPERM` in a sandbox that denies IPC/listeners.

Validation completed: **80 unit/UI tests and 5 browser tests passed**; production build/typecheck, secret audit and whitespace checks passed. One browser test also exercises the real local BFF's existing synthetic assisted journey through completion and direct-URL reload, without representing a real wallet run.
