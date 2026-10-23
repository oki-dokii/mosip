# Person 3 live investigation — 22 October 2026

Scope: synthetic Reference Wallet traffic to public MOSIP Collab, with an ephemeral local mock issuer. No real Inji mobile wallet was used. Full redacted observations are in [the dated artifact](../spikes/fixtures/wallet-interop-live-2026-10-22.json). Source base is `5a5e83b10bbb3dfdf45e226955f00f17c4c6b2e7`, with uncommitted changes recorded by the artifact.

## Presentation results

| Probe | Observed boundary and outcome | Evaluation |
| --- | --- | --- |
| Self-signed X.509 issuer control | Submission accepted; result `allChecksSuccessful:true` | Correct acceptance; signature interoperability only, no root-trust claim |
| X.509 corrupted issuer signature | Submission accepted; result invalid, schema/signature check false | Inconclusive for the precise local signature code: upstream returns no versioned detailed diagnostic |
| X.509 fresh nonce mismatch | Direct-post HTTP 400, `invalid_request` | Rejection preserved at submission; no status timeout. Exact reason remains inconclusive |
| Canonical unpadded did:jwk issuer control | Submission accepted; result invalid | Unexpected rejection relative to the exploratory control; deployment/profile difference, not a confirmed defect |

The BFF negative evaluator deliberately does not pass these coarse upstream rejections as if a particular cryptographic check had been observed. `replay_nonce` is a newly signed nonce mismatch; actual byte replay and consumed-state reuse were separately tested against the local strict profile. The two issuer controls use independently generated keys and the corresponding required issuer representation; they are interoperability comparisons, not a byte-identical credential comparison.

## Pre-authorized grant reduction

Both `MockVerifiableCredential_SD_JWT` and `MockVerifiableCredential_VCDM2.0` followed this synthetic sequence:

1. Issuer metadata: HTTP 200; configuration advertised.
2. `POST /v1/certify/pre-authorized-data`: HTTP 200, synthetic claims only.
3. The offer contains a relative credential-offer URI. Resolve its bounded offer ID through the fixed issuer's `/v1/certify/credential-offer-data/:id`: HTTP 200.
4. Exchange the fresh pre-authorized code at `/v1/certify/oauth/token`: HTTP 200.
5. Fetch the advertised nonce: HTTP 200.
6. Generate a fresh ephemeral Ed25519 holder proof for the advertised issuer audience and nonce; call the advertised credential endpoint with that token and configuration: **HTTP 401**, no credential returned.

The returned access tokens were not decodable JWTs. Their issuer/audience/nonce/client-ID claim fields are therefore **unknown**, not missing. Tokens, proofs, codes, keys and claims are not exported. This reproduces the deployment behavior; it does not identify the server's internal authorization failure or prove a specification defect. Authorization-code/PKCE success remains separate historical evidence.

## Versions and existing upstream work

Both services returned HTTP 403 at `/actuator/info`. Certify `/v3/api-docs` returned 404; Verify returned an API description at 200, which does not attest the deployed release. Both running releases remain `unreported`.

Public upstream source was checked independently on 22 October 2026:

- VC verifier source reference: [`a85e9dc819769b3c496f00198e33b43d683e1c0f`](https://github.com/inji/vc-verifier/tree/a85e9dc819769b3c496f00198e33b43d683e1c0f). Its [README](https://github.com/inji/vc-verifier/blob/a85e9dc819769b3c496f00198e33b43d683e1c0f/README.md) still lists X.509 for SD-JWT.
- [Issuer-key resolution from metadata or DID, PR 290](https://github.com/inji/vc-verifier/pull/290) was merged on 27 August 2026 (`099536335073f9acc416bea6787caf6a5de10f71`). [Padded did:jwk resolution, PR 296](https://github.com/inji/vc-verifier/pull/296) was merged on 1 October 2026 (`38eb30f9e3b8915705649270535ffc065890ef39`). The README and merged implementation history differ; neither establishes the library running on Collab. Our control emits canonical unpadded base64url, so the padding change alone does not explain the observation.
- Certify source reference: [`e54539a89616f64dc90e8f6797db9e66d826d97d`](https://github.com/inji/inji-certify/tree/e54539a89616f64dc90e8f6797db9e66d826d97d). Existing [multiple authorization server work, PR 534](https://github.com/inji/inji-certify/pull/534) was merged on 21 January 2026. It is relevant configuration history, not proof of the cause of this 401.

Searches for pre-authorized/401 and SD-JWT/did:jwk issues and pull requests found relevant existing work; no exact matching confirmed deployment defect was established. No upstream issue or external message was sent. A deployment owner must provide image digests/configuration to assign either observation to a specific release or isolate its internal cause. No release version is inferred from a source branch, API generation or release tag.

## Reproduce

```sh
pnpm build
node spikes/wallet-interop-collab.mjs --target collab --out /tmp/new-person3-live.json
```

This command contacts the fixed public test services and creates synthetic short-lived offers/transactions. It uses no saved authentication files and creates a new owner-only artifact. Temporary signing files and listeners are removed. The script disables redirects, bounds responses and timeouts, restricts remote origins, and exports only safe reports/checkpoints. Final release pinning and mobile acceptance require external environment information; they are not implementation tasks this branch can fabricate.
