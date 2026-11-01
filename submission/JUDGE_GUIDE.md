# Review the playground in five minutes

**One URL:** [Open the read-only playground evidence](https://oki-dokii.github.io/mosip/). No login or Collab connection is needed. Start with the local wallet result, then inspect an external-wallet failure. Look for the last successful checkpoint and whether a verifier actually returned a verdict.

**One command from the checkout:** `pnpm demo:docker` (Docker running; see the [setup prerequisites](../README.md)). This exercises the packaged mock stack. Expect a valid control, deterministic fault outcomes and a matrix. This command does not perform the human wallet journey.

| Live demo | Fallback if a dependency is unavailable |
|---|---|
| Run the mock control; open its timeline and a sanitized exchange. | Show the read-only review URL. |
| Change to a bad signature; compare the outcome against the control. | Open the protocol matrix there and compare the baseline and signature case. |
| Open the managed local JSON-LD history entry and identify the exact card after reload, presentation and independent Verify result. | Open the [committed run report](evidence/2026-10-26-person2-local-ui/run-report.json). Say it is a recorded run. |

**What counts as all-Inji?** Local Certify, Inji Web/Mimoto and Verify completed the documented JSON-LD journey. The reference holder is a separate automated control. Android SD-JWT used a real phone and hosted Verify; it does not prove local Android verification.

**Why separate evidence tiers?** A fixture proves deterministic behavior; live responses prove only the observed deployment and checkpoint. A wallet HTTP 500 before presentation is not an invalid credential verdict.

**What about security findings?** Two items were reported privately. See the [public tracking status](UPSTREAM_REPORT_STATUS.md); explain scope and disclosure status without sharing payloads.

**Can we reproduce the claims?** Start with the [claims table](CLAIMS_AND_EVIDENCE.md). It points to dated records and distinguishes repeatable commands from runs requiring an operator.
