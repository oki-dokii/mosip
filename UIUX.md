# UI/UX Design

**Project:** Inji Interoperability Playground
**Version:** 0.1 (design phase) · **Date:** 2026-10-17
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS · TanStack Query · Socket.IO client · mermaid.js
**Related:** SRS.md (FR-10..FR-82), BACKEND.md (APIs and events), decisions.md

Design principle: **the protocol is the product.** Every screen should answer "what just happened, between whom, and was it correct?" The interface is plain and calm; colour is reserved for status and for the three actors.

Design constraint from the problem statement: use the external VC playground only to understand the concept. Our layout, naming, visuals and flow are our own.

---

## 1. Information architecture

```
/                      Playground (selector + live run)
/runs/:id              Run detail (timeline, inspector, sequence, report)
/history               History dashboard with filters
/matrix                Interop matrix + export
/tools                 Credential decoder, QR probe (P2)
/health                Service health and versions
```

Top navigation: **Playground · History · Matrix · Tools · Health**. A small "Test data only" badge sits in the header on every page.

---

## 2. Key screens

### 2.1 Playground (home)

Goal: from open to a running flow in three clicks.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Inji Interop Playground          Playground History Matrix Tools  ● ● ●│
├──────────────────────────────────────────────────────────────────────┤
│ Presets: [All-Inji SD-JWT] [All-Inji JSON-LD] [Mock issuer → Verify]  │
├───────────────┬───────────────────┬──────────────────────────────────┤
│ 1 ISSUER      │ 2 WALLET          │ 3 VERIFIER                       │
│ (•) Inji      │ (•) Reference     │ (•) Inji Verify                  │
│     Certify   │     Wallet        │ ( ) Mock external verifier       │
│ ( ) Mock      │ ( ) Inji Web      │                                  │
│     issuer    │     (assisted)    │                                  │
├───────────────┴───────────────────┴──────────────────────────────────┤
│ Format: (•) SD-JWT VC  ( ) W3C VC JSON-LD  ( ) mDoc (soon)           │
│ Flow:   (•) Cross-device QR   ( ) Same-device (soon)                 │
│ Tamper: [ None ▾ ]        Expected result: Valid                     │
│                                                  [ ▶ Run ]           │
├──────────────────────────────────────────────────────────────────────┤
│ Live run                                                             │
│ ✔ Offer  ✔ Token  ✔ Credential  ● Present request  ○ Submit  ○ Result│
│ ┌───────────────────────────┬──────────────────────────────────────┐ │
│ │ Timeline / action panel   │ Inspector (selected step)            │ │
│ └───────────────────────────┴──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

Behaviour:
- Each column lists implementations as radio cards with a short description and a "Inji" or "External-style" tag.
- Unsupported combinations are disabled with a tooltip reason (FR-14).
- Format, proof type and algorithm are shown as chips on the run header throughout (FR-13).
- **Run** button disabled until all three roles and a format are chosen.
- Changing tamper updates the "Expected result" label; the user can see what the playground predicts before running.

### 2.2 Live run panel

Two regions beside each other (stacked on narrow screens):

**Left: timeline and action panel**
- Vertical step list with state icons: pending (hollow), running (pulsing), succeeded (check), failed (cross), skipped (dash). Each row also has a text label so colour is never the only signal.
- When user action is needed (`action:required`), the action panel shows it prominently:
  - **Scan QR:** large QR with the deep link under it, copy button, countdown to expiry.
  - **Open Inji Web:** instruction card with a button that opens Inji Web through the Tap prefix, and a "Waiting for you…" indicator.
- Final card: result badge (**Valid**, **Invalid**, **Valid but expired**, **Error**), expected vs actual, and buttons: *Download report*, *Replay*, *Replay with tamper*, *Open sequence*.

**Right: inspector**
- Tabs: **Request**, **Response**, **Decoded**, **Notes**.
- Header shows `METHOD URL → status · duration` and actor arrow (Wallet → Verify).
- JSON viewer with collapse/expand, copy, and "download as file".
- Masked values show a lock chip, e.g. `access_token  🔒 masked`, with a tooltip explaining why.
- JWT / SD-JWT values have a "Decode" toggle that shows header, payload and disclosures (uses the same decoder as the Tools page).
- Differences between expected and actual outcomes are highlighted in the Notes tab.

### 2.3 Run detail (`/runs/:id`)
Same layout as the live panel but read-only, plus tabs for **Sequence** and **Report**.

### 2.4 Sequence view
- Mermaid sequence diagram built from recorded exchanges (participants: Browser/User, Playground, Wallet, Issuer, Verifier).
- **Play** button reveals messages one by one (about 1 s each), highlighting the matching row in the timeline; **Step**, **Pause**, **Reset** and a speed control.
- Clicking a message opens that exchange in the inspector.
- Respects `prefers-reduced-motion`: animation off, full diagram shown.

### 2.5 Report view
- Header: run id, date, status, expected vs actual.
- Table: issuer, wallet, verifier, format, proof type, algorithm, flow, tamper, service versions.
- Findings list: error detail and any expected-vs-actual mismatch.
- Buttons: **Download Markdown**, **Download JSON**, **Create issue draft** (P2).

### 2.6 History (`/history`)
- Filter bar: issuer, wallet, verifier, format, outcome, Certify version, Verify version, date range.
- Table: time, combination (three small actor chips), format, expected, actual, status, duration; row click opens the run.
- Summary strip above the table: runs, pass rate, most common error code.
- (P2) Select two rows → **Compare** opens the run diff.

