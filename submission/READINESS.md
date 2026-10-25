# Submission readiness — 2026-10-25 working checkpoint

This folder is the submission handoff. Refresh statuses and links before sending the final submission. The A1 capture and journey code now have [one integration owner](../docs/SINGLE_OWNER_HANDOFF.md); older person-specific handoffs are historical.

## Judge priorities

| Criterion | Weight | What we can show now | Main gap |
|---|---:|---|---|
| Functionality completion | 40% | Fixture and Reference Wallet flows, inspector, reports, scenarios, matrix and mock roles; manual Web and Android wallet successes; hosted Docker mock smoke; separate locally passing official Certify/Verify control | A1 final review, local Mimoto/Inji Web and independent-machine rehearsal remain open |
| Deliverable quality | 40% | Typed monorepo, historical 339-test ordinary checkpoint plus three separately passing PostgreSQL checks, three hosted Chromium checks, redaction, API and architecture notes; current BFF suite passed 199 tests with three opt-in DB skips on 24 October | Full-repo retest at final commit and independent-machine setup remain |
| UX/design | 10% | Working React playground, assisted journey, keyboard/axe browser checks and annotated synthetic screens | Review final build against screenshots and capture final screens |
| Presentation | 10% | Narrative and demo outline in this folder | Actual slide deck and 2–5 minute video are still required |

## Mandatory submission items

| Item | Status | Evidence / next action | Can be done independently? |
|---|---|---|---|
| Complete source code | Present | [GitHub repository](https://github.com/oki-dokii/mosip), currently on `main`; verify judges can access the final URL | Yes, final access check |
| Working prototype/demo | Working; final human rehearsal open | [25 October local six-case Compose demo](evidence/2026-10-25-local-demo.md) passed and exposes the labelled, read-only managed A1 archive; hosted browser and Compose CI also passed. Rehearse on another machine | Yes, independent-machine rehearsal and final team review of A1 |
| Pitch slide deck | Draft ready for team review | [Editable six-slide deck](pitch/Interoperability_Playground_Pitch.pptx) covers the required story and cites recorded evidence in speaker notes; confirm team name and export a PDF backup if needed | Yes |
| 2–5 minute video demo | Silent draft ready | [2:07 synthetic-only walkthrough](pitch/VIDEO_README.md) covers a fresh mock run, archived A1, matrix and gaps; add human narration and verify final playback | Yes, voiceover and review |
| Installation instructions | Prepared, needs independent-machine rehearsal | [README.md](../README.md) and [DEPLOYMENT.md](../docs/DEPLOYMENT.md) cover startup. A [fresh clone on this Mac](CLEAN_CHECKOUT_REHEARSAL.md) passed install, test, build and audit; hosted clean-checkout Docker smoke passed. Another human/host should follow the guide | Yes |
| API documentation | Updated | [API_REFERENCE.md](API_REFERENCE.md) includes assisted routes, capture coverage and supported matrix cells | Yes, final review |
| Git version history | Present | The merged `main` history preserves commits under four contributor identities; do not squash or rewrite it | Yes, final access check |
| College/university IDs | Pending, private | Each student uploads their own valid ID through the required submission channel | Individual students only; never commit IDs |

## Supporting items worth submitting

| Item | Status | Evidence / next action |
|---|---|---|
| Architecture diagram | Prepared | [ARCHITECTURE.md](ARCHITECTURE.md); export an image/PDF for the deck if useful |
| Design mockups/wireframes | Prepared, final visual review open | [Annotated UI flow and synthetic screens](UI_WIREFRAMES.md) plus [UIUX.md](../docs/UIUX.md); confirm the final demo build still matches them |
| Synthetic test data | Prepared | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) lists committed fixtures and data boundaries |
| Test cases and results | Updated, final refresh pending | [TEST_EVIDENCE.md](TEST_EVIDENCE.md) separates historical full-suite results, the 25 October BFF/web regressions, manual A1 evidence and [actual A2 acceptance](evidence/person3-a2-mobile-2026-10-23/README.md) |
| License and credits | Partial | [MPL-2.0](../LICENSE) and [direct dependency credits](../docs/ATTRIBUTIONS.md) added; confirm team agreement and complete transitive/asset notice audit |
| Fresh live report and matrix | Managed A1 record added; aggregate refresh pending | [Managed A1 report and reviewed matrix](evidence/person2-managed-a1-2026-10-25/README.md) link the correlated Web run; the older [aggregate report](evidence/2026-10-23-aggregate-interop.md) predates A1 and must be regenerated before final submission |
| Interoperability gaps | Drafted | [GAPS.md](../docs/GAPS.md) separates observed findings from upstream issues, none filed yet |
| Remaining integration plan | Prepared | [Four-person plan](../docs/NEXT_STEPS_4_PERSON_PLAN.md) prioritizes local Inji integration, CI and independently reproduced findings |

