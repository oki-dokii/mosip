# A2 Android mobile attempt — 23 October 2026

**Status: blocked at authorization; A2 is not passed.** Attempt `A2-20261023-1726` has no BFF run ID. The installed wallet displayed version `1.0.0-alpha.1`; APK/build/device pinning is incomplete.

## Observed sequence

1. [Issuer catalog, upper entries](01-issuer-catalog-top.jpg) and [lower entries](02-issuer-catalog-bottom.jpg).
2. [Registry editor](03-registry-settings-dialog.jpg); the full eSignet value is clipped. No setting change was instructed.
3. Phone scans the [public SD-JWT authorization-code offer](authorization-code-offer.json), rendered in [this QR](authorization-code-offer.png). Open [the local QR page](authorization-code-offer.html) from a checkout to reproduce the offered input. It contains no code, token or credential.
4. Wallet shows [sign-in consent](04-sign-in-consent.jpg).
5. eSignet shows [Client ID is invalid](05-invalid-client.jpg), before test-identity authentication.

`attempt.json` records checkpoints, artifact SHA-256 hashes, provenance and limitations. The screenshots were supplied by the user, visually reviewed and copied without pixel edits. No EXIF/XMP marker was found; this is not a general binary-forensics audit. The project's text secret scanner does not inspect image contents.

The About/settings screenshots containing an installation App ID are deliberately withheld; the observed app version is transcribed in the report. APK hash, signing identity, device model, Android version and actual authorization parameters remain unreported. There is no issuance/storage/presentation/Verify success evidence to export.

See [A2 report](../../A2_MOBILE_EVIDENCE.md), [acceptance gates](../../../WALLET_VALIDATION.md), and [Person 4 prerequisites](../../../PERSON4_A2_PREREQUISITES.md). The likely OAuth-client mismatch is an inference from release source, not a confirmed upstream defect. The earlier pre-authorized credential HTTP 401 is a separate observation and not a demonstrated workaround.
