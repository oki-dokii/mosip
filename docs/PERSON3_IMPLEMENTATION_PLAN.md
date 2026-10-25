# Person 3: implementation design and review plan

Revision 2 · 22 October 2026 · branch `person3/protocol_correctness`.

Implemented on `person3/protocol_correctness`, including the BFF/shared/report/matrix integration authorized by the user. The standalone twelve-case suite and both in-process/HTTP BFF paths pass. See `PERSON3_PROTOCOL_HANDOFF.md` for final commands, evidence and limits. A later real Android attempt on 23 October completed A2 using official local Certify and Collab Verify. `submission/A2_MOBILE_EVIDENCE.md` records both the earlier blocked Collab attempt and the successful same-wallet chain with scope/attestation limits.

## 1. Outcomes and scope

Deliver three independently reviewable results:

1. A standalone mock protocol suite that constructs valid controls, changes one semantic variable, and proves the rejection boundary and reason.
2. An integrator handoff that makes those diagnostics and signed faults work through the BFF, reports and matrix. Standalone success alone does not complete product integration.
3. An A2 report for Certify → actual Inji mobile wallet → Inji Verify, with observed issuance, storage, presentation and final verification, or an exact external blocker.

The minimum delivery includes signed expiry/type cases, wrong holder, wrong audience, true replay, consumed state, required disclosure and unsupported `presentation_submission`. Parser/state regressions below protect those features. Full Presentation Exchange, general SD-JWT conformance, certificate-chain trust, revocation, HAIP, mDoc and a new mobile app are outside this slice.

Use `NEXT_STEPS_4_PERSON_PLAN.md`, `PERSON3_PRESENTATION_PROBES_HANDOFF.md`, `WALLET_VALIDATION.md`, `SECURITY.md` and `submission/SCENARIO_SPEC_MAP.md` as the assignment and evidence references. The final protocol version used by a deployment must be recorded independently of this local mock design.

## 2. Mistakes in the first plan and risks found in code

The first plan named tasks without fixing the construction API, diagnostic contract, state lifecycle, integration path or release tests. It also left important false-positive paths unaddressed. The findings below describe the initial checkout. They are retained as review history; local must-fix items are now covered by executable regressions. External request authentication remains an explicit limitation, not an upstream vulnerability claim.

| ID / priority | Code evidence | Consequence | Required action and regression |
| --- | --- | --- | --- |
| R01 / must fix | `tamper/index.ts` changes `exp`/`vct` without issuer re-signing. | A signature rejection can masquerade as expiry/type validation. | Issue signed variants before presentation; independently verify their issuer signatures. |
| R02 / must fix | `presentationNonce()` prefixes the nonce; replay API creates fresh issuance. | Existing replay evidence does not test reuse of accepted presentation bytes. | Separate nonce mismatch, fresh-challenge replay, and consumed-state cases. |
| R03 / must fix | Mock `verify.ts` only checks submitted disclosure hashes against collected commitments. | No required-claim policy; counting disclosures cannot establish which claim was provided. | Verify commitment location and reconstruct supported claim names before evaluating requirements. |
| R04 / must fix, integrator | `CollabVerifierDriver.getResult()` allows HTTP 500 and maps every non-success to `invalid`. | Upstream failure may pass an expected-invalid test. | Transport/service failures must be errors or inconclusive; add 500, 404-pending and malformed-result tests. |
| R05 / must fix, integrator | Orchestrator initializes actual outcome to `valid` and only changes it for explicit `invalid`. | Missing/unknown verifier verdict can become a happy-path pass. | Require exactly one explicit terminal verdict; unknown/missing verdict is an execution error. |
| R06 / must fix | Mock direct-post uses `credential?.[0]`, checks only `typeof token`, and ignores extra fields. | Empty strings are accepted but appear pending; strings/extra tokens and unsupported parameters are misinterpreted. | Strict envelope/cardinality checks before state consumption; test empty, scalar, multi-token and unsupported fields. |
| R07 / must fix | Mock result endpoint catches every exception and returns `invalid` plus `error.message`. | Programming faults look like correct rejection; arbitrary error text can reach summaries. | Typed known validation failures; unknown errors produce bounded 500/error and inconclusive evidence. |
| R08 / must fix | Request maps are global, unbounded and have no expiry; each GET result re-verifies. | State leaks across tests; long sessions accumulate tokens; outcome can change as wall time passes. | Factory-owned bounded stores, challenge TTL, single submission transition and cached result. |
| R09 / must fix | Verification accepts algorithm policy from the JWT's own `alg`; no explicit KB `typ`/age policy or `_sd_alg` dispatch. | Claimed validation scope is broader than explicit checks. | Fixed local profile policy; reject unsupported algorithms/profiles; add missing/wrong header and time tests. |
| R10 / must fix | Form parsing collapses duplicates using `Object.fromEntries`; request arrays and extra proofs are not strictly checked. | Ambiguous input is silently normalized. | Reject duplicate security fields and enforce exactly one token/proof for this mock profile. |
| R11 / must fix | Issuer copies supplied holder JWK directly into `cnf.jwk`; token is consumed before body/proof validation. | Private/extra JWK material may be reflected; retry semantics are implicit. | Reject private key fields, export a canonical public key; specify and test one-attempt grant consumption. |
| R12 / integration gate | BFF has an independent in-process verifier; external mock HTTP 400 throws before producing exchanges. | Fixes can diverge; intended transport rejection may appear as generic driver failure. | Apply the same contract via integrator; preserve safe rejected-exchange evidence; run parity tests. |
| R13 / integration gate | Matrix key omits scenario/profile and issuer representation. | Different policies or issuer-method results can overwrite one another. | Keep separate sidecar records until integrator provides a scenario/profile-aware grouping contract. |
| R14 / scope limitation | Live request JWT is decoded without signature validation; Verify client ID is hard-coded to Collab. | A claim of authenticated request processing or portable local targeting would be unsupported. | Track explicitly with integrator/Person 4; validate target configuration before live probes; do not add a compliance claim. |

