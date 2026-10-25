# Silent demo video draft

[Playground walkthrough](Playground_Demo_Silent_Draft.mp4) is a **2 minute 7 second, silent draft** recorded from the local Compose demo on 25 October 2026. It uses synthetic mock-run data and the committed, sanitized A1 archive. No real wallet login, credential, VP token, cookies or raw HAR were recorded.

| Approximate time | What appears | Suggested narration |
|---|---|---|
| 0:00–0:18 | Select independent mock issuer and verifier with the Reference Wallet | “The role selector lets us test a known, local SD-JWT control.” |
| 0:18–0:51 | Fresh `valid` run, named steps and sanitized inspector | “The verifier accepted this exact mock combination. The timeline shows where each request and response was observed.” |
| 0:51–1:18 | Read-only managed Inji Web A1 record and presentation exchange | “This is a dated historical Inji Web JSON-LD run, not a new live attempt. The browser observed Mimoto transport; the BFF correlated the presentation with its Verify request and obtained `valid`.” |
| 1:18–1:37 | Separate Web and Android wallet evidence | “The Android SD-JWT result used a different hybrid deployment. Each card states its limits.” |
| 1:37–1:48 | Latest-result matrix | “The matrix keeps fixture, mock and archived wallet evidence distinct.” |
| 1:48–2:07 | Evidence-backed gap explorer | “We show observed interoperability gaps and what would be needed to establish an upstream defect.” |

The team should add a human voiceover, verify names and claims against the final commit, and upload the finished video with reviewer access. This draft has no audio and does not replace a fresh human rehearsal. The [pitch deck](Interoperability_Playground_Pitch.pptx) and [local demo record](../evidence/2026-10-25-local-demo.md) provide the matching narrative and technical proof.
