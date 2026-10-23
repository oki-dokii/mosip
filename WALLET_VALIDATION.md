# Real Inji wallet acceptance: A1 and A2

Working project clock: on 2026-10-21 the team reported approximately **five days remaining**. Until the official deadline is supplied, use **2026-10-26 21:00 IST** as the planning freeze and **2026-10-24 21:00 IST** as the A1/A2 go/no-go cutoff (48 hours earlier). Replace both timestamps immediately if the official submission time differs. The cutoff prevents an unavailable account or device from consuming packaging and documentation time; it does **not** turn a blocked test into a pass.

| Gate | Required observed chain | Current state | Owner |
|---|---|---|---|
| A1, JSON-LD | Inji Certify issues → a logged-in Inji Web or suitable Inji mobile wallet stores → the same wallet presents → Inji Verify returns `valid` | **Blocked:** no dedicated persistent Inji Web test account is available. Guest issuance/download is insufficient. | Person 2 |
| A2, SD-JWT | Inji Certify issues → a pinned capable Inji Wallet mobile build stores → that wallet produces holder-bound presentation → Inji Verify returns `valid` | **Awaiting controlled phone retry (23 October):** the prior Collab attempt was blocked by invalid client ID. A separate official local Certify + Collab Verify control now passes through `pnpm mobile:inji`; real phone issuance, storage, presentation and final validity remain unobserved. See [A2 evidence](submission/A2_MOBILE_EVIDENCE.md) and [mobile runbook](deploy/MOBILE_INJI.md). | Person 3 |

Before the cutoff, each owner records wallet build, device/platform, deployment URL and component versions, format and configuration ID, protocol draft if known, timestamp, issuance, storage, presentation, verifier result, and a sanitized report or screenshot. Mark each checkpoint as observed, failed, or unavailable. A Reference Wallet run is useful diagnostic evidence but cannot close either gate.

At the cutoff, publish the actual status here: `passed`, `failed`, or `blocked` with the exact external reason. If either is not passed, continue A6 packaging, browser QA, and final documentation; present the remaining wallet limitation plainly in the README and pitch. Do not place login credentials, real credentials, private keys, OTPs, or raw network captures in this file.

For the next A2 attempt, complete [Person 4's client/catalog/token-exchange prerequisites](PERSON4_A2_PREREQUISITES.md) before asking the user to retry. The [23 October mobile evidence bundle](submission/evidence/person3-a2-2026-10-23/README.md) contains the partial attempt and its limitations.
