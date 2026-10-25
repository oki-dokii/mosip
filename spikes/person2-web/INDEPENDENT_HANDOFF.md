# Person 2 independent follow-up — 26 October 2026

Completed without changing other owners' code, shared seams, evidence tiers or CI. No product defects were exposed by the additional checks, so product UI code was left unchanged.

## Results

- **Native Chromium tab zoom passed at 200% and 400%.** The test uses Chromium 141.0.7390.37's `tabs.setZoom` in a disposable browser profile, verifies the browser-reported factor and renderer pixel ratio, and checks viewport reflow, filters and keyboard focus. The original 1440 CSS-pixel viewport becomes 720 and 360 pixels respectively, with no page overflow. This is actual automated tab zoom, not CSS `zoom`, pinch/page-scale emulation or a human visual test.
- **Mobile comparison columns measured:** at 320px every cell in both tables can be scrolled into view. All 51 cells meet the conservative 4.5:1 text threshold using their actual opaque computed foreground/background colors; minimum measured ratios are 15.61:1 and 16.19:1. This supplements the earlier axe incomplete result for clipped columns; it does not relabel that axe result as a pass or replace human visual review.
- **83 unit/UI tests, all 17 default browser tests, browser TypeScript and production build passed.** Existing Phase 4 artifact checks and the new exact-key/bounded-value artifact audit passed, as did the repository secret audit and whitespace check.
- Prepared `ACCEPTANCE_CHECKLIST.md` for one fresh managed local run, plus `MANUAL_ACCESSIBILITY_CHECKLIST.md` with synthetic startup commands and separate human/physical-device result fields. No results are pre-filled as passed.

## Reproduce / Person 4

From repository root, with the existing locked dependencies and Chromium installed:

```sh
pnpm --filter @playground/web test
pnpm --filter @playground/web exec tsc -p tsconfig.browser.json --pretty false
pnpm --filter @playground/web build
PLAYGROUND_BROWSER_ISSUER_PORT=4501 PLAYGROUND_BROWSER_VERIFIER_PORT=4502 PLAYGROUND_BROWSER_BFF_PORT=4500 PLAYGROUND_BROWSER_WEB_PORT=5175 PERSON2_SYNTHETIC_EVIDENCE_DIR=/tmp/person2-independent-legacy-evidence pnpm --filter @playground/web exec playwright test
node apps/web/scripts/check-independent-evidence.mjs
node apps/web/scripts/check-phase4-evidence.mjs
node scripts/audit-secrets.mjs
git diff --check
```

The default browser suite now includes `browser/independent.pw.ts`. The zoom case needs the full Playwright Chromium channel with extension support, not only the headless shell. It creates a temporary Manifest V3 zoom-only extension and an isolated profile, then removes them in `finally`. Its extension service worker is a deliberate exception to the default blocked-service-worker setting; no user browser profile/account is opened. Fixture APIs use local synthetic records. Person 4 should verify support on their CI runner; no CI edit or CI success claim is made here.

Evidence is limited to reviewed metadata in `spikes/person2-web/evidence/independent/{browser-zoom,mobile-column-contrast,privacy-checks}.json`. No screenshot, DOM dump, credential/token/query payload, trace, video or authentication state is exported. Existing legacy synthetic screenshots remain redirected to `/tmp`. The comparison UUIDs are fixtures, not live run IDs; these checks produce no real-wallet acceptance run.

## Latest integration boundary

The latest main evidence commit `1b0d4b1` records a same-wallet local JSON-LD positive result against implementation `77d7d10`: official Certify 0.14.0, Web 0.17.0, Mimoto 0.22.0 and Verify 0.18.2, with synthetic authorization and a public DID adapter. Its `playgroundRunId` is null. That teammate evidence was inspected, preserved and not rerun or promoted by these independent UI checks. Managed BFF correlation/provenance and the separate SD-JWT attempt still need their own acceptance evidence; earlier blanket statements that no local direct harness exists are superseded by this new work.

**Still not tested:** human VoiceOver/NVDA use, physical mobile devices, human visual inspection at enlarged text/zoom, integrator usability review and a fresh managed local wallet run in this follow-up. A person must perform and record the human/physical checks using the prepared checklist. Automated browser emulation, accessibility trees and color calculations do not establish those results. No stretch feature or team acceptance is claimed.
