# Product Requirements Document (PRD)

**Product:** Inji Interoperability Playground
**Version:** 0.1 (design phase) · **Date:** 2026-10-17
**Team:** 2–4 people · **Time box:** about 1 week
**Related:** SRS.md (exact requirements), TRD.md, UIUX.md, decisions.md

---

## 1. Vision
Anyone can pick an issuer, a wallet and a verifier, press one button, and watch a verifiable credential travel through the whole Inji stack, with every message visible and every result explained. Where something breaks, the playground makes the gap obvious enough to file as a bug.

## 2. Problem
Inji says its modules follow OpenID4VCI, OpenID4VP and common credential formats. Real ecosystems (eSignet, EUDI wallets, other national ID stacks) need proof, both that the three Inji modules work with each other under varied settings and that they work with software outside MOSIP. Today that proof is manual, scattered across separate UIs, and not repeatable.

## 3. Goals and non-goals

### Goals
1. Give integrators a hands-on, visual way to understand and trust Inji's standards compliance.
2. Surface real interoperability gaps (format mismatches, proof-type incompatibilities, DID method gaps, QR size limits) that core teams can act on.
3. Produce repeatable pass/fail evidence per combination, usable for regression tracking across releases.

### Non-goals
- Building a mobile app or changing Inji source code.
- Becoming a production verifier or wallet.
- Reproducing the external VC playground's look and flow.

## 4. Personas
| Persona | Context | What success looks like |
|---|---|---|
| **Asha, integrator** | Evaluating Inji for a national ID project | Runs a full flow in under 3 minutes and understands each step from the inspector |
| **Dev, Inji engineer** | Preparing a release | Opens the matrix, sees which combinations regressed since the last version, exports a bug draft |
| **Judge** | Seeing the demo for 3–5 minutes | Sees issue → hold → present → verify, the inspector, one tamper rejection and the matrix |

## 5. Scope by priority

| Pri | Feature | SRS |
|---|---|---|
| **P0** | F-01 One-command stack and health view | FR-01..03 |
| **P0** | F-02 Three-column selector (Inji roles first) | FR-10..14 |
| **P0** | F-03 Live "Issue a credential" flow | FR-20..25 |
| **P0** | F-04 Live "Present & verify" flow (cross-device QR) | FR-30..34 |
| **P0** | F-05 Protocol inspector with raw payloads | FR-40..44 |
| **P0** | F-06 Two credential formats (JSON-LD VC, SD-JWT VC), clearly labelled | FR-12, 13 |
| **P0** | F-07 Per-run pass/fail report and basic matrix | FR-50..52 |
| **P1** | F-08 Replay & tamper mode with expected outcomes | FR-60, 61 |
| **P1** | F-09 Interactive Mermaid sequence diagram | FR-70, 71 |
| **P1** | F-10 Run history dashboard with filters | FR-80, 81, 83 |
| **P1** | F-11 Non-Inji mock issuer and verifier | FR-90, 91 |
| **P1** | F-12 Matrix export (Markdown/JSON/CSV) | FR-52 |
| **P2** | F-13 Credential decoder (JWT / SD-JWT / JSON-LD) | FR-45 |
| **P2** | F-14 GitHub issue draft from a failed run | FR-100 |
| **P2** | F-15 Run diff | FR-82 |
| **P2** | F-16 QR capacity probe | FR-110 |
| **P2** | F-17 Clock-skew and expiry-boundary scenarios | FR-111 |
| **P2** | F-18 Scenario presets | FR-16 |
| **P2** | F-19 mso_mdoc (mock mode) as third format | FR-12 |
| **P2** | F-20 Same-device flow (deep link / Digital Credentials API) | FR-15, 35 |

### Why these P2 extras (researched ideas)
- **Decoder, QR probe, clock-skew scenarios, GitHub draft:** they directly serve goal 2 (finding and reporting real gaps), which the problem statement values.
- **Run diff:** makes regression tracking across Inji releases concrete.
- **Presets:** make the 3-minute first run possible for new users.
- **Same-device, mDoc:** listed as good-to-have in the problem statement; kept last because they depend on hardware or mock support.