### 2.7 Matrix (`/matrix`)
- Rows: issuer × wallet; columns: verifier; one sub-column per format. Each cell shows status icon + short label (Pass / Fail / Not run) and links to the latest run.
- Legend and "last updated" time; **Export** menu (Markdown, JSON, CSV).
- Cells for tamper scenarios appear in a separate "Negative paths" section so they do not mix with happy paths.

### 2.8 Tools (P2)
- **Decoder:** paste a JWT, SD-JWT or JSON-LD VC; see decoded structure and basic checks (expiry, algorithm, disclosure count).
- **QR probe:** paste or pick a payload from a run; see its size, the smallest QR version that fits, and a pass/fail against a scannable threshold.

### 2.9 Health (`/health`)
Cards per service: status dot + word (Up/Down), version, latency, last checked, and the base URL in use. A "Using Collab sandbox" banner appears when the playground targets remote services.

---

## 3. Core interaction flows

**Happy path (3 clicks):** pick preset → Run → (if prompted) scan QR → see Valid result.

**Tamper path:** open a finished run → *Replay with tamper* → choose fault → Run → result shows "Invalid (expected Invalid) ✔ match".

**Gap capture (P2):** failed or mismatched run → *Create issue draft* → review → copy to GitHub.

---

## 4. States and messages

| Situation | UI response |
|---|---|
| Service down before run | Run blocked; banner names the service and links to Health |
| Step fails | Step row shows cross and error code; inspector auto-opens the failing exchange; run card shows a plain-language message and "Retry" |
| Waiting for user (QR / Inji Web) | Action panel with countdown; "Cancel run" button |
| Request expired | Message "Request expired. Start again." with a one-click retry |
| WebSocket drops | Small banner "Reconnecting…"; on reconnect, fetch missed steps and exchanges via REST |
| Empty history | "No runs yet. Try a preset." with the preset buttons |
| Masked data | Lock chip with tooltip "Hidden to keep secrets out of logs" |

Plain-language error examples:
- `VERIFY_REQUEST_FAILED`: "Inji Verify did not accept the presentation request. Open the failing step to see why."
- `COMBINATION_UNSUPPORTED`: "This issuer doesn't offer that format."
- `RESULT_TIMEOUT`: "No answer from the verifier in time."

---

## 5. Visual design

**Actor colours** (used on chips, sequence participants, timeline icons):
| Actor | Colour | Use |
|---|---|---|
| Issuer | Blue | `#2563EB` |
| Wallet | Green | `#16A34A` |
| Verifier | Orange | `#EA580C` |
| Playground / system | Slate | `#475569` |

**Status colours:** pass `#15803D`, fail `#B91C1C`, warning/expired `#B45309`, pending `#6B7280`. Status always has an icon and a label as well as colour.

**Type:** system sans-serif for UI; monospace (`ui-monospace`) for payloads, URLs and tokens. Base size 16 px; payload viewer 13–14 px.

**Spacing and shape:** 8 px grid; cards with 12 px radius and light borders; dark mode supported through Tailwind `dark:` classes and `prefers-color-scheme`.

**Iconography:** one icon set (Lucide) only; no brand logos or imagery from the external playground.

**Tailwind tokens** (in `tailwind.config.ts`): `colors.issuer`, `colors.wallet`, `colors.verifier`, `colors.ok`, `colors.bad`, `colors.warn`.

---

## 6. Components (in `apps/web/src/components`)

| Component | Responsibility |
|---|---|
| `RoleSelector` | Three-column radio-card selector with disabled reasons |
| `FormatPicker`, `FlowPicker`, `TamperPicker` | Run options |
| `PresetBar` | Preset scenario buttons |
| `RunHeader` | Chips for format, proof type, algorithm, versions |
| `RunTimeline` | Step list with live updates |
| `ActionPanel` | QR / Inji Web instructions and countdown |
| `Inspector` | Tabs, JSON viewer, decode toggle, masked chips |
| `ResultCard` | Outcome badge, expected vs actual, actions |
| `SequenceDiagram` | Mermaid render plus playback controls |
| `ReportView` | Report table, findings, downloads |
| `HistoryTable`, `FilterBar` | History dashboard |
| `MatrixGrid` | Interop matrix |
| `HealthCards` | Service status |
| `DecoderPanel`, `QrProbe` | P2 tools |

Data hooks (`src/lib`): `useRun(id)`, `useRunStream(id)` (socket), `useRuns(filters)`, `useMatrix()`, `useHealth()`, `useImplementations()`.

---

## 7. Accessibility and responsiveness
- Every control reachable by keyboard; visible focus ring; radio cards are real radio inputs.
- Status is conveyed by icon + text, not colour alone; contrast meets WCAG AA.
- Live regions (`aria-live="polite"`) announce step changes and the final result.
- Mermaid diagram has a text alternative: the ordered exchange list in the timeline.
- Layout works from 360 px width up: selector columns stack vertically; inspector moves below the timeline.
- Motion respects `prefers-reduced-motion`.

---

## 8. Microcopy (initial)
- Header badge: "Test data only. Nothing here is real personal data."
- Run button: "Run flow"
- Tamper helper: "Deliberately breaks the credential to check the verifier rejects it."
- Empty inspector: "Select a step to see the exact messages exchanged."
- Result badges: "Valid", "Invalid", "Valid but expired", "Error".
- Reference Wallet label: "Reference Wallet (built into the playground)".

---

## 9. Usability checks before submission
1. A teammate who has never seen the project completes a preset run in under 3 minutes without help.
2. Every status can be understood without colour (grayscale screenshot test).
3. Every masked value shows a reason.
4. The full demo script in PRD §11 can be run without leaving the app.
