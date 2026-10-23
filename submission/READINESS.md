# Submission readiness — 2026-10-23 merged checkpoint

This folder is a separate submission handoff. It does not change application code or the four implementation workstreams. Refresh statuses and links before sending the final submission.

## Judge priorities

| Criterion | Weight | What we can show now | Main gap |
|---|---:|---|---|
| Functionality completion | 40% | Fixture and Reference Wallet flows, inspector, reports, scenarios, matrix and mock roles; hosted Docker mock smoke passed on merged `main` | A1/A2 need real Inji-wallet evidence; local Inji stack and independent-machine rehearsal remain open |
| Deliverable quality | 40% | Typed monorepo, 339 passing ordinary tests, three hosted Chromium checks, redaction, API and architecture notes | Three opt-in PostgreSQL tests and an independent-machine setup check remain |
| UX/design | 10% | Working React playground, assisted journey, keyboard/axe browser checks and four synthetic screenshots | Annotated final wireframes/screenshots for submission remain |
| Presentation | 10% | Narrative and demo outline in this folder | Actual slide deck and 2–5 minute video are still required |

## Mandatory submission items

| Item | Status | Evidence / next action | Can be done independently? |
|---|---|---|---|
| Complete source code | Present | [GitHub repository](https://github.com/oki-dokii/mosip), currently on `main`; verify judges can access the final URL | Yes, final access check |
| Working prototype/demo | Partial | Hosted [six-case Docker smoke](https://github.com/oki-dokii/mosip/actions/runs/39902817583) passed; rehearse an end-to-end presentation on another machine. Fixture and Reference Wallet evidence is not an all-Inji pass | Yes, rehearsal; real-wallet check remains externally blocked |
| Pitch slide deck | Missing | Build from [PITCH_AND_DEMO.md](PITCH_AND_DEMO.md), then export PDF as a backup | Yes |
| 2–5 minute video demo | Missing | Record the actual UI and verifier outcome using the script; check audio and playback | Yes, after a stable demo environment is ready |
| Installation instructions | Prepared, needs independent-machine rehearsal | [README.md](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md) cover startup. A [fresh clone on this Mac](CLEAN_CHECKOUT_REHEARSAL.md) passed install, test, build and audit; hosted clean-checkout Docker smoke passed. Another human/host should follow the guide | Yes |
| API documentation | Updated | [API_REFERENCE.md](API_REFERENCE.md) includes assisted routes, capture coverage and supported matrix cells | Yes, final review |
| Git version history | Present | The merged `main` history preserves commits under four contributor identities; do not squash or rewrite it | Yes, final access check |
| College/university IDs | Pending, private | Each student uploads their own valid ID through the required submission channel | Individual students only; never commit IDs |

## Supporting items worth submitting

| Item | Status | Evidence / next action |
|---|---|---|
| Architecture diagram | Prepared | [ARCHITECTURE.md](ARCHITECTURE.md); export an image/PDF for the deck if useful |
| Design mockups/wireframes | Prepared, final visual review open | [Annotated UI flow and synthetic screens](UI_WIREFRAMES.md) plus [UIUX.md](../UIUX.md); confirm the final demo build still matches them |
| Synthetic test data | Prepared | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) lists committed fixtures and data boundaries |
| Test cases and results | Updated | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) records 339 ordinary passing tests, three skipped database checks, three browser checks, and unresolved A1/A2 |
| License and credits | Partial | [MPL-2.0](../LICENSE) and [direct dependency credits](../ATTRIBUTIONS.md) added; confirm team agreement and complete transitive/asset notice audit |
| Fresh live report and matrix | Prepared for recorded mock combinations | [Aggregate report](evidence/2026-10-23-aggregate-interop.md) links 21 October Collab Verify and clean 23 October hosted mock run records with explicit untested cells; all-Inji wallet proof remains open |
| Interoperability gaps | Drafted | [GAPS.md](../GAPS.md) separates observed findings from upstream issues, none filed yet |
| Remaining integration plan | Prepared | [Four-person plan](../NEXT_STEPS_4_PERSON_PLAN.md) prioritizes local Inji integration, CI and independently reproduced findings |

## Release gates to verify before claiming completion

1. **A1:** Inji Certify → a logged-in Inji Web or mobile wallet → Inji Verify, JSON-LD, with observed storage, presentation, and `Valid` result. A dedicated persistent Inji Web test account is not yet available.
2. **A2:** The same all-Inji path with SD-JWT and a pinned capable Inji mobile wallet build. Inji Web currently does not offer SD-JWT OpenID4VP presentation. A Reference Wallet pass does not close this gate.
3. **A6:** `pnpm demo:docker` builds the playground, BFF, PostgreSQL and separate mocks for six synthetic presets. [Hosted CI](https://github.com/oki-dokii/mosip/actions/runs/39902817583) passed both HTTP smoke and six-case Docker matrix. A [fresh same-host clone](CLEAN_CHECKOUT_REHEARSAL.md) passed install/tests/build but could not rerun Docker because port 4000 is occupied. Run the exact demo on a separate clean machine before final sign-off. The bundle does not complete local Inji services.
4. **A3/A5:** Inspect the final browser capture and exported report for missing boundaries and any secret leakage. Passive HAR import is synthetic-only and cannot see server-to-server or native-wallet exchanges.
5. **Go/no-go:** use [WALLET_VALIDATION.md](../WALLET_VALIDATION.md)'s provisional 2026-10-24 21:00 IST A1/A2 cutoff, 48 hours before the working freeze; adjust when the official deadline is known.
6. **Release quality:** Three Chromium checks passed locally and in hosted CI with keyboard/axe assertions. The secret audit is in hosted CI. Independent-machine installation, contributor license confirmation and a complete third-party notice audit remain. [Annotated UI screens](UI_WIREFRAMES.md) are prepared. Splitting `collab.ts` is post-integration maintenance, not an acceptance gate.

## Final handoff outside Git

- Put the actual deck, video, any design images, and safe test-case exports in cloud storage with reviewer access. Keep credentials, private keys, OTPs, real HAR files, and student IDs out of the public repository and demo recording.
- Confirm repository and cloud links in a private/incognito browser.
- The team sends the final email to `decode@mosip.io` with team name, problem statement, and URLs. This folder is preparation; it does not send or submit anything.
