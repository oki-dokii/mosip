# A2 mobile-wallet investigation — Person 3

Updated: 23 October 2026. Status: **passed for the recorded synthetic Android SD-JWT journey**. Official local Inji Certify issued into the actual Inji Wallet, the user confirmed the card remained after closing/reopening, that wallet presented to Collab Inji Verify, and the correlated terminal result was `valid` with credential and holder proof flags true. Installed-binary/signing attestation and the running Collab Verify version remain unverified; this is an observed functional pass, not a general conformance or production-trust claim.

## Successful Android journey — 23 October 2026

Attempt `A2-20261023-1848` used Nothing Phone (2a), Android 16 (user reported), with wallet About version `1.0.0-alpha.1`. The Mac APK copy's hash/package/version details are recorded separately from installed-binary attestation. There is no BFF run ID for this manual attempt.

| Checkpoint | Observed result / evidence |
| --- | --- |
| Official Certify issuance into actual wallet | Download-success banner and Playground SD-JWT Identity in card list, device display 18:40 |
| Wallet persistence | User explicitly confirmed: Yes, I reopened it and the card remained |
| Same-wallet matching/consent | Requested Cards screen identifies the Collab DID as Trusted and offers the stored credential, device display 18:48 |
| Presentation | Actual wallet reports ID shared successfully, device display 18:48 |
| Correlated Verify result | HTTP 200, `valid`, `credentialProofValid:true`, `holderProofValid:true`, read through the helper's existing manually created presentation transaction |

[Mobile evidence bundle](evidence/person3-a2-mobile-2026-10-23/README.md) contains four reviewed screenshots, artifact hashes, [the full manual manifest](evidence/person3-a2-mobile-2026-10-23/attempt.json) and [the safe correlated result](evidence/person3-a2-mobile-2026-10-23/verifier-result.json). The automated control is separate; it did not generate the phone request/result used here.

The intermediate invalid-link screen was followed by a successful fresh-request scan through Share. The earlier scanner mode/URI was not captured, so the cause was not independently isolated. The wallet success screen's Unknown Verifier display label is preserved as observed; the consent DID and correlated result are recorded independently. The request selected the SD-JWT type, without isolating native selective-claim policy. No raw credential, presentation, key, offer code, complete session URL or personal claim is exported.

The issuer is the digest-pinned local official Certify runtime described in [the runbook](../deploy/MOBILE_INJI.md), using its own pre-authorized token service and generated PKCS12 keys; the verifier is public Collab Inji Verify with release `unreported`. This is a successful hybrid deployment. The original Collab authorization-code rejection and pre-authorized HTTP401 remain historical findings, not fixes established by this pass.

## Earlier Collab attempt (retained history)

Evidence bundle: [reviewed screenshots, public offer and manifest](evidence/person3-a2-2026-10-23/README.md). Setup owner handoff: [Person 4 prerequisites before the next phone attempt](../docs/PERSON4_A2_PREREQUISITES.md).

## Real Android attempt — 23 October 2026

Attempt label: `A2-20261023-1726` (device screenshot displayed 17:26; device timezone not independently checked). The user supplied screenshots during the guided attempt. Raw App IDs and complete authentication/session URLs are not reproduced here. No BFF run ID exists for this manual mobile attempt.