Do not describe the current synchronous state assignment as a demonstrated race. The concurrency regression below prevents a race when asynchronous verification is introduced.

## 3. Implementation structure and ownership

Keep changes small enough to land and validate separately. New names below are proposed; create a module only when its corresponding implementation lands.

| File | Concrete change | Owner |
| --- | --- | --- |
| `apps/mock-issuer/src/credential.ts` | Extract actual credential signing into `issueCredential({signer, holderPublicJwk, variant, now})`. | Person 3 |
| `apps/mock-issuer/src/app.ts` | Export `createMockIssuer(options)` with injected signer, clock, public URL, fault flag and isolated grants. | Person 3 |
| `apps/mock-issuer/src/server.ts` | Keep production startup/env parsing; construct app and listen. Preserve existing endpoints. | Person 3 |
| `apps/mock-verifier/src/profile.ts` | Define local profile constants, bounded request parser and immutable policy. | Person 3 |
| `apps/mock-verifier/src/diagnostics.ts` | Typed rejection codes/stages and safe result constructors. | Person 3 |
| `apps/mock-verifier/src/verify.ts` | Verify tokens under explicit policy; return a discriminated result; never expose raw library errors. | Person 3 |
| `apps/mock-verifier/src/disclosures.ts` | Implement the bounded flat-disclosure policy described below. | Person 3 |
| `apps/mock-verifier/src/app.ts` | Factory, HTTP validation, challenge store, consumption and cached verification. | Person 3 |
| Mock `*.test.ts` and `src/test-support/*` | Runtime keys, independent assertions, HTTP and policy tests. | Person 3 |
| `spikes/wallet-interop-cases.json` | Versioned case definitions and expectations. | Person 3 |
| `spikes/wallet-interop-probes.mjs`, `spikes/wallet-interop-evaluate.mjs` | Explicit-target HTTP runner, safe artifact construction and verdict evaluation. | Person 3 |
| `spikes/wallet-interop-*.test.mjs` | Evaluator, serialization and runner-failure regression tests. | Person 3 |
| `apps/bff/src/tamper/` | Preserve byte corruption for signatures; stop representing payload rewrites as isolated semantic tests after coordinated driver changes. | Person 3 + integration seam |
| BFF drivers/capabilities/orchestrator, shared schemas, reports/matrix | Apply the contract in section 10. | Integrator |
| `GAPS.md`, `submission/gaps.json`, scenario-spec map and A2 report | Evidence and findings. | Person 3 |

Avoid importing another app's `src` from TypeScript tests: each package has `rootDir: src`. The cross-service runner uses HTTP and Node's existing root `jose` dependency. It does not import server entrypoints or private app helpers. Server factories remove import-time environment mutation and allow isolated port-zero tests. Split `server.ts` only enough to make app construction testable; retain startup commands and listen defaults.

For port-zero tests: construct the factory with a public-base-URL supplier, bind the server, set that supplier's URL from `server.address()`, then send requests. Production supplies a fixed configured URL. This replaces tests that accidentally use port 4101 as proof audience while listening elsewhere.

## 4. Freeze the local mock contract before coding

### 4.1 Issuer fault selection: per grant, disabled by default

Add optional form field `mock_case` to `/token`, permitted only when the issuer starts with `MOCK_ISSUER_ENABLE_TEST_CASES=true`. Supported values are a closed enum: `valid`, `expired`, `wrong_type`, `missing_holder_binding`. No arbitrary payload/key/algorithm overrides.

- With the flag off, any supplied `mock_case` returns `400 unsupported_test_case`; absent field retains today's valid default.
- Bind the selected variant into that token's grant. `/credential` cannot change it.
- Grant state is `{nonce, expiresAt, variant}`. Keep a 60-second TTL and use one-attempt consumption: consume a recognized unexpired grant before parsing/verifying the credential proof. A failed attempt requires a new grant. Document this existing behavior and test it deliberately.
- Validate the token request and duplicate fields before creating any grant. Limit active grants to 1,024; sweep expired entries on access/create and reject capacity overflow with 503. Do not evict a live grant to admit another.
- At `/credential`, require exactly one JWT proof, expected configuration ID, correct audience and nonce. Validate the public holder key; reject JWK private members and unsupported key types. Export only validated public members into `cnf`.
- Invoke `issueCredential()` after proof validation. It uses `loadIssuerSigner()` for the actual issuer signature, including X.509 mode. Credential metadata/configuration stays unchanged; `wrong_type` deliberately violates that request as a labeled test fault.

