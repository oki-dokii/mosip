# Person 3 protocol implementation handoff

Branch: `person3/protocol_correctness`. **Non-wallet implementation and live investigations complete.** Implementation and the original evidence were committed/pushed in `39fceaf`. On 23 October, the first Collab Android attempt failed client validation; a later official-local-Certify route completed A2 through the actual wallet with reopened storage and a correlated valid credential/holder proof result. See `submission/evidence/person3-a2-mobile-2026-10-23/README.md` for its scope/attestation limits. See `submission/A2_MOBILE_EVIDENCE.md` and `PERSON4_A2_PREREQUISITES.md`.

## What is implemented

- A bounded strict mock protocol profile, controlled signed semantic faults and twelve independent HTTP cases with positive controls/construction checks.
- Shared issuer signing and verifier verification cores reused by in-process and external HTTP BFF drivers.
- Signed expiry/type routing, strict policy negotiation, bounded async polling, preserved early rejection exchanges, and safe diagnostic propagation.
- Explicit terminal verdicts and exact expected outcome/boundary/stage/code evaluation. Missing results, service errors and generic negative reasons cannot produce a negative-case pass.
- Six controlled mock presets alongside the original four. Wrong holder, missing binding, audience, genuine byte replay, consumed state and unsupported presentation_submission remain deliberate harness cases; they are not mislabeled UI scenarios.
- Additive run/report/UI metadata derived from existing saved step JSON; no database migration. Historical records retain unknown detail. Matrix grouping separates scenario, profile and issuer representation.
- Docker configuration carries the controlled test flag to both BFF and issuer; demo smoke executes all six presets through actual HTTP services and PostgreSQL.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm audit:secrets
node spikes/wallet-interop-local.mjs --out /tmp/new-person3-local.json
pnpm demo:docker
```

`pnpm test` without a configured database passes 263 tests and skips three opt-in PostgreSQL checks. To include them, set `CAPTURE_POSTGRES_TEST_URL` to an available migrated test database before running `pnpm test`; the checks delete only their generated run IDs. The final enabled run passed **266 tests, none skipped**, including PostgreSQL sanitization and six evaluation/report/matrix round trips after reconnecting.

The local launcher builds the mock services, starts temporary loopback listeners, runs twelve independent cases, exports only bounded synthetic observations and closes listeners. Output filenames must be new. For separately running services, start the issuer with `MOCK_ISSUER_ENABLE_TEST_CASES=true` and use:

```sh
node spikes/wallet-interop-probes.mjs --issuer http://127.0.0.1:4101 --verifier http://127.0.0.1:4102 --out /tmp/new-separate-process-results.json
```

For an ordinary external BFF run, set `PLAYGROUND_DRIVER_MODE=collab`, both `MOCK_*_BASE_URL` values, and `MOCK_ISSUER_ENABLE_TEST_CASES=true` on the BFF and issuer for signed variants. The Docker demo sets the controlled test flag explicitly; Compose defaults to false. Fixture mode stays simulated. `replay_nonce` remains the API enum for nonce mismatch.

## Integration semantics

`protocol.ts` owns expected fault codes, safe diagnostic recognition and versioned evaluation. Only `correct_acceptance` and `correct_rejection` pass. Detailed failure data is optional for legacy history, but cannot be invented for upstream responses. The REPORT or error step persists evaluation; repository reads reconstruct optional run metadata. CSV/Markdown matrix exports append scenario/profile/issuer/reason information.

HTTP 400 at direct-post retains the original submission boundary. Strict mock HTTP 202 results are polled with a deadline. Missing, malformed and service-error terminal responses are execution errors. Unsupported uncontrolled semantic mutations are rejected before run creation. The same six supported configurations are tested through both mock driver paths.

## Implemented contract

- Issuer signing is extracted into `credential.ts`; `createMockIssuer()` isolates grants, clock and endpoints per instance. The ordinary issuer remains available through `server.ts`.
- With test cases enabled, `/token` accepts closed-enum `mock_case`: valid, expired, wrong_type, missing_holder_binding. A variant is fixed to that grant and signed at issuance. With the flag disabled, supplied test selectors are rejected. Test mode supplies two synthetic disclosures; ordinary mode retains one.
- Issuer proofs require exactly one JWT. Private JWK members are rejected, and only canonical public key members enter the credential. Grants permit one attempt, expire at 60 seconds and have a bounded capacity.
- `POST /vp-request` retains its existing default shape. Opt into `{format:"dc+sd-jwt", profile:"mock-sdjwt-flat-v1", requiredClaims:["given_name"]}` for isolated policy tests. Requirements are immutable per challenge; this local extension is not a general DCQL implementation.
- The flat profile supports top-level given_name/family_name disclosures with SHA-256 commitments. Nested selective disclosures are explicitly unsupported. Undisclosed optional commitments are permitted.
- Known verifier rejections use `diagnosticsVersion:1` and `failure:{boundary,stage,code}`. Unknown exceptions become HTTP 500 with a fixed category. No library error prose is returned.
- Transport rejects ambiguous credential envelopes, duplicate fields, unsupported media, oversized bodies and any present `presentation_submission`. Invalid transport does not consume state; structurally accepted presentation attempts do.
- Challenge expiry is checked after body arrival. State consumption is synchronous, result verification occurs once, and result reads use a cached outcome. Strict-profile clients may receive 202 while verifying. Legacy clients await the cached promise for the existing final-result response behavior.
- Challenge TTL is 120 seconds. Terminal results retain for five minutes, bounded to 1,024 entries; raw presentation references are released after verification. There is no durable wallet state.
- Verification policy independently restricts algorithms and public keys, checks issuer time/type, holder proof/type/age, audience, nonce, exact-prefix hash and required disclosed claims. Embedded X.509 support continues to report `certificateTrustChecked:false`.

## Evidence

| Artifact | What it establishes |
| --- | --- |
| `spikes/fixtures/wallet-interop-2026-10-22.json` | Twelve independent local HTTP cases: eleven exact rejections and one optional-omission acceptance, with controls |
| `spikes/fixtures/wallet-interop-bff-2026-10-22.json` | Six preset runs through the Docker BFF/HTTP mocks/PostgreSQL, complete redacted reports and separate matrix cells |
| `spikes/fixtures/wallet-interop-live-2026-10-22.json` | Four fresh Collab presentation observations, two reduced pre-authorized grant attempts and version discovery |
| `spikes/fixtures/wallet-interop-integration-checks-2026-10-22.json` | Final build/typecheck/test/audit and runtime validation record |
| `submission/PERSON3_LIVE_INVESTIGATION.md` | Investigation interpretation, upstream source references and existing issue review |
| `submission/evidence/person3-a2-2026-10-23/README.md` | Real Android partial attempt, five reviewed screenshots, public offer and checkpoint/hash manifest |
| `PERSON4_A2_PREREQUISITES.md` | Infrastructure/client/catalog setup history and the implemented mobile route |
| `submission/evidence/person3-a2-mobile-2026-10-23/README.md` | Actual Android A2 acceptance chain, screenshots, user persistence confirmation and correlated Verify result |

The earlier `wallet-interop-checks-2026-10-22.json` is retained as a historical standalone checkpoint; its pending-integration statements are superseded by this handoff.

## Limits and external dependencies

- Real Android storage/presentation was observed for the recorded A2 hybrid profile; reopen persistence was user-confirmed. Installed-binary attestation and running Collab Verify release remain unverified. The earlier test counts/browser coverage below are historical checkpoints.
- Public Collab still does not attest its deployment versions. X.509 control passes; did:jwk rejects. Upstream merged DID support and older README wording do not identify the deployed code.
- Collab rejects nonce mismatch at direct-post and bad signature at result, but generic diagnostics leave precise reason evaluations inconclusive. Both reduced pre-authorized flows reach credential HTTP 401. These external observations are documented, not silently marked resolved or filed as new defects.
- Flat top-level synthetic SD-JWT only; no recursive disclosure, Presentation Exchange conformance or certificate-chain trust claim. Live request JWT signature authentication remains an existing project limitation.
- Implementation is committed in `39fceaf`; the user requested publishing the subsequent mobile evidence/handoff too. No external issue was filed. The Docker demo address is `http://localhost:5174`; its current runtime availability was not rechecked for this documentation update.

`decisions.md` D-041, `flow.md`, API reference, scenario map, findings and attribution now describe the implemented integration.
