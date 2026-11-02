# SD-JWT issuer key comparison on 2 November 2026

The mock issuer used a did:jwk identifier and a matching signing key for every credential. Within each algorithm pair, the issuer, protected kid, payload, expiry, holder binding and disclosures were the same. The holder re-signed the presentation for each fresh request. Each release received the same issuer-signed credential bytes. A separate Certify credential passed end to end on both releases.

| Issuer | Algorithm | x5c certificates | Verify 0.18.2 (PEX) | Verify 1.0.0-alpha.1 (DCQL) |
|---|---|---:|---|---|
| Mock, did:jwk | RS256 | 1 | Valid | Valid |
| Mock, did:jwk | RS256 | 0 | Invalid | Invalid |
| Mock, did:jwk | ES256 | 1 | Valid | Valid |
| Mock, did:jwk | ES256 | 0 | Invalid | Invalid |
| walt.id 1.2.0, did:jwk | ES256 | 0 | Invalid | Invalid |
| walt.id 1.2.0, same profile with PEM chain | ES256 | 1 | Valid | Valid |
| Certify control | RS256 | 2 | Valid | Valid |

The four mock presentations without a certificate failed at the issuer signature check with `ERR_SIGNATURE_VERIFICATION_FAILED`. Adding the matching certificate restored verification for both algorithms. This isolates certificate availability for the tested did:jwk profiles. Both releases also rejected the native walt.id credential at that check. Using the v1.2.0 offer field credentials[].runtimeOverrides.x5Chain to supply one PEM certificate for the profile’s existing signing key changed the native result to valid on both releases. The returned JWT contained the requested leaf and retained the did:jwk issuer scheme, ES256 and cnf.jwk. A bare base64 certificate instead stopped issuance at HTTP 500. Certificate trust policy and other deployments require separate tests.

[Controlled pairs](evidence/2026-11-02-release/key-location.json) · [Native credential comparison](evidence/2026-11-02-release/walt-alpha.json)

To reproduce with the local profiles running, build the mock issuer and run `node scripts/verify-version-comparison.mjs /tmp/new-comparison.json`. The stable release listens on loopback port 18081 and the alpha on 18082. The alpha holder uses the root request and submission routes of the service as deployed. Pass a second path outside the repository to save the synthetic expiry, audience and replay controls privately. Each output path must be new. Negative results distinguish direct-post rejection from a fetched invalid verdict.

[Native no-chain repeat](evidence/2026-11-02-release/native-no-chain-repeat.json) · [Native PEM-chain run](evidence/2026-11-02-release/native-x5c-pem.json) · [Bare base64 input attempt](evidence/2026-11-02-release/native-x5c.json). Reproduce the pair with the reference grid flags `--diagnose-credential` and `--native-x5c`. The latter requires the disposable local issuer profile.
