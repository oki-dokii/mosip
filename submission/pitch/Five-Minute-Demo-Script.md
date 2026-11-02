# Five-minute product demo

| Time | What to say |
|---|---|
| 00:00–00:19 | Here is our interoperability playground. I choose the standalone mock issuer and verifier, with the reference wallet as holder. Starting the flow creates a new run ID and executes issuance, presentation and verification. |
| 00:19–00:35 | The valid control completes successfully. I play the sequence and open a message to inspect its sanitized request and response. Each exchange belongs to a named step in this run. |
| 00:35–00:48 | Now I change the signature and repeat. The verifier returns Invalid. That is the expected outcome for this fault. Both results come from the services running during this recording. |
| 00:48–01:05 | I compare the two runs and open the matrix. The comparison preserves configuration and outcomes. Reports and matrix exports provide a reviewable record of each combination. |
| 01:05–01:30 | Here are the saved real-wallet observations, the findings explorer, the party registry and QR capabilities. The registry describes formats and flows. The capabilities page distinguishes measured support from claims. |
| 01:30–01:48 | The Android guide explains the phone journey and its network requirements. For the local mock prototype, run pnpm demo:docker and open localhost:5174. |
| 01:48–02:27 | Next is the assisted JSON-LD fixture. I start a connected run, simulate issuance, confirm storage, and submit the presentation. The result is Valid. After reloading, the saved run is still available. These controls demonstrate the assisted workflow using fixture data. |
| 02:27–02:45 | This is the recorded local Inji Web card after reload. The same wallet received the JSON-LD credential from Certify and presented it to local Verify. The setup used synthetic authorization and an explicit DID adapter. |
| 02:45–03:03 | The managed local inspector links captured exchanges to the run. It exposes permitted field names while withholding credential values. Browser transport and Mimoto server calls have distinct capture coverage. |
| 03:03–03:21 | The hosted Web journey has its own recorded run and valid verification. Its environment and timestamps remain separate from the local journey. Historical records can be opened for review. |
| 03:21–03:39 | The physical Android record used local Certify and hosted Verify. The operator stored and reopened the card, then presented it successfully. A managed all-local Android run remains open. |
| 03:39–04:01 | This comparison isolates issuer key location across two Verify versions. ES256 and RS256 passed with a matching certificate and failed without one. Supplying the native walt.id signer’s certificate also restored Valid on both versions. |
| 04:01–04:28 | Our evidence table covers authorization code with PKCE, pre-authorized issuance, cross-vendor discovery adapters, mDL signature and digest checks, and the browser credential chooser. The matrix indexes 79 observations and the register tracks 15 findings. Each claim links its evidence and limits. |
| 04:28–04:46 | The sample-data index gives synthetic inputs, instructions and expected outcomes. The API reference documents the backend. Test evidence and dated reports record the checks actually executed. |
| 04:46–05:00 | The readiness page records completed checks and pending human tasks. Reviewers can run the Docker prototype or inspect the public evidence archive, then follow a result back to its version, run and sanitized exchanges. |
