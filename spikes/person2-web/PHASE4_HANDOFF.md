# Person 2 Phase 4 — accessibility and integration handoff

26 October 2026. Base commit: `581f6a4`. Implemented locally; the user subsequently authorized committing and pushing Phase 4 to `main`. No new branch, CI edit or team acceptance. **UI checks pass; local P0 acceptance and a manual screen-reader test remain blocked/not tested.**

## Review of previous phases against this checkout

| Phase / handoff | Current code and acceptance result |
| --- | --- |
| Phase 1: `spikes/person2-web/PHASE1_HANDOFF.md` | Catalog/profile, strict local-origin guards, reusable login/unlock/selection/refresh helpers and separate opt-in config exist. Offline helpers pass. The template is disabled; `prepare-inji-web-local.mjs` still generates an empty catalog. This proves preparation, not local issuance/presentation. |
| Phase 2: `submission/PERSON_B_PHASE2_HANDOFF.md` | This is the older hosted/fixture integration handoff, not a completed handoff for the newer local P0 phase. Connected fixture start, checkpoints, completion, cancellation and reload pass the local BFF browser tests. The historical managed hosted export exists, but does not prove the all-local path. No complete new local issue → refresh → present acceptance command exists yet. |
| Phase 3: `spikes/person2-web/PHASE3_HANDOFF.md` | Claim-name/structure allowlisting, two-run comparison and URL restoration are present; their privacy/navigation regressions pass. JSON-LD subject names are still absent from Person 1's projection. `RunSummary` still lacks authoritative hosted/local/Android deployment provenance; existing evidence tiers are preserved. |

## Corrections and coverage

- Added a skip link; visible dual-color focus outlines for links, selects, summaries and controls; selected-state semantics for formats, timeline, messages and archive view buttons; named keyboard-scrollable regions and table headers/caption.
- Selecting a run focuses its heading, browser back can restore the archive opener, and removed assisted/retry controls recover focus to their region heading without stealing focus from a surviving or outside control. No hardcoded scroll coordinate; reduced-motion preferences select instant scrolling.
- Added concise status announcements for protocol steps, loading/configuration errors, comparison, coverage reads/imports and clipboard success/failure. Countdown timers do not announce every tick. Replay failures now report a generic error.
- Corrected light-label and role-color contrast, added the missing failure color, and removed the low-contrast opacity fade when a control becomes enabled. Notices sit on a solid canvas rather than a decorative gradient. Reduced motion disables animations/transitions and hover translation.
- Contained table and comparison overflow; no page overflow at 320, 390, 768 or 1440 CSS-pixel viewports. Keyboard horizontal table scrolling is tested. This is viewport reflow testing, not a physical-device or manual browser-zoom certification.
- Full-page axe checks cover configuration loading/error; initial and filtered-empty views; inspector/history/matrix/comparison; matrix loading/error; run pending/running/passed/failed/errored/cancelled; both assisted UIs' issuance/storage/presentation/result waits and terminal states; denied reads and archive/catalog errors. Existing smoke also checks the populated manual Web/Android catalog and synthetic capture. The contrast run includes WCAG 2 A/AA, 2.1 AA and best-practice rules.

Keyboard and Playwright accessibility-tree assertions are **automated checks, not a manual VoiceOver/NVDA test**. A manual screen-reader pass is `not_tested`; no WCAG certification or team acceptance is asserted.

## Reproduce / Person 4 CI handoff

Tested runtime: Node `24.4.1`, pnpm `11.25.0`, repository-pinned Playwright/Chromium and axe. Install locked dependencies and Chromium before these commands. From repository root:

```sh
pnpm --filter @playground/web test
pnpm --filter @playground/web exec tsc -p tsconfig.browser.json --pretty false
pnpm --filter @playground/web typecheck
pnpm --filter @playground/web build
PLAYGROUND_BROWSER_ISSUER_PORT=4501 PLAYGROUND_BROWSER_VERIFIER_PORT=4502 PLAYGROUND_BROWSER_BFF_PORT=4500 PLAYGROUND_BROWSER_WEB_PORT=5175 PERSON2_SYNTHETIC_EVIDENCE_DIR=/tmp/person2-phase4-legacy-evidence pnpm --filter @playground/web exec playwright test browser/assisted.pw.ts browser/phase3.pw.ts browser/phase4.pw.ts
pnpm --filter @playground/web exec playwright test --config playwright.local.config.ts
node apps/web/scripts/check-phase4-evidence.mjs
node scripts/audit-secrets.mjs
git diff --check
```

Results: **83 unit/UI tests passed; 15 default browser tests passed; 5 offline local-helper browser tests passed and 1 live-shell test explicitly skipped; browser TypeScript, Web typecheck/build and privacy/whitespace checks passed.** The 31 synthetic full-page axe snapshots have zero reported violations; reports retain any incomplete checks rather than treating them as passes. Keyboard/tree and motion results are separate JSON summaries.

