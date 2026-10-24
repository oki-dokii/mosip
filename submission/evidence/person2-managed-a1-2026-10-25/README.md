# Fresh playground-managed Inji Web A1

Observed 25 October 2026, Asia/Kolkata (API timestamps use UTC, starting 24 October at 21:31:34Z).

Run **`3dc6895d-ff87-45a2-a10b-46844198d83e`** completed with all ten steps succeeded, normalized outcome **`valid`**, and `correct_acceptance` evaluation. This is a fresh managed run, separate from the 23 October manual journey. The operator used the dedicated persistent account, unlocked privately by the user, and the public sandbox Land Registry identity.

## Same-run chain

| Checkpoint | Recorded proof |
| --- | --- |
| Issuer profile | Public metadata HTTP 200 from `https://injicertify-landregistry.collab.mosip.net`; `RegistrationReceiptCredential`, `ldp_vc` |
| Issuance transport | Exchange `91a946f2-d5df-47fb-a4ee-c9655f76e485`; browser → Mimoto credential POST, HTTP 200; `mimoto-wallet-credential` |
| Persistent storage | Receipt visible after wallet reload; operator submitted the live storage confirmation for this run after its issuance checkpoint; STORE records `wallet_confirmation` |
| Verifier request | Playground-created Verify transaction; request creation HTTP 201 and signed request retrieval HTTP 200; DCQL Registration Receipt type URI |
| Correlated presentation | Exchange `78522d51-2ccc-453a-a44b-d1fa16918e10`; browser → Mimoto presentation POST, HTTP 200; request-URI HMAC matched this run's backend-created request; later sequence than issuance |
| Independent verifier result | Playground fetched `VP_SUBMITTED`, then its transaction's result; HTTP 200, `allChecksSuccessful: true`, normalized `valid` |

See the original API exports: [run report](run-report.md), [JSON report](run-report.json), [run](run.json), [steps](steps.json), [exchanges](exchanges.json), [browser coverage](capture-coverage.json), and [matrix](matrix.json). UI evidence: [persistent cards after reload](stored-after-refresh.png) and [completed playground run](playground-completed.png).

## Provenance and limits

- The metadata bridge processed the fresh recording locally. No HAR, credential, VP token, cookies, login material, or bridge token is included here. The opaque request URI was sent transiently to the loopback BFF and replaced with a run-scoped HMAC before persistence. The same BFF process created the verifier request and evaluated the presentation correlation.
- Issuance and presentation are browser → Mimoto transport observations. Mimoto → Certify and Mimoto → Verify server-side traffic was not observed; both downstream-observed flags remain false. Storage is an explicit operator assertion backed by a reload screenshot, not a HAR inference. No cryptographic comparison of issued and presented credential bytes is claimed.
- The first cumulative presentation import stopped on a duplicate issuance entry, incorrectly reported as `CAPTURE_BRIDGE_INVALID`. Diagnostic replay submitted the same collector-produced minimal observations individually: the issuance duplicate was rejected, and the genuine correlated presentation was accepted. No fabricated observation, fixture injection, or relaxed correlation was used. A regression fix now acknowledges duplicates and continues the normal cumulative import.
- The original exports are preserved unchanged. They expose a version-label defect: `serviceVersions.wallet` says `reference-wallet/0.1.0` even though `config.wallet` is correctly `inji_web_assisted`. The actual hosted wallet version is **unreported**; the accompanying fix prevents this label on subsequent runs.
- Shared evidence-tier policy still calls assisted wallets `unverified`. This run's actual normalized result is `valid`; that result does not change the frozen evidence-tier schema, attest deployed versions, or establish general JSON-LD conformance.
- The test BFF used memory storage. These committed exports preserve the actual run after that process stops; they are not an automatic seed for new playground databases. The matrix export includes this actual run. Catalog links identify the archived run without fabricating a new run in an empty database.
- A1's managed technical checkpoints are observed. Final team/integrator review remains a separate approval.
