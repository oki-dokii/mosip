# Local wallet experiments

Use `pnpm run doctor` before starting. The two Certify versions share port 18090. Run the profiles sequentially.

| Flow | Start | Operator action |
|---|---|---|
| Pre-authorized SD-JWT | `pnpm demo:inji`, then `node scripts/local-issuance-console.mjs` | Open http://localhost:18102 and prepare the pre-authorized QR. The console names the synthetic recipient beside the offer. This grant needs no OTP. |
| Authorization code and PKCE | `INTERACTIVE_SYNTHETIC_AUTH=true pnpm demo:web-jsonld`, then start the same console | Choose the authorization-code QR, open Inji Web on the same machine, select Playground Synthetic Farmer, and enter the public fixture UIN and OTP printed beside the QR. A synthetic local authorization server validates these fixed values. The wallet obtains the credential from Certify. |
| Same-device and Digital Credentials API | `deploy/waltid/run.sh up`, then `node deploy/waltid/digital-wallet.mjs` | Open http://localhost:18101. Create the native request link or prepare a DC API request and click Choose a wallet. The verifier targets the issuer's advertised SD-JWT type. A compatible wallet provider is required to complete the last step. |
| Collab mDL | Use the official synthetic mock client environment and OTP as described in the README. Set `CREDENTIAL_CONFIGURATION_ID=DrivingLicenseCredential`, `CREDENTIAL_FORMAT=mso_mdoc`, `CREDENTIAL_SCOPE=sample_vc_mdoc` and `CERTIFY_BASE_URL=https://injicertify-mdl.collab.mosip.net`. Run `pnpm spike:wallet`. | The probe issues an mDL in memory, calls Verify's v2 credential endpoint with claims disabled and checks the same document using @auth0/mdl. Only result flags and counts are exported. |

The hosted wallet catalog's mDL metadata URL returned HTTP 404 on 1 November. The issuer responded at `/v1/certify/.well-known/openid-credential-issuer` and advertised `DrivingLicenseCredential`, `mso_mdoc` and ES256 proof of possession. See the [claims and evidence table](../submission/CLAIMS_AND_EVIDENCE.md) for the observed wallet signing limit, phone status and live results.