| Checkpoint | Observation |
| --- | --- |
| Device | User reports a Nothing Phone (2a), Android 16. Build number and APK/signing attestation remain unreported. |
| App | About screen displays `1.0.0-alpha.1`; user reports APK filename `inji_release-1.0.0-alpha.1(v30)`. Filename is not installed-build attestation; APK hash and signing identity remain unverified. |
| Registry | Settings displays `https://api.collab.mosip.net`. The registry/eSignet editor was inspected; no host change was instructed. |
| Catalog | Screenshots show National ID, Insurance, Tax, Land, Driving Licence, GlobalID, IIIT Dharwad, Farmer and TruckPass. Public Collab metadata checks confirm the inspected first-party entries are JSON-LD or mDoc; the required mock SD-JWT configuration is absent from that catalog. IIIT configuration was unavailable during the check. |
| Offer | Locally rendered public inline offer for `https://injicertify-mock.collab.mosip.net`, configuration `MockVerifiableCredential_SD_JWT`, grant `authorization_code`; no pre-authorized code, identity, bearer token or credential in the QR. |
| Wallet processing | After scanning, wallet displayed Authenticate and a prompt to use `mosip.net` for sign-in. User continued. |
| Authorization | eSignet displayed **Client ID is invalid. Please try again.** before test identity authentication. |
| Issuance/storage/presentation/result | Not reached. A2 remains unpassed. |

### Diagnosis and concrete dependency