The mobile filtered comparison retains incomplete contrast checks for columns clipped inside horizontal scroll areas. Full desktop tables have no incomplete contrast checks, and mobile keyboard scrolling is verified. Clipped checks are not counted as contrast passes.

CI environment contract: four unused loopback ports as above; one worker, in-memory BFF, independent mock services and Vite started by the existing Playwright config. No Docker, Collab, persistent account, production secrets or auth state is required for these commands. `PERSON2_LOCAL_LIVE` stays unset in this fixture job. The optional `PERSON2_SYNTHETIC_EVIDENCE_DIR` redirects legacy smoke screenshots/axe files out of the historical submission directory. No CI files were changed; Person 4 owns installing/wiring/scheduling the commands.

Artifact rules: Phase 4 writes only synthetic, bounded rule IDs/counts/selectors, keyboard/motion assertions and dependency readiness metadata under `spikes/person2-web/evidence/phase4/`. It does not save DOM/axe node HTML, raw payloads or full accessibility-tree dumps. Automatic traces/videos/screenshots and service workers are disabled. Legacy smoke explicitly creates synthetic-only screenshots under the configured `/tmp` directory. Upload only these reviewed synthetic outputs; do not upload entire browser output/runtime folders. Real-wallet tests remain separate, with no auth persistence, trace, screenshots, videos, raw HAR or credential-bearing artifacts in Git, chat or CI uploads. Do not enable Playwright debug/trace collection for a real wallet session.

## Evidence, run IDs and blockers

- New sanitized checks: `spikes/person2-web/evidence/phase4/*.json`; `navigation-checks.json`, `focus-motion-checks.json`, `local-readiness.json` and `privacy-checks.json` distinguish check types. Logs and legacy synthetic screenshots are external `/tmp/person2-phase4-*` outputs, not committed evidence changes.
- Comparison fixture IDs `11111111-1111-4111-8111-111111111111` and `22222222-2222-4222-8222-222222222222` are **synthetic**, not wallet acceptance runs. BFF fixture runs created during tests are ephemeral and do not establish A1. No new real-wallet run ID was produced.
- Historical hosted managed run `3dc6895d-ff87-45a2-a10b-46844198d83e` remains under `submission/evidence/person2-managed-a1-2026-10-25/` (`run.json`, `steps.json`, `exchanges.json`, coverage and reports). Its recorded outcome is `valid`; it was not repeated here. Its wallet role is `inji_web_assisted` but its recorded wallet version is `reference-wallet/0.1.0`. **Integrator must review/correct that provenance metadata; it is not an observed Inji Web release version.** Historical records and tiers were not altered.
- Readiness probe outside sandbox restrictions: published ports 18093/18099/18095/18090/18081 are unavailable, Docker's daemon socket is absent, and the configured/default external synthetic passcode file is missing. The live shell check was therefore not forced. A hosted account does not provision the missing local stack.
- Person 4: provision the joined JSON-LD catalog/client/trust/key services and publish working browser/container endpoint/version bindings. Person 1: finish the canonical local server-hop forwarding/correlation contract (`CaptureHub` is still a non-forwarding prototype in this checkout). Integrator: resolve HTTPS-only action guards versus HTTP loopback and the local Verify Presentation Exchange versus hosted DCQL adapter before local acceptance. Person 2 must not bypass those restrictions.
- Once provisioned, rerun the existing **shell-only** command below. It proves login/unlock in two sessions; it is not a substitute for the still-missing Phase 2 issue/store/present/verifier acceptance command. Add that command only after dependencies and same-run correlation pass, then give its actual environment/artifact contract to Person 4.

```sh
PERSON2_LOCAL_LIVE=1 PERSON2_SYNTHETIC_PASSCODE_FILE="${MIMOTO_RUNTIME_DIR:-${TMPDIR:-/tmp}/mosip-web-local}/synthetic-wallet-passcode" pnpm --filter @playground/web exec playwright test --config playwright.local.config.ts --grep 'opt-in local shell'
```

## Person 2 checklist

- **Complete:** Phase 4 UI corrections; fixture/helper regressions; axe plus keyboard/tree, focus, motion, responsive, URL/privacy tests; build/typechecks; CI command/environment/artifact handoff.
- **Blocked:** all-local P0 JSON-LD acceptance and SD-JWT attempt; fresh local run ID and server-hop evidence; JSON-LD subject-name projection and authoritative deployment provenance; historical wallet-version metadata review. These require the owner/integrator dependencies above.
- **Not tested:** manual VoiceOver/NVDA pass, physical mobile devices, real browser zoom, external integrator usability session, a fresh hosted/live wallet run in Phase 4.
- **Deferred:** additional same-device launch work (`not_implemented`; existing guarded links retained), Digital Credentials API stand-in (`not_implemented`), extra theme/i18n/mobile enhancements (`not_implemented`), integrator usability check (`not_tested`). P0/P1 integration gates remain open, so stretch work was not started. A stand-in would never establish real-wallet acceptance.
