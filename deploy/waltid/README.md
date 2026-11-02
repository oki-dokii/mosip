# External wallet interoperability, walt.id 1.2.0
Run on Docker Desktop with Linux containers, Compose 2.24.4+ (override/reset tags) and Node 22. Ports 7004–7006 and 18081/18090 must be free or owned by these profiles. The launcher downloads only the official deployment tree from the pinned upstream revision and verifies its HEAD. It publishes three API ports on host loopback; Postgres is not published. The two Inji URLs remain unchanged inside the wallet via a fixed-port TCP relay. Never use these upstream development configurations for real credentials.

From the repository root, after installing dependencies:

```sh
deploy/waltid/run.sh up
MOBILE_COMPOSE_PROJECT=playground-external-certify MOBILE_RUNTIME_DIR="${TMPDIR:-/tmp}/playground-external-certify" bash scripts/demo-inji-local.sh
node deploy/waltid/probe.mjs /tmp/external-wallet-check.json
deploy/waltid/run.sh down
```

The Inji command must print LOCAL INJI DEMO PASS. The runner generates a new synthetic account, wallet, holder key, offers and requests each time. It prints only fixed checkpoint labels and statuses, and exits nonzero if a journey stops. An HTTP 200 from the wallet is insufficient: the issuing control checks storage, and the presentation control polls the independent verifier. Leave signature checks enabled. The SD-JWT type comes from live metadata, not a sample hostname in a Swagger example.

| Cell | Two fresh executions, 1 November |
|---|---|
| walt.id issuer → walt.id wallet | SD-JWT stored |
| walt.id wallet → walt.id verifier | SUCCESSFUL with presented credential |
| Inji Certify → walt.id wallet | Offer created; wallet receive returned HTTP 500 |
| walt.id wallet → Inji Verify | Verify created the request; wallet present returned HTTP 500; no Verify verdict |

[First run](../../submission/evidence/2026-11-01-waltid/first.json) · [repeat](../../submission/evidence/2026-11-01-waltid/repeat.json) · [Inji positive control](../../submission/evidence/2026-11-01-waltid/inji-control.json).
These observations establish two integration boundaries for this configuration, not two confirmed upstream defects. For follow-up, compare offer discovery versus issuer metadata resolution, and signed request retrieval versus presentation creation, one hop at a time.

Optional paired example check: append `--example-control` after the output filename. It requests the credential type from the verifier's published Swagger example, then compares it with the run using the issuer's actual metadata. Keep both observations; a failed session for a nonmatching type is the correct verifier behavior.

With `--diagnose` after the output filename, the runner stops at the first failed resolution step. In [two](../../submission/evidence/2026-11-01-waltid/resolution-first.json) [fresh sessions](../../submission/evidence/2026-11-01-waltid/resolution-repeat.json), the probe retrieved the Certify offer and issuer metadata with HTTP 200. Wallet API2 returned HTTP 500 on resolve-offer. The probe retrieved the compact Inji request object with HTTP 200. Wallet API2 returned HTTP 500 on resolve-request, before credential selection.

**Controlled adapter experiments (2 November).** With the local reference profile running, run `bash deploy/waltid/check-adapters.sh /tmp/new-walt-comparison` from a checkout. Use a new directory. The two sessions use fresh wallets, require native positive controls, preserve the signed request and restore the transparent relay on exit. The probe's direct host discovery check remains 404 because the alias affects only the wallet network namespace.

| Journey | [Observed control](../../submission/evidence/2026-11-02-walt-adapters/observe.json) | [Adapter](../../submission/evidence/2026-11-02-walt-adapters/adapt.json) and next failure |
|---|---|---|
| Certify → walt.id | Advertised discovery returned 404; wallet returned 500. | Forward the advertised discovery path to Certify's existing metadata endpoint: 200. Wallet then returned 400; its metadata parser rejected the LD signing-suite declaration for an advertised JSON-LD configuration before it could receive the SD-JWT. |
| walt.id → Verify | Wallet sent exactly `Accept: application/json,application/json`; request retrieval returned 406, surfaced as wallet 500. | Replace only that header with `application/oauth-authz-req+jwt`: retrieval returned 200. Wallet then returned 400 because the signed request audience did not satisfy its self-issued audience check. No direct-post or verifier verdict. |

The two parser explanations are from wallet logs, not HTTP reason phrases. The exported records contain only safe checkpoints and the allowlisted media header. These are additional external experiments; the main protocol matrix's 44 cells and the original HTTP 500 records are unchanged.

**Second-stage experiments, 2 November.** The [SD-JWT-only catalog](../../submission/evidence/2026-11-02-wallet-profile/sd-only.json) progresses past parsing the advertised JSON-LD configuration and then fails authorization-server discovery. The wallet returns HTTP 500 before token acquisition. The [full-catalog control](../../submission/evidence/2026-11-02-wallet-profile/control.json) stops earlier. Specifically, Certify publishes `credential_signing_alg_values_supported` for `PlaygroundIdentity_LDP_VC` inside `credential_configurations_supported` as `["EdDSA"]`. The live database row contains `signature_algo=EdDSA`, `signature_crypto_suite=Ed25519Signature2020` and `credential_signing_alg_values_supported={Ed25519Signature2020}`. The catalog publication differs from the configured suite. The wallet checks the whole catalog, so an unrelated entry blocks SD-JWT. The final issuance specification describes the field in the context of its credential format. [Issuer metadata](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-12.2.4).

The signed request included the configured verifier DID as client ID and omitted the audience. Changing only the deployment's public redirect URI produced the [same signed-claim observation and wallet 400](../../submission/evidence/2026-11-02-wallet-profile/public-url.json). The wallet's audience requirement agrees with OpenID4VP 1.0 static discovery. HTTP also permits Verify to return 406 when the wallet accepts JSON and the available representation is a signed request. These observations concern the tested profiles. [OpenID4VP §5.8](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-5.8) and [HTTP §15.5.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.7).

The [eight-cell SD-JWT grid](../../submission/evidence/2026-11-02-wallet-profile/sd-grid.json) uses the existing Certify-specific reference holder. Its token URL is fixed by that implementation. The two rows blocked on that URL describe a limitation of our holder. Rows with a shared issuance failure identify which verifier was never reached.