## Release gates to verify before claiming completion

1. **A1:** A dedicated signed-in Inji Web account completed a [manual JSON-LD Land Registry journey](A1_WEB_EVIDENCE.md): storage survived refresh, presentation completed and the Verify UI displayed `Valid`. Fresh managed run `3dc6895d-ff87-45a2-a10b-46844198d83e` records correlated capture, storage confirmation, independent Verify `valid` and [sanitized reports](evidence/person2-managed-a1-2026-10-25/README.md). The Compose demo exposes its committed export read-only under that same ID. Final team review remains pending. The account is available to its operator; do not ask for credentials in chat.
2. **A2: observed functional pass, 23 October.** Official local Certify → actual Android Inji Wallet → Collab Verify, with user-confirmed reopen persistence and correlated valid credential/holder proof result. [Evidence and limits](evidence/person3-a2-mobile-2026-10-23/README.md) distinguish installed-binary/Collab-version uncertainty from the observed chain. Inji Web SD-JWT and A1 JSON-LD remain separate.
3. **A6:** `pnpm demo:docker` builds the playground, BFF, PostgreSQL and separate mocks for six synthetic presets. [Hosted CI](https://github.com/oki-dokii/mosip/actions/runs/40167968420) passed typecheck, tests, browser/axe and Compose smoke. The [25 October local Docker rehearsal](evidence/2026-10-25-local-demo.md) printed `DEMO PASS` for all six cases and exposed the archived A1 run. Separately, `pnpm demo:inji` locally passed official Certify → reference holder → official Verify; [scope and pins](../deploy/INJI_LOCAL.md). Run both on a separate clean machine before final sign-off. Neither command runs a local real Inji wallet.
4. **A3/A5:** Inspect the final browser capture and exported report for missing boundaries and any secret leakage. Passive HAR import is synthetic-only and cannot see server-to-server or native-wallet exchanges.
5. **Go/no-go:** [WALLET_VALIDATION.md](../docs/WALLET_VALIDATION.md) lists a provisional 2026-10-24 21:00 IST A1 cutoff, 48 hours before the working freeze. Confirm the actual competition deadline; do not present this planning date as official.
6. **Release quality:** Three Chromium checks passed locally and in hosted CI with keyboard/axe assertions. The secret audit is in hosted CI. Independent-machine installation, contributor license confirmation and a complete third-party notice audit remain. [Annotated UI screens](UI_WIREFRAMES.md) are prepared. Splitting `collab.ts` is post-integration maintenance, not an acceptance gate.

## Final handoff outside Git

- Put the [draft deck](pitch/Interoperability_Playground_Pitch.pptx), [silent video draft](pitch/VIDEO_README.md) after adding voiceover, any design images, and safe test-case exports in cloud storage with reviewer access. **No final narrated video or cloud URL is present in this repository yet.** Keep credentials, private keys, OTPs, real HAR files, and student IDs out of the public repository and demo recording.
- Confirm repository and cloud links in a private/incognito browser.
- The team sends the final email to `decode@mosip.io` with team name, problem statement, and URLs. This folder is preparation; it does not send or submit anything.

| Final email field / linked artifact | Current state |
|---|---|
| Team name and member list | Supply from the team; not recorded here |
| Problem statement | Interoperability Playground for Verifiable Credentials |
| Source repository URL | [oki-dokii/mosip](https://github.com/oki-dokii/mosip); verify public reviewer access at submission time |
| Working prototype/demo URL or reproducible install | README and Docker mock demo documented; final demo URL/rehearsal not recorded |
| Deck PDF and video URL | Editable deck and silent video draft committed; PDF backup, final narration and cloud URL pending |
| Optional mockups, test exports, architecture images | Repository sources exist; link selected exports from the cloud folder if required |
| Individual college IDs | Each student submits privately through the required channel; never add them to this public package |
| Official deadline and final email sent | Unconfirmed; team must verify and retain the sent email |
