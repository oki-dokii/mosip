> Archived historical handoff. Current assignment: [final four-person plan](../FINAL_FOUR_PERSON_EXECUTION_PLAN.md). Current local capture: [implemented contract](../PERSON1_LOCAL_CAPTURE_HANDOFF.md).

# Person 3 handoff: four local presentation probes

Prepared 22 October 2026. Owner: Person 3. Status: **ready for coordination; not implemented or executed by Person 1**. The user will share this file. Person 1 has made no changes to `apps/mock-verifier/`, `apps/mock-issuer/`, drivers, tamper modules or shared schemas.

The objective is to isolate presentation failures using synthetic credentials and the local mock. These tests do not establish how Collab or a real Inji wallet behaves. Keep any security-impact upstream reproduction under the private-triage process in `SECURITY.md`.

## Existing contract to preserve

- `POST /vp-request` accepts `{ "format": "dc+sd-jwt" }` and returns a request ID plus client ID, nonce, state and response URI.
- `POST /direct-post` receives form-encoded state and a `vp_token` JSON object whose `credential` property is an array of token strings.
- `GET /status/{requestId}` exposes pending/submitted transport status.
- `GET /result/{requestId}` performs verification. HTTP 200 / `accepted: true` at direct-post is **not** cryptographic success.
- `verifyPresentation()` currently checks issuer signature, the fixed credential type, holder signature, audience, nonce, `sd_hash`, and whether submitted disclosure digests occur in the issuer payload. Its result explicitly says certificate trust was not checked.
- The mock currently has no requested-claim requirement model or Presentation Exchange profile. Do not silently change those semantics while adding tests.

## Probe definitions

| Probe | Construction and control | Expected result | Keep constant |
| --- | --- | --- | --- |
| Wrong audience | First pass a valid control. Create a new challenge and sign a new key-binding JWT with only its audience wrong. | Result is invalid due to audience validation; never count transport acceptance as success. | Issuer signature, credential type, holder key, fresh nonce, disclosures and correct `sd_hash`. |
| Replay into fresh challenge | Complete request A successfully. Create request B with a different nonce. Submit A's exact original presentation bytes under B's valid transport state. | B fails nonce validation. Also test resubmitting to A separately: its used state must be rejected. | Do not re-sign or alter the old JWT. A mutated nonce test is not this replay test. |
| Missing required disclosure | Add an explicit request requirement for a selected claim. Create a valid control that discloses it. Remove only that disclosure and re-sign the holder JWT with the correct new `sd_hash`, fresh nonce and audience. | Invalid because a requested claim is absent; no accidental signature/hash failure. | Issuer-signed credential and its disclosure commitments remain unchanged. A hidden optional claim is legitimate selective disclosure and must remain valid. |
| Malformed `presentation_submission` | Decide whether to add a separate Presentation Exchange profile or reject this parameter on the existing DCQL-like profile. For PE, start with a valid definition/descriptor map and mutate one field per case. | Stable request/schema error; no successful verification caused by ignoring malformed mapping. For the existing profile, an unsupported parameter result must be labeled profile enforcement, not PE conformance. | Valid credential and holder proof; isolate missing/wrong definition ID, invalid descriptor path, wrong format and malformed JSON. |

## Decisions Person 3 should confirm before coding

1. Where requested-claim requirements live in the mock's in-memory challenge, and the explicit opt-in request field/profile that carries them. Preserve the existing default happy path.
2. Whether Presentation Exchange is actually in scope. The current request/response shape is not a PE implementation. Never treat `presentation_submission` as mandatory for DCQL or claim a PE test passed because the field was ignored.
3. Stable diagnostic codes for each failure. Keep raw JWTs, claim values and library error strings out of new evidence artifacts.
4. Test fixture ownership: Person 3 generates issuer and holder keys at runtime in mock-specific tests. Do not import Person 1's capture specimen as a valid holder-bound presentation: it tests sanitization and deliberately omits real presentation/key-binding machinery.

## Handoff proof

For every case, deliver a passing positive control, one-variable negative test, request/verification outcomes, component version or commit, scenario ID, sanitized exchange shapes and test output. Include A and B correlation labels for replay without persisting their nonces or presentation bytes. Keep reports labeled `mock`.

Run the mock-verifier tests, then the relevant issuer/driver contract tests and the existing mock matrix. Coordinate any BFF/shared type or driver changes with the integrator; Person 1's capture tools require no such changes.

Person 1 supplies the shape-diff and issue-draft tools described in `CAPTURE.md`. They consume committed sanitized JSON only, never raw driver credentials. Their output is supporting evidence, not a protocol-conformance verdict. Send the final contract and sanitized test result back to the integrator before adding scenario claims to the matrix.