Time construction uses a single injected `now` in epoch seconds. Valid baseline: `iat=now-10`, `nbf=now-10`, `exp=now+3600`. Expired variant: `iat=now-120`, `nbf=now-120`, `exp=now-60`. Thus expiry is the only invalid temporal condition. Tests compare semantic validity, not literal equality of dependent timestamps.

Use two top-level synthetic disclosures in the new isolated profile: `given_name` (required only when requested) and `family_name` (optional control). Preserve the existing default issuer output if adding the second claim would change a recorded baseline: enable the two-claim fixture through the test flag and keep a separate default-output regression.

### 4.2 Verifier request policy

Preserve `POST /vp-request {"format":"dc+sd-jwt"}`. Its default compatibility profile remains `legacy-mock-v1`, with no claim requirement. Add an explicit local profile for the probes:

```json
{
  "format": "dc+sd-jwt",
  "profile": "mock-sdjwt-flat-v1",
  "requiredClaims": ["given_name"]
}
```

`requiredClaims` is allowed only with the explicit flat profile. It is a unique array of zero to two members from `given_name`, `family_name`; unknown names, paths, values, duplicates, wrong types and unknown policy fields fail with `400 invalid_request_policy`. Do not silently drop requirements or treat this extension as standardized DCQL syntax.

Return the existing `{requestId, claims}` plus `policy: {profile, requiredClaims}`. Store an immutable copy on the challenge; the presentation cannot supply/override it. Changing request policy after creation is unsupported. Strict cardinality and transport checks apply to both profiles, with a baseline compatibility gate. Flat disclosure restrictions apply only to the explicit profile.

### 4.3 Response and diagnostic shape

Keep existing success fields. Add diagnostics with a versioned contract:

```ts
// Planned types, local to mock verifier first.
type VerificationResult =
  | { outcome: "valid"; diagnosticsVersion: 1;
      issuerSignatureValid: true; holderProofValid: true;
      disclosedClaims: number; certificateTrustChecked: false }
  | { outcome: "invalid"; diagnosticsVersion: 1;
      failure: { boundary: "result"; stage: VerificationStage; code: RejectionCode } };
// HTTP rejection: { error: <existing/lowercase category>,
//   diagnosticsVersion: 1, failure: { boundary: "direct_post", stage, code } }
// Unexpected internal failure: HTTP 500 { error: "verification_error" }.
```

Any retained `failureDetail` is a fixed public phrase selected from the code enum. Do not accept arbitrary strings into diagnostics. Never infer a cryptographic reason from transport status alone.

## 5. Verification pipeline and error precedence

