# SD-JWT issuer key comparison on 2 November 2026

The mock issuer used a did:jwk identifier and a matching signing key for every credential. Within each algorithm pair, the issuer, protected kid, payload, expiry, holder binding and disclosures were the same. The holder re-signed the presentation for each fresh request. Each release received the same issuer-signed credential bytes. A separate Certify credential passed end to end on both releases.

| Issuer | Algorithm | x5c certificates | Verify 0.18.2 (PEX) | Verify 1.0.0-alpha.1 (DCQL) |
|---|---|---:|---|---|
| Mock, did:jwk | RS256 | 1 | Valid | Valid |
| Mock, did:jwk | RS256 | 0 | Invalid | Invalid |
| Mock, did:jwk | ES256 | 1 | Valid | Valid |
| Mock, did:jwk | ES256 | 0 | Invalid | Invalid |
| walt.id 1.2.0, did:jwk | ES256 | 0 | Invalid | Invalid |
| Certify control | RS256 | 2 | Valid | Valid |

The four mock presentations without a certificate failed at the issuer signature check with `ERR_SIGNATURE_VERIFICATION_FAILED`. Adding the matching certificate restored verification for both algorithms. This isolates certificate availability for the tested did:jwk profiles. Both releases also rejected the native walt.id credential at that check. The native issuer did not supply a matching certificate to test an adapted native pass. Certificate trust policy and other deployments require separate tests.

[Controlled pairs](evidence/2026-11-02-release/key-location.json) · [Native credential comparison](evidence/2026-11-02-release/walt-alpha.json)

To reproduce with the local profiles running, build the mock issuer and run `node scripts/verify-version-comparison.mjs /tmp/new-comparison.json`. The stable release listens on loopback port 18081 and the alpha on 18082. The alpha holder uses the root request and submission routes of the service as deployed. Pass a second path outside the repository to save the synthetic expiry, audience and replay controls privately. Each output path must be new. Negative results distinguish direct-post rejection from a fetched invalid verdict.
