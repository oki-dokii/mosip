# Pitch and demo outline

This is a script and slide outline, **not** the required finished deck or video. Update it to match the final tested commit and deployment.

## Six-slide pitch

1. **Problem:** Standards-compliant components can still fail together because of draft versions, formats, proof binding, and trust choices. Manual checks are hard to repeat.
2. **Solution:** Pick an issuer, wallet, verifier, and format; run the journey and inspect each protocol boundary and result.
3. **Architecture:** Use [ARCHITECTURE.md](ARCHITECTURE.md). Point out role adapters, redaction before storage, and the difference between the Reference Wallet and an Inji wallet.
4. **Live product:** Show one scenario, timeline, safe inspector, negative replay, report, and evidence-tier matrix.
5. **Validation:** Show the 339 ordinary passing tests, three Chromium checks and clean six-case hosted mock matrix from [TEST_EVIDENCE.md](TEST_EVIDENCE.md). Separate those from the dated Collab Reference Wallet results and state A1/A2/A6 status plainly.
6. **Impact and next step:** Faster integration diagnosis, reusable test cases, and a clear path to real Inji wallet and packaging validation.

## Suggested 3–4 minute video

| Time | Show | Say |
|---|---|---|
| 0:00–0:25 | One-slide problem and product title | “A credential can issue successfully yet fail when a different wallet presents it. We make that boundary visible.” |
| 0:25–1:10 | Select the SD-JWT baseline preset, run it | Name the actual mode on screen: fixture or Collab Reference Wallet. Never call it a real Inji wallet if it is not. |
| 1:10–1:55 | Timeline, sequence, inspector | Explain offer, token, credential, presentation request, submission, and verifier result. Show that secrets are masked. |
| 1:55–2:35 | Replay bad-signature scenario | Explain expected invalid versus an unexpected failure, and why negative cases matter. |
| 2:35–3:15 | Report and matrix | Show format, versions, outcome, and evidence tier. The matrix keeps fixture and live evidence separate. |
| 3:15–3:45 | Architecture and limitations | State what was proven and what still needs a persistent Inji Web account, mobile-wallet check and authenticated local Inji services. |

Record at a fixed browser size, use only synthetic test data, rehearse once without cuts, and keep a backup recording. The team should make the final slide deck and video accessible through the cloud link submitted to MOSIP.
