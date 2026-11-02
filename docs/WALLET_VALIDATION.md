# Real Inji wallet acceptance: A1 and A2

Current main exposes the Android evidence and operator checklist at /android. Each gate below applies to the recorded deployment.

| Gate | Required observed chain | Current state | Owner |
|---|---|---|---|
| A1, JSON-LD | Inji Certify issues → a logged-in Inji Web or suitable Inji mobile wallet stores → the same wallet presents → Inji Verify returns `valid` | **Managed technical chain passed, 25 October; team review pending:** fresh run `3dc6895d-ff87-45a2-a10b-46844198d83e` links Mimoto issuance transport, reload-backed storage confirmation, correlated presentation and independent Verify `valid`. See [evidence and coverage limits](../submission/evidence/person2-managed-a1-2026-10-25/README.md). | Person 2 |
| A2, SD-JWT | Inji Certify issues → a pinned capable Inji Wallet mobile build stores → that wallet produces holder-bound presentation → Inji Verify returns `valid` | **Passed for the recorded hybrid profile (23 October):** local official Certify → actual Android Inji Wallet → Collab Verify. User confirmed reopen persistence; correlated Verify outcome `valid`, credential/holder proof flags true. About version and Mac APK hash are recorded; installed-binary attestation and Collab release remain unverified. See [mobile evidence](../submission/evidence/person3-a2-mobile-2026-10-23/README.md). | Person 3 |

For each new attempt, record wallet build, device/platform, deployment URL and component versions, format and configuration ID, protocol draft if known, timestamp, issuance, storage, presentation, verifier result, and a sanitized report or screenshot. Mark each checkpoint as observed, failed, or unavailable. A Reference Wallet run is useful diagnostic evidence but cannot close either gate.

At the cutoff, publish the actual status here: `passed`, `failed`, or `blocked` with the exact external reason. If either is not passed, continue A6 packaging, browser QA, and final documentation; present the remaining wallet limitation plainly in the README and pitch. Do not place login credentials, real credentials, private keys, OTPs, or raw network captures in this file.

[Person 4's implemented setup](../deploy/MOBILE_INJI.md) enabled the successful A2 route. The [earlier failed Collab attempt](../submission/evidence/person3-a2-2026-10-23/README.md) remains historical evidence; [the successful mobile bundle](../submission/evidence/person3-a2-mobile-2026-10-23/README.md) closes the observed A2 chain for this profile. A1 now has its separate fresh managed result linked above; final team review remains pending.
