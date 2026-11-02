# Complete product demonstration

- 00:00–01:48 · Live control, signature fault and comparison
- 01:48–02:27 · Assisted JSON-LD fixture and reload
- 02:27–16:19 · Wallet evidence, interop findings and full matrix

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
| 01:48–01:55 | Next, follow the assisted JSON-LD workflow using the built-in fixture. |
| 01:55–02:01 | Start a connected fixture run. The backend tracks its progress. |
| 02:01–02:06 | Simulate issuance and watch the wallet checkpoint advance. |
| 02:06–02:12 | Confirm storage separately so the evidence records who observed it. |
| 02:12–02:17 | Submit the fixture presentation and inspect the verifier outcome. |
| 02:17–02:27 | Reload this run URL. The saved fixture outcome remains available. |
| 02:27–02:39 | Can a credential issued by one system survive storage in a wallet and verification by another? Team Bhole Chature follows each exchange from offer to verdict. |
| 02:39–02:51 | The registry describes issuers, wallets, formats and flows. Inspect a party before choosing a scenario. The capabilities view also compares measured QR sizes. |
| 02:51–03:03 | Run the baseline first. The mock issuer issued a synthetic credential, the holder presented it, and the verifier returned the expected verdict. |
| 03:03–03:15 | Corrupt the issuer signature. The credential now fails verification. The test passes because the rejection matches the expected outcome. Signed expiry, wrong type and missing disclosure have separate scenarios. |
| 03:15–03:27 | The hosted Inji Web wallet stored a Land Registry Registration Receipt. The card survived a refresh. A managed run connected the presentation to an independent Verify result. |
| 03:27–03:39 | Certify 0.14 issued JSON-LD. Inji Web 0.17 and Mimoto 0.22 stored the card. After reload, the same wallet presented it to Verify 0.18.2. Synthetic authorization and DID adapters were enabled. |
| 03:39–03:51 | The inspector shows the permitted credential-subject field names. The browser bridge and local proxy distinguish wallet transport from downstream verification. Run-scoped tags correlate observations without exposing their raw values. |
| 03:51–04:03 | A missing hop stays unobserved. Synthetic HAR import strips sensitive fields before storage. Regression checks exercise stored rows, API responses and socket events. |
| 04:03–04:15 | The interactive synthetic UIN and OTP flow exercised authorization code with PKCE. Local Verify accepted both JSON-LD proofs after reload. A separate reference-holder control completed pre-authorized SD-JWT issuance. |
| 04:15–04:27 | A physical Android wallet received a credential from local Certify and presented it to hosted Verify. That hybrid run returned Valid. An all-local Android verdict with a playground run ID remains open. |
| 04:27–04:39 | The native walt.id wallet completed its own issuance and presentation. For a Certify offer, discovery aliases and an SD-JWT-only catalog advanced resolution to HTTP 200. Receiving the credential then stopped at 400. |
| 04:39–04:51 | A separate Verify request reached the wallet after a media-type adapter. The signed request omitted an audience expected by the wallet. Attribution depends on the OpenID4VP discovery profile. |
| 04:51–05:03 | Keep the issuer identifier and signing key fixed. On both Verify releases, ES256 and RS256 failed without a certificate and passed with one. The native walt.id credential also passed with its matching PEM chain. |
| 05:03–05:15 | Collab issued an ISO mobile driving licence. Inji verification was unsuccessful. An independent library verified the issuer signature and six attribute digests. Device authentication and certificate trust were outside that check. |
| 05:15–05:27 | PixelPass compressed the 96-claim JSON-LD sample enough to fit QR version 39 at error correction M. The measurement covers encoding. A physical scan is a separate experiment. |
| 05:27–05:39 | A local verifier generated a native request link and a Digital Credentials API request. Chromium opened its chooser. A provider-backed verdict remains open. Mimoto 0.22 signing support for Inji Web SD-JWT is a source-level finding. |
| 05:39–05:51 | The matrix indexes 79 observations, including controls, stopped attempts and adapter comparisons. Compare the last successful step, format and version before interpreting a verdict. The register tracks 15 findings. |
| 05:51–06:03 | Exports preserve versions, timestamps and exchange references. Telemetry groups success and latency by flow. The read-only archive lets reviewers inspect evidence while Docker runs the interactive prototype. |
| 06:03–06:15 | The playground provides language and theme controls. Browser checks exercised keyboard navigation, contrast and zoom. The release CI also checked compilation, tests, secret scanning and a Docker smoke run. |
| 06:15–06:27 | Start Docker, follow the README quick start and run pnpm demo:docker. Open localhost:5174, run a valid control, then choose a signature fault. Compare the two reports with the sample test data and dated evidence. |
| 06:27–06:46 | Choose the issuer, holder, verifier and format. POST /api/v1/runs returns HTTP 202 and a run ID. Follow ten named steps from issuance to verification. Socket.IO delivers summaries and polling recovers missed updates. |
| 06:46–07:07 | Open a completed run in history. Select a timeline step to inspect its sanitized request and response. Play the sequence to see who contacted whom. Export Mermaid source to include that sequence in an issue or report. |
| 07:07–07:26 | Select two different run IDs. Compare configuration, steps and outcome. Download an individual report as JSON or Markdown. Export the compatibility matrix as JSON, CSV or Markdown. Historical records retain their evidence tier. |
| 07:26–07:45 | HAR covers recorded browser traffic. The hosted bridge accepts allowlisted route metadata. The local forwarding proxy observes Mimoto server calls to Certify and Verify. Native-wallet internals and unrecorded traffic remain outside capture. |
| 07:45–08:05 | The physical Android SD-JWT run used local Certify and hosted Verify. The operator reopened the wallet and shared the same card. The correlated proof result was valid. This manual record has no managed run ID. |
| 08:05–08:26 | Hosted managed run 3dc6895d and local managed run f5f56b45 have separate provenance. The local report links the exact-card reload, captured server exchanges and both successful proofs. The later interactive PKCE journey used a separate browser harness. |
| 08:26–08:46 | The tagged CI ran automated checks. Scheduled local-stack jobs produce dated evidence when executed. Build, test and audit results belong to their recorded commits. The clean-checkout report separately describes the machine and commands actually exercised. |
| 08:46–09:03 | Start with TEST_DATA.md for synthetic inputs and expected outcomes. TEST_EVIDENCE.md links recorded checks. API_REFERENCE.md gives request and response formats. Open GAPS.md for reproduction pointers, versions and reporting status. |
| 09:03–09:23 | Collab issuer key handling differed for did:jwk and X.509. Managed JSON-LD runs closed the earlier Web access blocker. Hosted versions were unreported. Farmer authorization code with PKCE succeeded where another tested pre-authorized profile stopped. |
| 09:23–09:41 | Verify 0.18.2 lacked three database columns in its sample initialization. Aligning the schema restored a valid result. G-06 and G-07 were reported privately. G-08 records the original walt.id profile study. |
| 09:41–10:00 | Mimoto advertised an Ed25519 proof that Certify alpha rejected. Certify 0.14 accepted the matching-key flow. A separate DID document referenced the issuer DID in assertionMethod where the signing verification-method identifier was needed. |
| 10:00–10:20 | Issuer and authorization-server discovery aliases moved offer resolution forward. A later receive call still failed. On the verifier path a media-type adapter changed HTTP 406 into successful retrieval. The wallet then stopped on audience validation. |
| 10:20–10:38 | The verifier example requested a different credential type from the issuer example. The independent mDL check established signature and digest integrity. Controlled SD-JWT tests isolated certificate availability on two Verify releases. |
| 10:38–10:50 | The first case here, signature issuer, recorded invalid. |
| 10:50–11:02 | The first case here, credential type, recorded invalid. |
| 11:02–11:14 | The first case here, binding audience, recorded invalid. |
| 11:14–11:26 | The first case here, binding kb type, recorded invalid. |
| 11:26–11:38 | The first case here, replay consumed state, recorded invalid. |
| 11:38–11:50 | The first case here, disclosure digest mismatch, recorded invalid. |
| 11:50–12:02 | The first case here, structure malformed, recorded invalid. |
| 12:02–12:14 | The first case here, j1 signature corrupted, recorded invalid. |
| 12:14–12:26 | The first case here, j1 document altered claim, recorded invalid. |
| 12:26–12:38 | The first case here, j1 proof absent, recorded invalid. |
| 12:38–12:50 | The first case here, inji wrong nonce, recorded valid. |
| 12:50–13:02 | The first case here, inji bad issuer signature, recorded invalid. |
| 13:02–13:14 | The first case here, collab x509 control, recorded valid. |
| 13:14–13:26 | The first case here, collab did jwk control, recorded invalid. |
| 13:26–13:38 | The first case here, inji jsonld web, recorded valid. |
| 13:38–13:50 | The first case here, public-negative-pairs altered disclosure, recorded HTTP 200, invalid. |
| 13:50–14:02 | The first case here, jsonld-pairs signed expired, recorded HTTP 200, invalid. |
| 14:02–14:14 | The first case here, jsonld-pairs malformed body, recorded HTTP 400. |
| 14:14–14:29 | The first case here, grid Certify/reference/walt id, recorded signed request retrieval = 406. |
| 14:29–14:45 | The first case here, grid Certify/walt id/Inji Verify, recorded wallet resolve Certify offer = 500. |
| 14:45–14:59 | The first case here, grid walt id/walt id/walt id, recorded verifier accepted credential = true. |
| 14:59–15:11 | The first case here, certify-offer-to-walt-wallet-sd-only, recorded wallet resolve Certify offer HTTP 500. |
| 15:11–15:23 | The first case here, collab x509 bad signature, recorded invalid. |
| 15:23–15:35 | The first case here, collab MockVerifiableCredential SD JWT, recorded credential HTTP 401. |
| 15:35–15:55 | The first case here, grid discovery walt id, recorded signed request retrieval = 406. |
| 15:55–16:07 | The first case here, openwallet credential damaged signature, recorded rejected. |
| 16:07–16:19 | The first case here, inji alpha request-routing, recorded advertised HTTP 404, service route HTTP 200. |
