# Pitch and demo outline

The [editable six-slide deck](pitch/Interoperability_Playground_Pitch.pptx) covers the problem, role flow, managed A1 run, Android/Web checkpoints, technical stack, audience and impact. Its speaker notes record evidence sources and limits. The video remains to be recorded against the final tested commit and deployment.

## Six-slide pitch structure

1. **Title:** State the product and its purpose.
2. **Problem:** A credential may issue successfully while another wallet or verifier fails later in the journey.
3. **Architecture:** Explain issuer, wallet and verifier roles, plus the React/Express/PostgreSQL evidence path and write-time redaction. The automated Reference Wallet and observed Inji wallets have distinct evidence.
4. **Managed run:** Show the original A1 run ID, ten succeeded steps and seven sanitized exchanges. The committed run is available read-only in a fresh demo.
5. **Real wallets:** Show the dated Inji Web JSON-LD and Android SD-JWT observations with their separate deployment limits.
6. **Audience and quality:** Explain the value for MOSIP integrators and QA teams; cite the six-case mock demo and current 204 BFF / 60 web passing tests.

## Suggested 3–4 minute video

| Time | Show | Say |
|---|---|---|
| 0:00–0:25 | One-slide problem and product title | “A credential can issue successfully yet fail when a different wallet presents it. We make that boundary visible.” |
| 0:25–1:10 | Select the SD-JWT baseline preset, run it | Name the actual mode on screen: fixture or Collab Reference Wallet. Never call it a real Inji wallet if it is not. |
| 1:10–1:55 | Timeline, sequence, inspector | Explain offer, token, credential, presentation request, submission, and verifier result. Show that secrets are masked. |
| 1:55–2:35 | Replay bad-signature scenario | Explain expected invalid versus an unexpected failure, and why negative cases matter. |
| 2:35–3:15 | Report and matrix | Show format, versions, outcome, and evidence tier. The matrix keeps fixture and live evidence separate. |
| 3:15–3:45 | Architecture and limitations | State that the managed Web run passed for its recorded profile, Android has a separate observed hybrid acceptance, and browser capture cannot see Mimoto server-side calls. The complete local Inji bundle remains open. |

Record at a fixed browser size, use only synthetic test data, rehearse once without cuts, and keep a backup recording. Upload the deck and video to the reviewer-accessible cloud folder submitted to MOSIP.
