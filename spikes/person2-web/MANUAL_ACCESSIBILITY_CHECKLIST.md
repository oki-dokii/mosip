# Person 2 — human accessibility and physical-device checks

Status: **not_tested**. Automated axe, keyboard, accessibility-tree, computed-color and browser zoom checks do not constitute a human screen-reader or physical-device test. This sheet can be used independently of the local Inji stack, with synthetic playground data.

## Start a synthetic playground

Use two terminals from the repository root, after installing locked dependencies and building the shared package. These commands start fixture drivers, not a real wallet:

```sh
# Terminal 1
DATABASE_URL="" PLAYGROUND_DRIVER_MODE=fixture PORT=4000 WEB_ORIGIN=http://127.0.0.1:5173 pnpm --filter @playground/bff exec tsx src/server.ts
# Terminal 2
PLAYGROUND_WEB_DEV_PORT=5173 PLAYGROUND_BFF_URL=http://127.0.0.1:4000 pnpm --filter @playground/web exec vite --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Create two synthetic Reference Wallet runs for comparison; select JSON-LD/Inji Web for browser-only rehearsal and connected fixture controls. Do not use account credentials or real credential data.

## Human record — leave unfilled until actually performed

| Field | Actual observation |
| --- | --- |
| Reviewer / date | — |
| Screen reader and version | `not_tested` |
| OS / browser / browser version | — |
| Physical phone/tablet and OS/browser | `not_tested` |
| Browser zoom / text-size settings | — |
| Checkpoint, expected speech/focus, actual result | — |
| Defect or reviewed synthetic evidence path | — |

## Screen-reader tasks

- [ ] With VoiceOver or NVDA active, reach the skip link and main landmark; navigate headings, fieldsets, radio options, disabled wallet explanation, format pressed states, scenario and fault controls.
- [ ] Start a fixture. Confirm stage changes and final results are announced once meaningfully; countdowns must not interrupt continuously. Distinguish fixture completion from real-wallet acceptance.
- [ ] Advance each assisted checkpoint; cancel and simulate an error. Confirm focus recovers when its button disappears and remains on a surviving/outside control during polling.
- [ ] Open a history run, select steps/messages and expand projected structure. Confirm names, withheld counts and authenticity warnings are understandable without reading raw payloads.
- [ ] Compare two runs. Read row/column headers, version/profile differences, missing fields and normalized verdicts; confirm scroll areas and run A/B controls are named.
- [ ] Filter history/matrix to an empty result. Open the share link, reload and use back/forward. Confirm selected state, focus restoration and error announcements.
- [ ] Exercise clipboard feedback, unsupported configuration and denied/unavailable API states using an approved synthetic test setup. Record any repeated or missing announcements.

## Physical-device and visual tasks

- [ ] Use an approved synthetic instance reachable by the physical device; host loopback URLs are not reachable from a different phone. Record the actual device, browser and settings.
- [ ] Check portrait/landscape, enlarged text, touch controls and horizontally scrolling tables. Verify no page-wide overflow, hidden actions or overlapping focus/labels.
- [ ] Inspect comparison cells at each horizontal position and visible focus in light/dark inspector regions. Do not infer a human visual result from computed color ratios.
- [ ] Repeat a keyboard-only pass where an external keyboard is available; verify reduced-motion behavior with the OS setting enabled.

Mark each result `passed`, `failed`, `blocked` or `not_tested`, with the actual checkpoint. Redact any unintended account or credential details before saving evidence. An integrator usability session and real local wallet acceptance remain separate activities.
