# Silent walkthrough · voice-over script

Read each line during its time range. During the matrix appendix, the individual records remain visible on screen.

| From–to | What to say |
|---|---|
| 00:00–00:12 | Can a credential issued by one system survive storage in a wallet and verification by another? Team Bhole Chature follows each exchange from offer to verdict. |
| 00:12–00:24 | The registry describes issuers, wallets, formats and flows. Inspect a party before choosing a scenario. The capabilities view also compares measured QR sizes. |
| 00:24–00:36 | Run the baseline first. The mock issuer issued a synthetic credential, the holder presented it, and the verifier returned the expected verdict. |
| 00:36–00:48 | Corrupt the issuer signature. The credential now fails verification. The test passes because the rejection matches the expected outcome. Signed expiry, wrong type and missing disclosure have separate scenarios. |
| 00:48–01:00 | The hosted Inji Web wallet stored a Land Registry Registration Receipt. The card survived a refresh. A managed run connected the presentation to an independent Verify result. |
| 01:00–01:12 | Certify 0.14 issued JSON-LD. Inji Web 0.17 and Mimoto 0.22 stored the card. After reload, the same wallet presented it to Verify 0.18.2. Synthetic authorization and DID adapters were enabled. |
| 01:12–01:24 | The inspector shows the permitted credential-subject field names. The browser bridge and local proxy distinguish wallet transport from downstream verification. Run-scoped tags correlate observations without exposing their raw values. |
| 01:24–01:36 | A missing hop stays unobserved. Synthetic HAR import strips sensitive fields before storage. Regression checks exercise stored rows, API responses and socket events. |
| 01:36–01:48 | The interactive synthetic UIN and OTP flow exercised authorization code with PKCE. Local Verify accepted both JSON-LD proofs after reload. A separate reference-holder control completed pre-authorized SD-JWT issuance. |
| 01:48–02:00 | A physical Android wallet received a credential from local Certify and presented it to hosted Verify. That hybrid run returned Valid. An all-local Android verdict with a playground run ID remains open. |
| 02:00–02:12 | The native walt.id wallet completed its own issuance and presentation. For a Certify offer, discovery aliases and an SD-JWT-only catalog advanced resolution to HTTP 200. Receiving the credential then stopped at 400. |
| 02:12–02:24 | A separate Verify request reached the wallet after a media-type adapter. The signed request omitted an audience expected by the wallet. Attribution depends on the OpenID4VP discovery profile. |
| 02:24–02:36 | Keep the issuer identifier and signing key fixed. On both Verify releases, ES256 and RS256 failed without a certificate and passed with one. The native walt.id credential also passed with its matching PEM chain. |
| 02:36–02:48 | Collab issued an ISO mobile driving licence. Inji verification was unsuccessful. An independent library verified the issuer signature and six attribute digests. Device authentication and certificate trust were outside that check. |
| 02:48–03:00 | PixelPass compressed the 96-claim JSON-LD sample enough to fit QR version 39 at error correction M. The measurement covers encoding. A physical scan is a separate experiment. |
| 03:00–03:12 | A local verifier generated a native request link and a Digital Credentials API request. Chromium opened its chooser. A provider-backed verdict remains open. Mimoto 0.22 signing support for Inji Web SD-JWT is a source-level finding. |
| 03:12–03:24 | The matrix indexes 79 observations, including controls, stopped attempts and adapter comparisons. Compare the last successful step, format and version before interpreting a verdict. The register tracks 15 findings. |
| 03:24–03:36 | Exports preserve versions, timestamps and exchange references. Telemetry groups success and latency by flow. The read-only archive lets reviewers inspect evidence while Docker runs the interactive prototype. |
| 03:36–03:48 | The playground provides language and theme controls. Browser checks exercised keyboard navigation, contrast and zoom. The release CI also checked compilation, tests, secret scanning and a Docker smoke run. |
| 03:48–04:00 | Start Docker, follow the README quick start and run pnpm demo:docker. Open localhost:5174, run a valid control, then choose a signature fault. Compare the two reports with the sample test data and dated evidence. |
| 04:00–04:19 | Choose the issuer, holder, verifier and format. POST /api/v1/runs returns HTTP 202 and a run ID. Follow ten named steps from issuance to verification. Socket.IO delivers summaries and polling recovers missed updates. |
| 04:19–04:40 | Open a completed run in history. Select a timeline step to inspect its sanitized request and response. Play the sequence to see who contacted whom. Export Mermaid source to include that sequence in an issue or report. |
| 04:40–04:59 | Select two different run IDs. Compare configuration, steps and outcome. Download an individual report as JSON or Markdown. Export the compatibility matrix as JSON, CSV or Markdown. Historical records retain their evidence tier. |
| 04:59–05:18 | HAR covers recorded browser traffic. The hosted bridge accepts allowlisted route metadata. The local forwarding proxy observes Mimoto server calls to Certify and Verify. Native-wallet internals and unrecorded traffic remain outside capture. |
| 05:18–05:38 | The physical Android SD-JWT run used local Certify and hosted Verify. The operator reopened the wallet and shared the same card. The correlated proof result was valid. This manual record has no managed run ID. |
| 05:38–05:59 | Hosted managed run 3dc6895d and local managed run f5f56b45 have separate provenance. The local report links the exact-card reload, captured server exchanges and both successful proofs. The later interactive PKCE journey used a separate browser harness. |
| 05:59–06:19 | The tagged CI ran automated checks. Scheduled local-stack jobs produce dated evidence when executed. Build, test and audit results belong to their recorded commits. The clean-checkout report separately describes the machine and commands actually exercised. |
| 06:19–06:36 | Start with TEST_DATA.md for synthetic inputs and expected outcomes. TEST_EVIDENCE.md links recorded checks. API_REFERENCE.md gives request and response formats. Open GAPS.md for reproduction pointers, versions and reporting status. |
| 06:36–06:56 | Collab issuer key handling differed for did:jwk and X.509. Managed JSON-LD runs closed the earlier Web access blocker. Hosted versions were unreported. Farmer authorization code with PKCE succeeded where another tested pre-authorized profile stopped. |
| 06:56–07:14 | Verify 0.18.2 lacked three database columns in its sample initialization. Aligning the schema restored a valid result. G-06 and G-07 were reported privately. G-08 records the original walt.id profile study. |
| 07:14–07:33 | Mimoto advertised an Ed25519 proof that Certify alpha rejected. Certify 0.14 accepted the matching-key flow. A separate DID document referenced the issuer DID in assertionMethod where the signing verification-method identifier was needed. |
| 07:33–07:53 | Issuer and authorization-server discovery aliases moved offer resolution forward. A later receive call still failed. On the verifier path a media-type adapter changed HTTP 406 into successful retrieval. The wallet then stopped on audience validation. |
| 07:53–08:11 | The verifier example requested a different credential type from the issuer example. The independent mDL check established signature and digest integrity. Controlled SD-JWT tests isolated certificate availability on two Verify releases. |
| 08:11–08:23 | The first case here, signature issuer, recorded invalid. |
| 08:23–08:35 | The first case here, credential type, recorded invalid. |
| 08:35–08:47 | The first case here, binding audience, recorded invalid. |
| 08:47–08:59 | The first case here, binding kb type, recorded invalid. |
| 08:59–09:11 | The first case here, replay consumed state, recorded invalid. |
| 09:11–09:23 | The first case here, disclosure digest mismatch, recorded invalid. |
| 09:23–09:35 | The first case here, structure malformed, recorded invalid. |
| 09:35–09:47 | The first case here, j1 signature corrupted, recorded invalid. |
| 09:47–09:59 | The first case here, j1 document altered claim, recorded invalid. |
| 09:59–10:11 | The first case here, j1 proof absent, recorded invalid. |
| 10:11–10:23 | The first case here, inji wrong nonce, recorded valid. |
| 10:23–10:35 | The first case here, inji bad issuer signature, recorded invalid. |
| 10:35–10:47 | The first case here, collab x509 control, recorded valid. |
| 10:47–10:59 | The first case here, collab did jwk control, recorded invalid. |
| 10:59–11:11 | The first case here, inji jsonld web, recorded valid. |
| 11:11–11:23 | The first case here, public-negative-pairs altered disclosure, recorded HTTP 200, invalid. |
| 11:23–11:35 | The first case here, jsonld-pairs signed expired, recorded HTTP 200, invalid. |
| 11:35–11:47 | The first case here, jsonld-pairs malformed body, recorded HTTP 400. |
| 11:47–12:02 | The first case here, grid Certify/reference/walt id, recorded signed request retrieval = 406. |
| 12:02–12:18 | The first case here, grid Certify/walt id/Inji Verify, recorded wallet resolve Certify offer = 500. |
| 12:18–12:32 | The first case here, grid walt id/walt id/walt id, recorded verifier accepted credential = true. |
| 12:32–12:44 | The first case here, certify-offer-to-walt-wallet-sd-only, recorded wallet resolve Certify offer HTTP 500. |
| 12:44–12:56 | The first case here, collab x509 bad signature, recorded invalid. |
| 12:56–13:08 | The first case here, collab MockVerifiableCredential SD JWT, recorded credential HTTP 401. |
| 13:08–13:28 | The first case here, grid discovery walt id, recorded signed request retrieval = 406. |
| 13:28–13:40 | The first case here, openwallet credential damaged signature, recorded rejected. |
| 13:40–13:52 | The first case here, inji alpha request-routing, recorded advertised HTTP 404, service route HTTP 200. |
