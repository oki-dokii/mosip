# Same-wallet local Inji JSON-LD result — 26 October 2026 IST

**Result: Valid.** Official Certify 0.14.0 issued a synthetic Farmer credential into official Inji Web 0.17.0 / Mimoto 0.22.0. The exact issued credential remained in the same wallet after reload, was selected for consent/share, and local official Inji Verify 0.18.2 returned `allChecksSuccessful: true`, credential proof true and holder proof true.

The final check ran at **03:21 IST on 26 October** (`2026-10-25T21:51Z`) against committed source [`77d7d10`](https://github.com/oki-dokii/mosip/commit/77d7d10ec276deec06ae7d1553bd10947f2e934f), with a clean source tree before export. This is a direct browser/official-service test with a synthetic authorization fixture and explicit public DID adapter. It has no playground BFF run ID.

| Check | Observed result | Artifact |
| --- | --- | --- |
| Actual Web wallet issuance | Browser → Mimoto credential POST HTTP 200 | [issuance.json](issuance.json) |
| Exact card after reload | Reloaded wallet list contains the issued credential ID; public correlation flag true | [issuance.json](issuance.json), [stored screenshot](stored-after-reload.png) |
| Issuance key binding | Original wallet proof uses Ed25519; client/audience/nonce match; issued subject public key matches proof key | [proof-diagnostics.json](proof-diagnostics.json) |
| Same-wallet presentation | Wallet ID matches issuance; the selected credential is the exact issued ID | [presentation.json](presentation.json) |
| Wallet consent/share | Mimoto presentation create, credential selection and submit APIs HTTP 200 | [presentation.json](presentation.json), [share screenshot](wallet-share-success.png) |
| Independent local Verify result | HTTP 200, Valid, credential proof true, holder proof true | [presentation.json](presentation.json) |
| Versions and source | Digest-pinned official images, running image IDs, source commit and boundaries | [provenance.json](provenance.json) |

The screenshots show official Inji Web with a fixed synthetic identity. Stored cards include earlier synthetic trials; screenshot count is not the correlation proof. The browser check privately retains the newly issued card ID, verifies it in the reloaded list and selects that precise ID for presentation. Public artifacts export only the resulting booleans and route templates.

## Reproduce

Follow the prerequisites in the [local runbook](../../../deploy/INJI_WEB_LOCAL.md), then run:

```sh
pnpm demo:web-jsonld
```

A complete restart rehearsal printed `LOCAL INJI WEB JSON-LD DEMO PASS` before the implementation commit. The committed-source final evidence above repeats issuance and presentation with:

```sh
pnpm check:web-jsonld
pnpm check:web-presentation
```

The 13 script regression tests passed. JavaScript/shell syntax checks, Compose startup and the secret audit also passed. This was on the existing development Mac and persistent synthetic wallet database, not a clean-machine installation.

## Limits

- Product images are official and unpatched. The local identity provider and authorization bridge are project fixtures.
- The bridge seeds an isolated synthetic IAR session; official Certify performs token signing and credential issuance. Full IAR VP authorization and real eSignet authentication were not tested.
- The local HTTPS DID adapter serves the actual public keys and corrects Certify's `assertionMethod` reference. The credential template normalizes the same public key URI to Mimoto's `#0` convention. These adaptations are explicit; signed credentials, holder proofs, requests, states, nonces and VPs are not rewritten.
- The profile uses Certify 0.14.0 because the alpha release rejected Mimoto's Ed25519 proof. [Compatibility findings](../../../deploy/LOCAL_JSONLD_COMPATIBILITY.md) record the failed controls and version difference.
- Product services are local, while initial downloads and public JSON-LD contexts use network access. No general offline, HSM, trust-chain, revocation, negative-case or protocol conformance claim follows from this positive case.
- This does not upgrade the evidence tier of the separate [hosted managed A1 run](../person2-managed-a1-2026-10-25/README.md). Integrating this local harness with managed BFF capture and an independent-machine rehearsal remain separate work.
- Raw credential bodies, token/code/state/nonce values, cookies, private keys, private wallet/card IDs and session HAR are absent from this bundle.
