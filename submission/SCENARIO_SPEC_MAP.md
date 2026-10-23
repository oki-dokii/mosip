# Current scenario expectations and specification references

Reviewed 22 October 2026 against primary specification text. This sidecar covers the ten scenarios currently in `apps/bff/src/scenarios.ts`; Person 3 should maintain it as new scenarios land. References below explain protocol expectations, not proof that the Collab deployment uses the final protocol edition. Pin the deployed profile/draft before alleging nonconformance.

| Scenario ID suffix | Scenario | Expected verdict and preconditions | Primary references |
| --- | --- | --- | --- |
| `000000000001` | Certify → Reference Wallet → Verify, SD-JWT | `valid` when issuance, issuer trust/profile, requested credential and holder proof are supported and correct | [OpenID4VCI 1.0 §3.4](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-3.4), [§8 Credential Endpoint](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-8), [OpenID4VP 1.0 §8.2 direct_post](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-8.2) |
| `000000000002` | Same roles, JSON-LD | `valid` under the selected supported JSON-LD/proof profile; changing format does not establish wallet-brand interoperability | [OpenID4VCI 1.0 §3.3.1 format profiles](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-3.3.1), [OpenID4VP 1.0 §5.6 vp_token](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-5.6) |
| `000000000003` | Mock issuer → Reference Wallet → Inji Verify | Harness target `valid`, conditional on supported issuer representation and configured trust; a self-issued or unsupported issuer is not entitled to acceptance merely by being standards-shaped | [OpenID4VCI 1.0 §3.3.1](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-3.3.1), [OpenID4VP 1.0 §8 Response](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-8) |
| `000000000004` | Corrupted signature | `invalid`; the verifier must reject a signature that fails validation. Person 3 must record whether a given test corrupts the issuer credential or holder presentation signature. | [RFC 7515 §5.2 JWS validation](https://www.rfc-editor.org/rfc/rfc7515.html#section-5.2) |

Stable IDs have prefix `f1571de0-0000-4000-8000-`. Expected verdicts are distinct from observed results and evidence tiers. Neither this sidecar nor capture decoding is a conformance certification. Pending probes such as canonical versus padded `did:jwk`, replay, wrong holder and forged `x5c` must get their own exact profile reference and synthetic reproducer before entering the catalog.

## Person 3 standalone local profile

The versioned catalog is `spikes/wallet-interop-cases.json`; its stable IDs, expected boundaries/stages/codes and applicability are separate from the original four BFF presets above. BFF presets `000000000005`–`000000000010` now cover the strict mock pair: valid control, bad issuer signature, signed expiry, signed wrong type, missing required disclosure and nonce mismatch, respectively. They require exact diagnostic reasons; expired credentials intentionally produce the local API outcome `invalid` with `CREDENTIAL_EXPIRED`. The remaining holder/audience/genuine-replay/state/profile cases stay independently executable HTTP harness cases. See `PERSON3_PROTOCOL_HANDOFF.md`.

`mock-sdjwt-flat-v1` is an explicit local testing profile: top-level given_name/family_name disclosures, SHA-256, immutable requested-claim policy and mandatory holder binding. Its request extension is not standardized DCQL syntax. Its `presentation_submission` test establishes unsupported-parameter enforcement; no Presentation Exchange conformance is asserted.

| Cases | Applicable expectation / reference |
| --- | --- |
| `p3.signature.issuer` | Reject issuer signature corruption: RFC 7515 §5.2. |
| `p3.credential.expired` | Reject a validly signed expired credential: RFC 7519 §4.1.4; local profile requires exp. |
| `p3.credential.type` | Reject unexpected vct under the explicit local credential-type policy; not an issuer-signature test. |
| `p3.holder.wrong_key`, `p3.holder.missing_binding` | Require holder proof bound to the issued key: RFC 9901 §7.3 under this profile's mandatory-binding policy. |
| `p3.binding.audience`, `p3.binding.nonce`, `p3.replay.fresh_challenge` | Reject presentations not bound to this verifier/challenge: RFC 9901 §7.3. The replay preserves exact previously accepted presentation bytes. |
| `p3.replay.consumed_state` | One accepted submission per local challenge: harness transport policy, distinct from cryptographic nonce replay. |
| `p3.disclosure.required`, `p3.disclosure.optional` | Verify disclosure commitments per RFC 9901 §4.2, then apply local requested-claim policy; optional omissions must remain valid. |
| `p3.profile.presentation_submission` | Reject a present unsupported parameter on this local profile. A malformed PE mapping is not interpreted as a PE conformance test. |

Primary references: [RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html#section-5.2), [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.4), [RFC 9901](https://www.rfc-editor.org/rfc/rfc9901.html#section-7.3). These local expectations cannot establish which protocol edition an external deployment implements. The sanitized dated artifact is `spikes/fixtures/wallet-interop-2026-10-22.json`.