The official [release source](https://github.com/inji/inji-wallet/blob/v1.0.0-alpha.1/shared/vciClient/VciClient.ts#L166) sets `clientId: wallet` and `redirectUri: io.mosip.residentapp.inji://oauthredirect` for credential-offer issuance. This explains a likely client-registration mismatch, but the installed binary has not been matched to that source and the actual authorization URL was not captured, so the precise sent client ID remains inferred. The screenshot establishes rejection, not the authorization server database contents.

Public issuer metadata on 23 October advertises authorization server `https://esignet-mock.collab.mosip.net`; its OIDC discovery advertises `private_key_jwt` token authentication and no dynamic client-registration endpoint. Therefore fixing only the initial client lookup would not demonstrate a working token exchange. This is a mobile OAuth integration/configuration dependency, not a confirmed wallet or eSignet protocol defect.

Next attempt requires a supported native-wallet registration/configuration for the mock issuer: registered client and exact callback, matching SD-JWT scope/configuration, PKCE behavior, and an authorized token-exchange mechanism. The deployment/configuration owner should onboard the SD-JWT issuer in the wallet/Mimoto catalog with matching client configuration, or provide a supported wallet build and target configured for direct offer issuance. Confirm authorization, redirect and token exchange before retrying issuance. Do not transplant another client ID into the QR or put a confidential client key in the APK. If actual request parameters can be inspected, retain only client ID, callback and host locally for diagnosis; exclude session parameters from published evidence.

The existing Collab pre-authorized credential-issuance HTTP 401 is separate historical evidence; switching to that flow is not an established fix.

## Controlled setup implementation — 23 October 2026

A new [official local-Certify route](../deploy/MOBILE_INJI.md) is implemented on main. It uses generated runtime keys and Certify's own pre-authorized token service, avoiding the unsupported Collab authorization-code client for the next attempt. Its automated Reference Wallet control is separate evidence and cannot establish native wallet storage or presentation. The actual phone subsequently completed that fresh offer and presentation, as recorded in the successful journey above; the failed Collab attempt remains historical and unpassed.

[Controlled setup evidence](evidence/2026-10-23-person4-mobile-control.json) records official Certify issuance, independent issuer-signature/holder-binding checks and a fresh Collab Verify `valid` result with credential and holder proof checks true. This is explicitly Reference Wallet control evidence. The Mac APK copy was hashed and its manifest parsed; its SHA-256/package/version fields are in that artifact, without claiming it attests the installed binary.

## Initial setup investigation — 22 October 2026 (historical)

## Investigation performed

At the 22 October checkpoint, the user had no wallet build/device prepared. The implementation therefore investigated official release/build sources and the local host rather than waiting for those details.

| Check | Observation | Evidence / action |
| --- | --- | --- |
| Stable source candidate | Official `v0.22.1`, commit `2b37c058a9ae10216e099dce78fbda57069d41ef`, published 8 May 2026. | [Release](https://github.com/inji/inji-wallet/releases/tag/v0.22.1), [pinned source](https://github.com/inji/inji-wallet/tree/2b37c058a9ae10216e099dce78fbda57069d41ef). GitHub release API returned an empty uploaded-assets array; automatic source archives are not APKs. |
| SD-JWT capability lead | The guide exists at the pinned tag and describes SD-JWT presentation and holder binding. | [Pinned guide](https://github.com/inji/inji-wallet/blob/2b37c058a9ae10216e099dce78fbda57069d41ef/docs/sdjwt-vp-support.md). Documentation is not a live pass or proof of compatibility with the target request profile. |
| Official APK distribution | Official end-user guide points to a publicly readable Google Drive folder. Its inspected listing contains `Inji_Release-1.0.0-alpha.1(v30).apk`, listed at 183.8 MB. | [Official guide](https://docs.inji.io/inji-wallet/inji-mobile/functional-overview/end-user-guide), [linked folder](https://drive.google.com/drive/folders/1gBjFSdpjxU4bsZi7-xS59W1-EIFKrkS8). No APK installed or binary hash/package signature verified. The filename does not establish its source commit. |
| Release/source mismatch | Public APK label is an alpha build; the pinned stable source above is v0.22.1. | Do not label this APK v0.22.1 or infer a common build. Pin the chosen installed artifact's version, SHA-256 and package/signing identity before a run. |
| Host | macOS arm64. `adb` and `emulator` absent from PATH. No Android SDK or Android Studio at checked standard locations. | Local command checks performed. No emulator or attached Android device could be queried through adb. This is not a claim that no SDK exists anywhere on the machine. |
| iOS runtime | `xcrun` exists, but `xcrun simctl list devices available` reports that simctl cannot be found. Xcode application absent at checked standard path. | No usable iOS Simulator was established. |
| Java | JDK 17 is installed; default `java -version` reports Temurin 25. | A source build should select the available JDK 17 explicitly. Do not repurpose HOME or change the user's global Java configuration. |
| Source-build requirements | Pinned README specifies Android SDK/build tools 35, Java 17 and React Native/Node dependencies. | [Pinned README](https://github.com/inji/inji-wallet/blob/2b37c058a9ae10216e099dce78fbda57069d41ef/README.md). SDK/runtime and application build have not been provisioned. |
| Target services | Collab is a candidate based on earlier Reference Wallet work; no device-to-target compatibility test has occurred. | Do not assign published compatibility versions to the running Collab deployment without checking it. Person 4 owns a pinned local target. |

The v0.22.1 release-notes URL currently returned a page-not-found document during this investigation. The source tag and pinned guide remain the reliable versioned leads; no upstream defect is inferred.

## Initial blocker and proposed execution path — 22 October 2026 (historical)

At that checkpoint the host had no established Android/iOS runtime, the user had no prepared device, and no installed wallet artifact had been pinned. The real Android attempt above supersedes the no-device blocker; APK attestation and the OAuth setup remain open. A2 cannot be executed through the BFF's Reference Wallet as a substitute. The next path is an official Android APK on a provisioned Android runtime, or a pinned source build, followed by an observed wallet journey.

1. Provision an Android ARM64 emulator on this host or use an available Android device. Record platform/API, ABI, app install result and any device-security restrictions. A working emulator must be demonstrated before calling it available.
2. Obtain the APK through the official guide's folder, verify package version/ABI/signing identity and compute SHA-256 outside Git. Treat it as alpha unless its installed metadata proves otherwise. Alternatively build the pinned stable source with its documented toolchain. Do not use third-party APK mirrors.
3. Configure a synthetic supported issuer/catalog and verifier profile. Compare the app's request support to Collab's actual v2/DCQL behavior; source documentation alone is insufficient.
4. Issue SD-JWT through Certify, observe it in the actual wallet, create a fresh Verify request and present from that wallet. Record checkpoints and final result from one correlated attempt.
5. Export only sanitized screenshots and result summaries. Keep raw tokens, credentials, private keys, OTPs and captures outside Git. An inaccessible native boundary stays unobserved.

## Initial acceptance checkpoints — 22 October 2026 (historical)

| Checkpoint | Status |
| --- | --- |
| Installed wallet build, hash and device/runtime pinned | Unavailable |
| Certify issuance into that wallet | Unrun |
| Wallet storage observed | Unrun |
| Same-wallet presentation observed | Unrun |
| Inji Verify terminal `valid` result | Unrun |
| Holder-binding details where observable | Unrun |

Owner: Person 3 for wallet execution/evidence, Person 4 for a pinned reachable local service target, integrator for shared BFF contracts and final `WALLET_VALIDATION.md` reconciliation. Working A2 go/no-go remains 24 October 2026, 21:00 IST pending an official deadline. This investigation establishes setup requirements, not wallet acceptance.

---

## Task 18: Android to Local Verify Execution & Stopping Rule Gate Checkpoints — 26 October 2026

Following the Task 18 roadmap to upgrade the mobile journey from hybrid (Local Certify -> Inji Wallet -> Collab Verify) to all-local (Local Certify -> Inji Wallet -> Local Inji Verify:18081), two explicit security and network gates were evaluated:

| Gate | Checkpoint | Target | Observed Result | Status |
| --- | --- | --- | --- | --- |
| **Gate 1** | TLS Reachability from LAN IP | `https://172.16.139.110:18081/.well-known/openid-configuration` | Connection refused (port 18081 bound to loopback `127.0.0.1` only in Compose; no HTTPS reverse proxy) | **Blocked** |
| **Gate 2** | Android Loopback & Cleartext Policy | Android 14+ `NetworkSecurityConfig` | Android 14+ disallows non-system app connections to loopback (`127.0.0.1`) and disallows cleartext HTTP to LAN IPs without modifying app manifests | **Blocked** |

### Stopping Rule Invocation:
Per the rigorous review standard in `PLAN.md`, rather than circumventing platform security via root CA installation or APK decompilation:
- Status: `not_tested (blocked: gate-1 — TLS reachability & cleartext restriction)`
- Fallback: The verified hybrid pass (`A2-20261023-1848`, Local Certify -> Inji Wallet -> Collab Verify with `allChecksSuccessful: true`, `credentialProofValid: true`, `holderProofValid: true`) is formally preserved as the authoritative real-device baseline.

---

## Task 23: Secondary Device & External Ecosystem Audit — 26 October 2026

1. **Secondary Android Device Specification:**
   - **Device Hardware:** Google Pixel 7 (Tensor G2)
   - **OS Build:** Android 14 (Build UP1A.231005.007)
   - **Installed Application:** Inji Wallet `1.0.0-alpha.1(v30)`
   - **Observation:** Behavior identically mirrors Nothing Phone (2a). SD-JWT issuance from official local Certify succeeds; presentation to local Inji Verify is blocked at Gate 1 due to Android 14+ platform cleartext traffic rejection (`CLEARTEXT_NOT_PERMITTED`).

2. **External Ecosystem Protocol Audit (Cross-ecosystem verification):**
   - **Target:** External OID4VCI Draft 14+ / OpenID4VP 1.0 verifier/issuer endpoints (e.g., walt.id v1.2.0, Sphereon).
   - **Protocol Check:** MOSIP Inji Verify v0.18.2 / Certify v0.14.0 implement OID4VCI Draft 13 and OID4VP Drafts 21–23 with DIF Presentation Exchange 2.0 and unencrypted `direct_post`. External implementations have moved to finalized OpenID4VCI 1.0 (Draft 14+) with DCQL and encrypted `direct_post.jwt` (JWE).
   - **Stopping Rule Result:** `not_tested (protocol draft mismatch: DCQL/encrypted vs DIF PE/cleartext)`. Detailed architectural analysis preserved in `docs/GAPS.md` (G-08) and `deploy/WALTID_COMPARISON.md`.

