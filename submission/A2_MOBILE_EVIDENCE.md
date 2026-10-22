# A2 mobile-wallet investigation — Person 3

Date: 22 October 2026. Status: **blocked before execution**. No issuance, storage, wallet presentation or real Inji verifier result has been observed during this implementation. Local mock protocol evidence does not close A2.

## Investigation performed

The user has no wallet build/device prepared. The implementation therefore investigated official release/build sources and the local host rather than waiting for those details.

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

## Exact blocker and next execution path

The available host has no established Android/iOS runtime, the user has no prepared device, and no installed wallet artifact has been pinned. A2 cannot be executed through the BFF's Reference Wallet as a substitute. The next path is an official Android APK on a provisioned Android runtime, or a pinned source build, followed by an observed wallet journey.

1. Provision an Android ARM64 emulator on this host or use an available Android device. Record platform/API, ABI, app install result and any device-security restrictions. A working emulator must be demonstrated before calling it available.
2. Obtain the APK through the official guide's folder, verify package version/ABI/signing identity and compute SHA-256 outside Git. Treat it as alpha unless its installed metadata proves otherwise. Alternatively build the pinned stable source with its documented toolchain. Do not use third-party APK mirrors.
3. Configure a synthetic supported issuer/catalog and verifier profile. Compare the app's request support to Collab's actual v2/DCQL behavior; source documentation alone is insufficient.
4. Issue SD-JWT through Certify, observe it in the actual wallet, create a fresh Verify request and present from that wallet. Record checkpoints and final result from one correlated attempt.
5. Export only sanitized screenshots and result summaries. Keep raw tokens, credentials, private keys, OTPs and captures outside Git. An inaccessible native boundary stays unobserved.

## Acceptance checkpoints

| Checkpoint | Status |
| --- | --- |
| Installed wallet build, hash and device/runtime pinned | Unavailable |
| Certify issuance into that wallet | Unrun |
| Wallet storage observed | Unrun |
| Same-wallet presentation observed | Unrun |
| Inji Verify terminal `valid` result | Unrun |
| Holder-binding details where observable | Unrun |

Owner: Person 3 for wallet execution/evidence, Person 4 for a pinned reachable local service target, integrator for shared BFF contracts and final `WALLET_VALIDATION.md` reconciliation. Working A2 go/no-go remains 24 October 2026, 21:00 IST pending an official deadline. This investigation establishes setup requirements, not wallet acceptance.
