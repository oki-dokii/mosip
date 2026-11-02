# Five-minute product demo

| Time | What to say |
|---|---|
| 00:00–00:08 | Here is our interoperability playground. Let’s issue a credential, verify it, and then test a broken signature. |
| 00:08–00:14 | I choose the standalone mock issuer and verifier, with the reference wallet as holder. |
| 00:14–00:22 | Starting the flow creates a run ID and executes issuance, presentation and verification. |
| 00:22–00:34 | The control returned Valid. I play the protocol sequence to follow each component’s messages. |
| 00:34–00:38 | I open an exchange to inspect its sanitized request and response. |
| 00:38–00:46 | Now I select Bad signature and start another run. |
| 00:46–00:51 | The verifier returned Invalid. The test passed because rejection was expected. |
| 00:51–01:01 | I select the two run IDs and compare their configuration, steps and outcomes. |
| 01:01–01:08 | The matrix brings results across combinations into one view. |
| 01:08–01:15 | The real-wallet catalog contains recorded observations with their own provenance. |
| 01:15–01:20 | The findings explorer links observed behavior to its evidence and versions. |
| 01:20–01:27 | The party registry describes supported roles, formats and flows. |
| 01:27–01:33 | The capabilities page shows QR payload measurements and support boundaries. |
| 01:33–01:40 | The Android guide explains the recorded phone journey and network requirements. |
| 01:40–01:48 | Run pnpm demo:docker and open localhost:5174 to reproduce the mock prototype. |
| 01:48–01:57 | Now I demonstrate the assisted JSON-LD workflow using fixture data. |
| 01:57–02:03 | I start a connected fixture run. The backend tracks each checkpoint. |
| 02:03–02:14 | I simulate issuance, then confirm storage as a separate checkpoint. |
| 02:14–02:19 | I submit the fixture presentation. The verifier result becomes Valid. |
| 02:19–02:27 | I reload the saved run URL. The fixture outcome remains available. |
| 02:27–02:33 | Here is the recorded local Inji Web card after reload. |
| 02:33–02:40 | Certify issued the JSON-LD credential. The same wallet presented it to local Verify. |
| 02:40–02:45 | This setup used synthetic authorization and an explicit DID adapter. |
| 02:45–02:52 | The managed inspector links captured exchanges to the local run. |
| 02:52–02:59 | Permitted field names are shown while credential values are withheld. |
| 02:59–03:03 | Browser traffic and Mimoto server calls have distinct capture coverage. |
| 03:03–03:12 | The hosted Web journey has its own recorded run and valid verification. |
| 03:12–03:21 | Its environment and timestamps remain separate from the local journey. |
| 03:21–03:27 | This physical Android record used local Certify and hosted Verify. |
| 03:27–03:33 | The operator stored and reopened the card, then presented it successfully. |
| 03:33–03:39 | A managed all-local Android run remains open. |
| 03:39–03:45 | Here we compare issuer key handling across two Verify versions. |
| 03:45–03:53 | ES256 and RS256 passed with a matching certificate and failed without one. |
| 03:53–04:01 | The native walt.id credential also passed when supplied with its signer’s certificate. |
| 04:01–04:08 | Our claims table links each result to saved evidence and its limits. |
| 04:08–04:16 | It covers authorization code with PKCE, pre-authorized issuance and cross-vendor discovery adapters. |
| 04:16–04:22 | It also records the mDL integrity checks, browser credential chooser and QR measurements. |
| 04:22–04:28 | The matrix indexes 79 observations and the register tracks 15 findings. |
| 04:28–04:35 | The sample-data index gives synthetic inputs, instructions and expected outcomes. |
| 04:35–04:46 | The API reference documents the backend. Test reports record the checks actually executed. |
| 04:46–04:52 | The readiness page records completed checks and remaining human tasks. |
| 04:52–05:00 | Reviewers can run the Docker prototype or inspect the public evidence archive. |