Use `jose` for signature/JWT validation. Catch errors around each individual verification operation so issuer expiry cannot be mislabeled as holder expiry. Match typed library classes/codes and known claim identifiers, never `error.message` substrings. The pinned implementation validates JWS before JWT claims; signature-only assertions in tests should use `compactVerify`, while runtime verification retains claim validation. [jose v6.2.13 source](https://github.com/panva/jose/blob/v6.2.13/src/jwt/verify.ts)

Define one deterministic stage ordering for the explicit flat profile:

| Order | Stage / implementation | Diagnostic examples |
| --- | --- | --- |
| 1 | Bound token bytes/segments; validate compact JWT and base64url structure, nonempty issuer/KB and disclosure limits. | `MALFORMED_PRESENTATION` |
| 2 | Select issuer key using a bounded embedded public JWK/certificate; enforce configured algorithm/key-type policy. No URL/key resolution. | `UNSUPPORTED_ISSUER_KEY`, `UNSUPPORTED_ALGORITHM` |
| 3 | Verify issuer JWT with allowed algorithms and injected clock; require numeric `iat`, `nbf`, `exp` for this local profile. | `ISSUER_SIGNATURE_INVALID`, `CREDENTIAL_EXPIRED`, `CREDENTIAL_NOT_YET_VALID`, `INVALID_CREDENTIAL_CLAIMS` |
| 4 | Check expected `vct` and a supported public `cnf` key. Reject ambiguous simultaneous `jwk`/`kid` in strict profile. | `CREDENTIAL_TYPE_MISMATCH`, `HOLDER_BINDING_MISSING`, `INVALID_HOLDER_KEY` |
| 5 | Verify disclosures and construct the flat claim map, with duplicate/collision checks. | `DISCLOSURE_DIGEST_MISMATCH`, `MALFORMED_DISCLOSURE`, `UNSUPPORTED_DISCLOSURE_PROFILE` |
| 6 | Validate KB header/type, holder signature and time claims under the challenge's clock policy. | `KB_TYPE_MISMATCH`, `HOLDER_PROOF_INVALID`, `KB_TIME_INVALID` |
| 7 | Require audience and nonce with strict types and compare against this challenge. | `AUDIENCE_MISMATCH`, `NONCE_MISMATCH` |
| 8 | Compare `sd_hash` over the exact received SD-JWT prefix. | `SD_HASH_MISMATCH` |
| 9 | Require each requested disclosed claim in the verified claim map. | `REQUIRED_DISCLOSURE_MISSING` |

Local policy: issuer algorithms EdDSA/Ed25519, ES256/P-256 and RS256/RSA >= 2048 bits; holder EdDSA/Ed25519. Check allowed algorithm/key combinations independently of untrusted headers. Symmetric keys, `none`, unsupported critical headers and unencoded JWS payloads are rejected. These restrictions are application policy, consistent with independent algorithm selection guidance. [RFC 8725 §3.1](https://www.rfc-editor.org/rfc/rfc8725.html#section-3.1)

For flat-profile KB JWTs require `typ=kb+jwt`, `iat`, string `aud`, string `nonce` and string `sd_hash`; validate optional `exp`/`nbf` when present. Set a documented local 120-second maximum age and 5-second future skew. Capture the verification timestamp once; inject clocks in unit tests. Do not sleep to test expiry. Acceptance at the exact tolerance boundary must be specified and tested (age <= 120 seconds, future iat <= 5 seconds).

The hash input preserves the received issuer/disclosure encodings and trailing delimiter before KB. Do not decode/re-encode or sort disclosures before hashing. KB type, freshness, audience/nonce and binding are separate checks. [RFC 9901 §4.3 and §7.3](https://www.rfc-editor.org/rfc/rfc9901.html#section-7.3)

Default compatibility mode must have passing controls for existing did:jwk, X.509 and supported Certify-shaped fixtures before strict checks are applied to it. Reject unsupported structure explicitly; do not pretend the flat profile implements recursive disclosure or all historical Inji profiles. Store profile identity in every result artifact.

## 6. Required disclosures: exact bounded algorithm

Implement this algorithm only for `mock-sdjwt-flat-v1`:

1. Require `_sd_alg` to be `sha-256` when present; use the specified default when absent. Reject other algorithms rather than silently hashing with SHA-256.
2. Require a top-level `_sd` array of unique strings. Reject nested selective-disclosure commitments and array-disclosure markers with `UNSUPPORTED_DISCLOSURE_PROFILE`.
3. For each presented disclosure, hash its original encoded bytes and find exactly one top-level commitment. Reject unknown or repeated disclosures/digests.
4. Decode its bounded JSON array `[salt, name, value]`; require a nonempty string salt and supported string name. Do not trim names. Reject reserved names and a name already present in the clear payload or another disclosure.
5. Add the verified name/value to a new `Map`; never merge untrusted objects into a prototype-bearing object. Discard values after policy evaluation.
6. After holder verification, check required names in that map. The two supported synthetic claims must have nonempty string values. A nested occurrence, uncommitted disclosure, duplicate name or top-level lookalike must not satisfy the requirement.

Allow undisclosed commitments: they may represent optional claims or decoys. Do not require all commitments to be disclosed. A valid optional-omission control is mandatory. Record only count and fixed claim-presence booleans in test evidence, never values or salts. The disclosure encoding/commitment rules are based on [RFC 9901 §4.2](https://www.rfc-editor.org/rfc/rfc9901.html#section-4.2); the two-name flat restriction is our bounded local test policy.

This avoids implementing a partially correct general recursive SD-JWT decoder under the deadline. Preserve the legacy profile as separately labeled compatibility behavior; do not apply global recursive digest matching to the new required-claim policy.

## 7. Transport validation and challenge lifecycle

### Parsing and limits

Before touching challenge state:

- Preserve the existing JSON/form routes, explicitly allow their supported MIME types, and reject unsupported types with 415.
- Count received bytes incrementally; avoid repeated `Buffer.concat` in the stream loop. Keep 64 KiB verifier and 32 KiB issuer body caps. Reject declared or actual excess with 413, including chunked requests.
- For forms, reject duplicate `state`, `vp_token`, `presentation_submission`, grant or test-selector fields before converting to an object.
- Require a plain object body and a `vp_token` object with exactly `credential: [oneNonemptyString]`. Reject null, arrays, scalar strings, empty/extra credentials and unexpected query IDs.
- Detect presence of `presentation_submission` even when its value is empty. Reject with `UNSUPPORTED_PRESENTATION_SUBMISSION` before parsing its content. This proves local profile enforcement, not PE conformance.
- Reject malformed JSON/base64url/oversized structures with stable codes. Use `jsonc-parser`'s visitor API with comments, trailing commas and empty content disabled. Maintain one property-name Set per object; reject duplicate decoded names, including escaped equivalents. Abort on any parser error, depth over 16 or more than 512 values/properties; only then call `JSON.parse`. Reject invalid UTF-8 before parsing. The parser is fault tolerant by design, so ignoring its errors would recreate this bug. Pin a reviewed version in the two owned app manifests during implementation; let the integrator reconcile the root lockfile. [Parser API](https://github.com/microsoft/node-jsonc-parser)
- In the strict profile, cap a token at 32 KiB, each compact JWT at 16 KiB, disclosures at 16 and each decoded disclosure at 4 KiB. Enforce bounds before decoding/importing keys. For raw JSON depth protection, first scan tokens with the same library and abort at the nesting bound before invoking its recursive visitor. Test exact limit and limit-plus-one inputs.

### State machine

Use a factory-owned `Map<requestId, Challenge>` and a state-to-request index. `Challenge` contains immutable policy/claims, `createdAt`, `expiresAt`, and an explicit status union rather than truthiness of a token.

```text
PENDING -- valid transport / atomic claim --> SUBMITTED -- verify once --> COMPLETE
PENDING -- challenge timeout --> EXPIRED
SUBMITTED -- internal exception --> ERROR
COMPLETE or ERROR -- subsequent submissions --> INVALID_STATE
EXPIRED -- submissions --> REQUEST_EXPIRED (until cleanup; then INVALID_STATE)
```

- Default challenge TTL: 120 seconds, with expiry at `now >= expiresAt`. Inject clock and TTL for tests.
- Synchronously change PENDING to SUBMITTED before any asynchronous verification. Cache one verification promise, resolve it to a safe result, and never launch a second verification on concurrent GETs.
- Verify at accepted submission time; record that time for checks. Keep direct-post 200 `{accepted:true}` as transport acknowledgment even if cryptography later rejects.
- `/status` keeps `PENDING` and `VP_SUBMITTED` for existing clients; expired/error states are explicit additions. `/result` returns 409 before submission, 410 for an expired pending challenge, 202 while verification is running, 200 for cached valid/invalid result, and bounded 500 for internal error. Integrator must add bounded 202 polling before enabling this lifecycle in the BFF.
- Malformed transport and unsupported parameters do not consume the challenge. Structurally accepted but cryptographically invalid presentations do consume it. Document and test both.
- Cache terminal results for five minutes after completion; clear references to raw token bytes after verification settles. Sweep expired/terminal entries on access/create, cap the entire store at 1,024 and reject overflow with 503. Never evict active work silently.
- Close listeners and clear stores in teardown. No persistent global timers are required. A bounded in-memory store is sufficient for this test service.

Regression: two simultaneous valid submissions to the same state must yield exactly one accepted request; simultaneous result reads must return the same cached result; advancing the clock after completion must not change that result. Different states/runs must remain independent.

## 8. Construct controls that cannot accidentally test another fault

The HTTP runner drives discovery → token → proof → credential, then request → direct-post → status/result. Keys and raw tokens stay in process memory. It uses explicit local service URLs; it never silently defaults to public Collab. CLI requests have AbortSignal deadlines and a total per-case deadline; transport errors become sanitized observations.

For each case, create a fresh challenge. Pass a baseline immediately before the negative using the same issuer profile and verifier policy. Independently check issuer signature with `compactVerify`, intended claim/time changes, and holder signature over its actual bytes. The targeted faulty check is expected to fail in that construction assertion (for example, issuer signature in the bad-signature case); all unrelated checks must pass. Do not call the verifier under test to establish the control's construction invariants.

| Stable case ID | Construction | Required invariant / expected result |
| --- | --- | --- |
| `p3.signature.issuer` | Flip one decoded issuer-signature byte; build a correct KB over the changed SD-JWT. | Holder proof/hash remain valid; `ISSUER_SIGNATURE_INVALID`. |
| `p3.credential.expired` | Request `mock_case=expired`; issue through the real mock signing function. | Issuer signature succeeds independently, nbf is valid, fresh KB; `CREDENTIAL_EXPIRED`. |
| `p3.credential.type` | Request `mock_case=wrong_type`; keep verifier type policy fixed. | Valid signature/time/binding; `CREDENTIAL_TYPE_MISMATCH`. |
| `p3.holder.wrong_key` | Credential binds A; sign KB with B while retaining correct audience/nonce/hash. | Issuer credential unchanged; `HOLDER_PROOF_INVALID`. |
| `p3.holder.missing_binding` | Issuer signs variant without cnf; attach otherwise well-formed KB. | Valid issuer signature; `HOLDER_BINDING_MISSING`. |
| `p3.binding.audience` | Sign fresh KB changing only audience semantics. | Correct nonce, hash, holder signature/time; `AUDIENCE_MISMATCH`. |
| `p3.binding.nonce` | Sign a fresh KB containing a different nonce. | Correct audience and hash; `NONCE_MISMATCH`; explicitly not replay. |
| `p3.replay.fresh_challenge` | Complete A; create B and assert different nonce; submit exact stored A token bytes under B state. | Assert bytes equal in memory; B rejects with `NONCE_MISMATCH`. Keep A within time window. |
| `p3.replay.consumed_state` | Submit A again to A's state. | Transport rejection `INVALID_STATE`; no second verification. |
| `p3.disclosure.required` | Request given_name; remove that disclosure; regenerate valid KB using exact reduced prefix. | Issuer JWT unchanged and new hash correct; `REQUIRED_DISCLOSURE_MISSING`. |
| `p3.disclosure.optional` | Same required policy; remove only family_name and regenerate KB. | Valid. This is a required positive control, not an expected rejection. |
| `p3.profile.presentation_submission` | Valid presentation plus present unsupported field, with empty, valid-JSON and malformed-JSON values. | `UNSUPPORTED_PRESENTATION_SUBMISSION`; challenge still usable after removing the field. |

Additional targeted tests protect the new checks: bad holder signature, missing KB, wrong KB type, stale/future/missing iat, wrong sd_hash, missing/wrong-type aud/nonce, unsupported algorithm, malformed disclosure, duplicate digest/name, uncommitted claim, unsupported nested commitment, unknown/duplicate policy claim, and unknown failure mapping. Keep each mutation independent; do not combine faults except in explicitly named precedence tests.

Regenerate challenge-specific values as necessary for controls; “one variable” means one invalid semantic condition, not identical random salts/nonces/signatures across runs. Replay is the exception where exact presentation-byte equality is the property being tested.

## 9. Evidence evaluator: fail closed on missing information

Version `wallet-interop-cases.json` and validate it before executing. Each definition contains:

```ts
interface CaseDefinition {
  id: string;
  profile: "mock-sdjwt-flat-v1";
  controlId: string;
  fault: string;
  expected: { outcome: "valid" | "invalid";
    boundary: "direct_post" | "result";
    stage?: string; code?: string };
  specificationReferences: string[];
}
```

Observation fields: case ID, profile, control outcome, construction assertions, HTTP boundary/status, actual outcome/stage/code, transport/internal error category, timestamp, duration, source commit, dirty-tree flag, component versions and artifact schema version. For independent HTTP probes, `applicationStep` is null. Map to BFF step names only after an actual BFF run provides them; do not fabricate a step observation.

Evaluation precedence:

1. Failed/unrun control, failed construction assertion, timeout, network failure, 5xx, malformed result, unsupported diagnostic version or missing terminal verdict → `inconclusive`.
2. Negative expected and explicit terminal valid → `wrongly_accepted`.
3. Expected rejection and observed bounded rejection at another boundary/application step → `wrong_step`.
4. Right boundary but a different known validation stage/code → `wrong_reason`.
5. Outcome, boundary, stage and code all match → `correct_rejection`.
6. Positive expected and explicit terminal valid → `correct_acceptance`; bounded rejection → `unexpected_rejection`.

If an upstream result says only `invalid_request`, record rejection observed but classify the exact-reason assertion inconclusive. Never infer nonce or expiry validation from that generic response. Unknown codes are retained only as a safe category and cannot match expectations.

Runner exits: 0 only when every requested positive/negative passes; 1 for observed mismatches; 2 for inconclusive/infrastructure/configuration failure (takes precedence if mixed). Always export a bounded summary, including unfinished cases, before exiting. No retries of submissions that could conceal state bugs; any retry creates a new labeled attempt.

Build exports from an allowlist DTO; never serialize driver state, full HTTP responses or caught errors. Do not snapshot tokens or include them in assertion diffs. Sensitive equality assertions compare booleans. Use A/B labels for replay, not token/nonce hashes. Review canary absence in JSON, Markdown, stdout and stderr; run the existing secret audit. Record commit and dirty flag honestly, and rerun after the final implementation commit if a clean reproducible result is needed.

## 10. Concrete integration handoff: required for product completion

Completed in this branch after the user authorized the remaining integration work. The table below is the implemented acceptance contract. Holder mismatch/binding injection and genuine replay remain explicitly covered by the independent HTTP harness.

| Seam | Required change | Acceptance test |
| --- | --- | --- |
| Issuer driver | For eligible standalone mock expiry/type cases, pass grant-bound `mock_case`; avoid mutating the resulting signed credential again. Keep ordinary issuance unchanged. | Report from real HTTP issuer confirms correct signed fault; signature-only invariant passes. |
| Unsupported issuer paths | Inji-issued expiry/type mutations cannot be re-signed by this project. Disable those isolated claims until controlled issuer support exists, or label the existing mutation as signature corruption. JSON-LD needs its own controls. | Unsupported configs rejected before a misleading run is created. |
| Holder preflight | Current wallet checks holder binding before presentation. Use the independent harness for wrong-holder/missing-binding probes; a future BFF fault hook must inject deliberately at the correct stage. | Wrong-holder scenario reaches verifier, or is explicitly harness-only; local preflight rejection never counts as verifier evidence. |
| Verifier driver | Send explicit profile/requiredClaims; retain safe diagnostics; handle known direct-post 400 as observed rejection; preserve exchange record. | Wrong parameter produces a direct-post result, not generic driver error or a fabricated result-stage rejection. |
| Async result | Bound status/result polling, handle 202 pending, 410 expiry and 5xx errors. | No premature success, busy loop or endless polling. |
| In-process mock | Apply the same policy/result contract or disable new cases on that path until parity exists. Do not duplicate a partial implementation and label it equivalent. | Same generated corpus yields same intended verdicts on supported paths. |
| Orchestrator | Require explicit terminal outcome; preserve original rejection boundary and stable codes. Expected-invalid requires expected reason when scenario provides it. | Missing verdict and 500 fail/inconclusive; signature failure cannot pass an expiry scenario. |
| Shared/report contract | Add optional versioned diagnostic/evaluation fields; preserve historic records. Decide persisted JSON envelope versus schema migration before editing. | Old reports still load; absent diagnostic detail stays unknown. |
| Matrix/scenarios | Separate policy/profile/case identity and issuer representation as needed; do not promote new cases using old broad combination keys. | A different scenario cannot overwrite or stand in for an isolated case. |
| Evidence tier | Keep probe artifacts labeled local mock; mobile report is independently observed evidence. | HAR, fixture and Reference Wallet results cannot close A2. |

Integration is implemented: signed variants, shared verification core, bounded diagnostics/polling, strict result evaluation, optional persisted metadata and scenario/profile/issuer-aware matrix grouping. The Docker smoke now covers the valid control and all five supported BFF faults. Unsupported combinations remain guarded.

## 11. A2 mobile runbook and dependencies

Start this work on day one, independently of local negative-case coding.

1. Create `submission/A2_MOBILE_EVIDENCE.md` with a prerequisite table: wallet artifact/build identity and source, device/OS, installability, issuer catalog/configuration, authentication/test identity availability, issuer/verifier URLs, known versions, profile/draft, device reachability and callback/QR scheme. Mark each available, unavailable or unverified and name the dependency owner.
2. Person 4 provides reachable pinned endpoints/public URL configuration. A phone cannot use the development machine's loopback address. Check actual device access and the configured request/response origins before attempting issuance; do not patch signed URLs or disable TLS checks to make it work.
3. Validate the selected app supports this exact issuance and presentation profile. Use an existing pinned build. If it does not, record capability/configuration failure and stop claiming an executable A2 path.
4. Issue one synthetic SD-JWT through Certify. Observe its presence in the wallet credential list/detail; retain a sanitized screenshot with the format/configuration and attempt label. Record whether reopening the wallet still shows it if that check is feasible; do not confuse a download screen with storage.
5. Create a fresh Verify request, retain request/transaction identifiers only in the local execution context, and produce a QR/deep link through the target's supported flow. Use the actual wallet to approve and submit. A small `spikes/wallet-interop-mobile.mjs` helper may create/poll the request, but must not use Reference Wallet presentation code.
6. Poll the target result through a bounded helper. Correlate issuance, wallet observation and verifier result using one attempt label and timestamps; record safe identifiers only after review. Do not stitch successful stages from unrelated attempts into one passed journey.
7. Record explicit terminal Verify result and available holder-proof checks. Native/internal traffic that is inaccessible remains unobserved. Browser HAR cannot establish native wallet storage or key operations.
8. Export checkpoints as observed/failed/unavailable, sanitized artifacts, exact reproduction instructions, versions, source commit and limitations. Mark `passed` only for a complete same-wallet chain; `failed` for an executed incompatible path; `blocked` for an unavailable prerequisite.

The current BFF lacks a mobile wallet enum/driver and rejects live non-Reference-Wallet runs. This report is therefore manual evidence initially. Do not assign it a fabricated BFF run ID or change shared wallet types independently. The integrator updates `WALLET_VALIDATION.md` and release claims from this report.

## 12. Findings and protocol references

Re-run the historical nonce-mismatch observation against the identified target after the BFF rejection fix. Preserve the old report and add a new dated result. A new generic HTTP 400 still does not prove the detailed nonce rejection stage. Test genuine replay independently.

For G-01, compare did:jwk and X.509 as distinct issuer profiles; X.509 success with a self-signed certificate is not trust-chain assurance. For G-04, pin grant, issuer configuration and deployment before deciding whether the pre-authorized failure is a product defect. Keep `GAPS.md` and `submission/gaps.json` aligned. Do not publish new upstream defect claims from local mock tests.

The normative references above guide our local policy and test construction. They do not establish which draft Collab implements. Before each external claim, record the deployed profile and exact applicable text. Check existing issues before preparing a report. Security-impact findings follow private triage in `SECURITY.md`; issue drafting is separate from authorization to send a report.

## 13. Test layers, execution order and gates

| Layer | Tests that must exist | Exit condition |
| --- | --- | --- |
| Construction | Signature-only checks on signed expiry/type; exact-prefix hash; holder A/B distinction; public-only key export. | Each negative has exactly its intended invalid condition. |
| Pure verification | Every stage/code, wrong/missing/type-invalid claims, disclosure collisions, boundary-time checks, known versus unknown exceptions. | Expected code/stage and no secret-bearing output. |
| HTTP contract | Default requests, opt-in policy, disabled test flag, malformed/duplicate fields, MIME/body limits, response codes. | Invalid input never silently becomes accepted or consumes unintended state. |
| Lifecycle | Expiry, consumed state, parallel submission/result reads, cached result, store bounds, cleanup and cross-run isolation. | One verification per challenge; bounded state; deterministic time behavior. |
| Cross-service | Actual issuer proof/issuance and verifier challenge/submission/results for every case. | Controls pass; exact rejection assertions pass; runner exit and artifact match. |
| BFF integration | Signed-fault routing, unsupported combinations, diagnostics, early rejection, missing verdict, 202/500, historic reports, matrix separation. | No false expected-invalid pass; old mock demo preserved. |
| Mobile | Real app issuance/storage/presentation/result. | A2 passes or has an exact blocker/failure report. |

Commands to execute during implementation, not results of this plan:

```sh
pnpm --filter @playground/mock-issuer test
pnpm --filter @playground/mock-verifier test
node --test spikes/wallet-interop-*.test.mjs
pnpm --filter @playground/bff exec vitest run src/tamper/index.test.ts src/drivers/collab.test.ts src/orchestrator.test.ts src/report.test.ts src/matrix.test.ts src/scenarios.test.ts
```

Proposed runner invocation after its implementation (requires explicitly started test-enabled local issuer and verifier):

```sh
node spikes/wallet-interop-probes.mjs --issuer http://127.0.0.1:4101 --verifier http://127.0.0.1:4102 --out /tmp/person3-protocol-results.json
```

The runner supports loopback targets by default, creates a new owner-only output file without overwriting, closes sockets, and never starts a live Collab probe implicitly. External probe commands need a separate explicit target/profile and synthetic authorized environment.

After integration run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm audit:secrets` and `pnpm demo:docker`. The Docker command leaves the stack running; coordinate ports with Person 4. Do not represent this existing two-cell mock matrix as coverage of the new cases. Record new probe results separately until CI integration is provided.

Required evaluator tests: a correctly rejected negative, a wrongly accepted negative, wrong boundary, wrong known code, generic upstream error, failed control, failed invariant, timeout, missing verdict, malformed JSON, unknown diagnostic version and mixed-run exit-code precedence. These guard the test harness itself against reporting false success.

## 14. Work sequence and release decisions

1. **First session:** establish A2 prerequisites; capture baseline commands; deliver the contract in sections 4/10 to the integrator. Pin the JSON parser dependency and confirm the existing baseline formats before parser implementation.
2. **Commit 1:** extract factories/signing function without changing default behavior; add isolation and default-path regressions. Gate: existing mock and Compose baseline remains valid.
3. **Commit 2:** add grant-bound signed variants and runtime cryptographic controls. Gate: signature-only checks establish expiry/type isolation.
4. **Commit 3:** diagnostics, explicit profile verification and disclosure policy. Gate: each verification stage has a control and isolated regression; unknown errors cannot become invalid.
5. **Commit 4:** transport/state lifecycle and concurrency tests. Gate: exactly one accepted submission and stable cached result; invalid transport remains retryable within TTL.
6. **Commit 5:** independent HTTP probe runner, evaluator, sanitized artifacts and scenario/spec map. Gate: all mandatory local cases produce trustworthy verdicts and nonzero exits on failure/inconclusive results.
7. **Integrator handoff:** apply BFF/shared/report seams and run product regressions. Gate: no broad-outcome false passes and no matrix identity collision for new cases.
8. **A2 evidence commit:** execute mobile path or record exact blockers; update findings and deliver proposed common-doc updates to integrator.

Do not keep a failing checkpoint hidden behind later commits. Each handoff includes source commit, dirty-tree status, command output summary, case/control results, changed files, contract changes and remaining integration blockers. Use Person 3's own Git author identity. The integrator owns updates to common `decisions.md`/`flow.md`; supply concrete proposed entries with the handoff.

Working cutoff: 24 October 2026, 21:00 IST for A2 go/no-go; 25 October for negative evidence/integration; 26 October, 21:00 IST for final freeze. These are planning dates pending the official deadline. If time is tight, prioritize correct local controls and honest A2 status; do not remove parser/error assertions or relabel incomplete integration as done.

Final acceptance checklist:

- [x] Every mandatory negative has a passing control and independent construction invariants.
- [x] Expiry/type rejection cannot be satisfied by an issuer-signature failure.
- [x] True replay, nonce mismatch and state reuse have distinct case IDs and evidence.
- [x] Optional omission passes; required omission fails for the intended reason.
- [x] Internal/transport failures and missing verdicts cannot become protocol-test passes.
- [x] Strict profile, legacy compatibility and external deployment claims remain distinguishable.
- [x] State, parsing, duplicate input, concurrency and time boundaries are covered.
- [x] Standalone results and BFF integration status are reported separately until integration passes.
- [x] New evidence cannot overwrite a different policy/scenario in the matrix.
- [x] Exports/logs contain no raw credentials, keys, disclosure values, nonces or exception strings.
- [x] A2 has same-wallet evidence or an exact unresolved prerequisite; no synthetic pass substitutes for it.
- [x] Final source, commands, versions, evidence and limitations are reviewable by another teammate.

Final execution status: non-wallet implementation and investigations complete; the recorded A2 mobile chain also passed on 23 October. Evidence includes native wallet screenshots, user-confirmed reopen persistence and a correlated valid credential/holder proof result. Installed-binary attestation and Collab release attribution remain unverified. Current validation: `spikes/fixtures/wallet-interop-integration-checks-2026-10-22.json`; integration: `PERSON3_PROTOCOL_HANDOFF.md`. Historical review findings and the original delivery sequence above are retained as design history, not current outstanding tasks.
