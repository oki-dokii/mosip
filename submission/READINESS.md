# Submission readiness — 2026-10-21

This folder is a separate submission handoff. It does not change application code or the four implementation workstreams. Refresh statuses and links before sending the final submission.

## Judge priorities

| Criterion | Weight | What we can show now | Main gap |
|---|---:|---|---|
| Functionality completion | 40% | Fixture and Reference Wallet flows, inspector, reports, scenarios, matrix, and mock roles; one-command playground/mocks bundle passed local smoke | A1/A2 need real Inji-wallet evidence; local Inji stack and clean-machine rehearsal remain open |
| Deliverable quality | 40% | Typed monorepo, unit/contract tests, separate drivers, redaction, API and architecture notes | Clean-machine setup and automated browser smoke still need proof |
| UX/design | 10% | Working React playground, role selection, timeline, inspector, history, and evidence labels | Test accessibility and capture finished-screen screenshots/wireframes |
| Presentation | 10% | Narrative and demo outline in this folder | Actual slide deck and 2–5 minute video are still required |

## Mandatory submission items

| Item | Status | Evidence / next action | Can be done independently? |
|---|---|---|---|
| Complete source code | Present | [GitHub repository](https://github.com/oki-dokii/mosip), currently on `main`; verify judges can access the final URL | Yes, final access check |
| Working prototype/demo | Partial | Local fixture UI and Reference Wallet flow exist. Rehearse on a clean machine and record a stable fallback demo. Do not label fixture or Reference Wallet as an all-Inji pass | Yes, rehearsal; real-wallet check remains with owners |
| Pitch slide deck | Missing | Build from [PITCH_AND_DEMO.md](PITCH_AND_DEMO.md), then export PDF as a backup | Yes |
| 2–5 minute video demo | Missing | Record the actual UI and verifier outcome using the script; check audio and playback | Yes, after a stable demo environment is ready |
| Installation instructions | Prepared, needs independent rehearsal | [README.md](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md) cover host and container startup. `pnpm demo:docker` passed locally; Corepack resolved pinned `11.25.0`. A separate clean-machine check remains | Yes |
| API documentation | Prepared | [API_REFERENCE.md](API_REFERENCE.md) lists current BFF endpoints; compare with the final build | Yes |
| Git version history | Partial | Main has incremental commits, but the current log shows one author. Preserve each new contributor's identity using their own sequential commits or `git format-patch` + `git am`; do not squash/rewrite | Yes, integrator coordination |
| College/university IDs | Pending, private | Each student uploads their own valid ID through the required submission channel | Individual students only; never commit IDs |

## Supporting items worth submitting

| Item | Status | Evidence / next action |
|---|---|---|
| Architecture diagram | Prepared | [ARCHITECTURE.md](ARCHITECTURE.md); export an image/PDF for the deck if useful |
| Design mockups/wireframes | Partial | [UIUX.md](../UIUX.md) describes behavior; capture current UI and add final annotated screenshots or wireframes |
| Synthetic test data | Prepared | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) lists committed fixtures and data boundaries |
| Test cases and results | Prepared | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) records the current automated checks and unresolved acceptance cases |
| License and credits | Partial | [MPL-2.0](../LICENSE) and [direct dependency credits](../ATTRIBUTIONS.md) added; confirm team agreement and complete transitive/asset notice audit |
| Fresh live report and matrix | Prepared for one combination | [2026-10-21 evidence](evidence/README.md) contains exported mock X.509 issuer → Reference Wallet → Collab Verify positive/negative runs; all-Inji wallet proof remains open |
| Interoperability gaps | Drafted | [GAPS.md](../GAPS.md) separates observed findings from upstream issues, none filed yet |
| Competitive catch-up | Prepared | [CATCH_UP.md](../CATCH_UP.md) prioritizes local Inji integration, CI, and independent reproduction; rival README claims are not counted as our evidence |

## Release gates to verify before claiming completion

1. **A1:** Inji Certify → a logged-in Inji Web or mobile wallet → Inji Verify, JSON-LD, with observed storage, presentation, and `Valid` result. A dedicated persistent Inji Web test account is not yet available.
2. **A2:** The same all-Inji path with SD-JWT and a pinned capable Inji mobile wallet build. Inji Web currently does not offer SD-JWT OpenID4VP presentation. A Reference Wallet pass does not close this gate.
3. **A6:** `pnpm demo:docker` built the playground, BFF, PostgreSQL, and separate mocks and printed `DEMO PASS` locally on 2026-10-21. A two-cell synthetic mock matrix passed locally and in [hosted CI](https://github.com/oki-dokii/mosip/actions/runs/39632729703). Run the same command on a separate clean machine before final sign-off. This bundle does not include local Inji services.
4. **A3/A5:** Inspect the final browser capture and exported report for missing boundaries and any secret leakage. Passive HAR import is synthetic-only and cannot see server-to-server or native-wallet exchanges.
5. **Go/no-go:** use [WALLET_VALIDATION.md](../WALLET_VALIDATION.md)'s provisional 2026-10-24 21:00 IST A1/A2 cutoff, 48 hours before the working freeze; adjust when the official deadline is known.
6. **Release quality:** Person 2 owns accessibility, keyboard/contrast review, browser smoke, and annotated screenshots; Person 4 owns the clean-machine Corepack/pnpm install and tracked-file secret audit. The integrator owns the later `collab.ts` split, contributor license confirmation, and complete notice audit.

## Final handoff outside Git

- Put the actual deck, video, any design images, and safe test-case exports in cloud storage with reviewer access. Keep credentials, private keys, OTPs, real HAR files, and student IDs out of the public repository and demo recording.
- Confirm repository and cloud links in a private/incognito browser.
- The team sends the final email to `decode@mosip.io` with team name, problem statement, and URLs. This folder is preparation; it does not send or submit anything.
