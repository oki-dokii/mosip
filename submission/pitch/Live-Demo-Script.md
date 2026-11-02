# Live playground demo

| Time | What to say |
|---|---|
| 00:00–00:05 | Let’s issue a credential, verify it, then repeat with a broken signature. |
| 00:05–00:11 | Choose the standalone mock issuer and verifier. The reference wallet holds the credential. |
| 00:11–00:19 | Start the control run. Each step belongs to this new run ID. |
| 00:19–00:31 | Play the protocol sequence to see which component sent each message. |
| 00:31–00:35 | Select a message to inspect the sanitized request and response. |
| 00:35–00:43 | Now change one input: choose Bad signature and run the flow again. |
| 00:43–00:48 | The verifier returned Invalid. The test passed because rejection was expected. |
| 00:48–00:58 | Compare the two run IDs to see what changed. |
| 00:58–01:05 | Open the matrix to review results across combinations. |
| 01:05–01:12 | These wallet journeys are saved evidence from earlier runs. |
| 01:12–01:17 | The findings link observed behavior to versions and reproduction evidence. |
| 01:17–01:24 | The registry lists the parties you can investigate. |
| 01:24–01:30 | Compare QR payload sizes and measured format capabilities. |
| 01:30–01:37 | The Android journey used local Certify and hosted Verify. |
| 01:37–01:48 | Reproduce the mock run with pnpm demo:docker. Open localhost:5174. |