## 6. User stories (P0 and P1)

1. As an integrator, I choose Certify, Inji Web and Verify with SD-JWT VC and start a run so that I can see a credential issued and verified end to end.
2. As an integrator, I open the inspector on any step so that I can read the exact request and response.
3. As an integrator, I see the format, proof type and algorithm labelled on every run so that I know what was actually tested.
4. As an Inji engineer, I download a Markdown report for a run so that I can attach it to a bug.
5. As an Inji engineer, I replay a presentation with a corrupted signature so that I can confirm Verify rejects it, and see expected vs actual.
6. As an Inji engineer, I filter history by Certify version and outcome so that I can spot a regression.
7. As an integrator, I swap in the mock external issuer so that I can see whether Inji handles a non-Inji issuer.
8. As a judge, I follow an animated sequence diagram so that I understand OpenID4VP without reading the spec.

## 7. Success metrics
| Metric | Target for the hackathon |
|---|---|
| Happy-path runs completing with an all-Inji combination | 2 formats × cross-device flow passing |
| Time for a new user to finish a preset run | Under 3 minutes |
| Combinations in the matrix | At least 6 tested combinations with recorded outcomes |
| Tamper scenarios with expected-vs-actual | At least 4 |
| Real gaps or bugs found and written up | At least 2, ideally filed as GitHub issues |
| Demo video | 3–5 minutes showing one full cycle with the inspector visible |

## 8. Deliverables (from the problem statement)
- Working app, deployed or runnable via Docker Compose.
- Public GitHub repository with README (setup, architecture, how to run each flow).
- Demo video (3–5 minutes).
- Interoperability report/matrix (Markdown or in-app).
- Write-up of discovered gaps or bugs.

## 9. Release plan (one week)
| Milestone | Outcome | Exit check |
|---|---|---|
| M0 Spikes (Day 1–2) | A credential obtained from Certify by any means; a VP accepted or rejected by Verify | Open questions P-001..P-004 answered and logged |
| M1 Walking skeleton (Day 2–3) | Run created, exchanges recorded via Tap, shown live in the UI | One run visible in the inspector |
| M2 P0 complete (Day 4–5) | Both formats, report, matrix, health view | Acceptance A1–A6 |
| M3 P1 (Day 5–6) | Tamper, sequence diagram, history, mocks, exports | Acceptance A7–A8 |
| M4 Polish and submit (Day 7) | README, demo video, interop report, gap write-up | Deliverables checklist complete |

## 10. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Certify issuance cannot be driven headlessly (P-001) | No automated issue step | Spike first; fall back to Inji Web–assisted issuance observed through the Tap; or use the Collab sandbox |
| Inji Web cannot present via OpenID4VP (P-002) | No Inji wallet presentation | Reference Wallet performs presentation; label it clearly in the UI |
| Verify rejects our `vp_token` shape (P-003) | Presentation fails for the wrong reason | Capture real traffic from a working client first; copy the accepted shape |
| Stack setup eats days | Late start on features | One person owns setup from Day 1; use Collab sandbox as a backup target |
| CORS and ngrok issues | Browser cannot reach services | All calls go through the BFF/Tap; no direct browser-to-Inji calls |
| Scope too large | Unfinished demo | Strict priority order; P1 and P2 are cut first; demo script is fixed early |

## 11. Demo script (3–5 minutes)
1. Open the playground; health view shows all services green (15 s).
2. Choose Certify → Reference Wallet → Verify, SD-JWT VC; press Run (20 s).
3. Watch the offer, token exchange and credential appear; open the inspector on the credential response (45 s).
4. Present to Verify with the QR flow; show the Valid result (45 s).
5. Replay with a corrupted signature; show Invalid and "expected vs actual: match" (45 s).
6. Play the sequence diagram (30 s).
7. Swap in the mock external issuer; show the result and any gap found (45 s).
8. Open the matrix and export it; close on the gap write-up (30 s).

## 12. Open questions
Tracked as pending decisions P-001..P-005 in `decisions.md`.
