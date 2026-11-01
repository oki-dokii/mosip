# Claims and evidence · 1 November 2026

| What the team demonstrated | Evidence and boundary |
|---|---|
| A local Certify credential survived a wallet reload and verified with Inji Verify. | [Managed JSON-LD run](evidence/2026-10-26-person2-local-ui/run-report.json). Inji Web 0.17.0, Mimoto 0.22.0, Certify 0.14.0 and Verify 0.18.2. Synthetic authorization and DID adapters are part of this setup. |
| Local pre-authorized SD-JWT issuance and verification succeeded. | [Inji reference-holder control](evidence/2026-11-01-waltid/inji-control.json). Certify 1.0.0-alpha.1 issued the credential. |
| The real walt.id wallet passed native issuance and presentation. Two cross-vendor paths stopped at resolution. | [First](evidence/2026-11-01-waltid/resolution-first.json) and [repeat](evidence/2026-11-01-waltid/resolution-repeat.json). The wallet returned 500 while resolving the Certify offer and the Verify request. |
| Collab issued an ISO mDL. Inji returned an unsuccessful verification result. An independent library verified the issuer signature and six attribute digests. | [Same-document result](evidence/2026-11-01-formats/collab-mdl.json). Library @auth0/mdl 3.0.1. Certificate-chain trust and device authentication were outside this check. |
| A local verifier created a native request link and a Digital Credentials API request. Chromium invoked the credential chooser. | [Browser record](evidence/2026-11-01-formats/browser-wallet.json). A provider-backed presentation and verifier verdict remain open. |
| The selected Inji Web backend cannot sign SD-JWT presentations through this signing method. | Mimoto v0.22.0 checks for LDP_VC and throws for other formats in [WalletPresentationServiceImpl](https://github.com/mosip/mimoto/blob/91692cde498d023fe141fd239f46779d6fbbe0ff/src/main/java/io/mosip/mimoto/service/impl/WalletPresentationServiceImpl.java#L291-L305). Source-level result. |
| A physical Android wallet completed a hybrid journey. | [Android record](A2_MOBILE_EVIDENCE.md). The verifier ran on Collab. The all-local Android BFF record awaits a phone operator. |
| 40 protocol cells have dated observations and positive-control references. | [Protocol matrix](protocol-matrix.json) contains 29 mock cells, seven local Inji cells and four hosted cells. |
| PixelPass made the 96-claim synthetic JSON-LD sample fit into QR version 39 at ECC M. | [Encoding measurements](../apps/web/src/data/qr.json). Physical scanning was outside the measurement. |
