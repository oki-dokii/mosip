# Person 3 Technical Implementation Plan: Protocol & Cross-Ecosystem Evidence

**Date:** 2026-10-25  
**Owner:** Person 3 (Protocol & Cross-Ecosystem Evidence)  
**Branch:** `person3/protocol-live-matrix-evidence`  
**Status:** Completed & Verified (All 20 Protocol Probe Cases Passing; Full Test Suite Green)  
**Review Standard:** Zero false positives, strict evidence tiers, airtight protocol boundaries, non-breaking schema expansions.

---

## 1. Executive Summary & Verified Baseline

Person 3 owns **protocol semantics, negative validation rigor, the expected-fail registry, cross-ecosystem interop analysis, and mobile protocol evidence**.

### Verified Starting Baseline (Commit `a638911` / Oct 23–25 Checkpoints)
1. **Mock Protocol Interop Suite (`spikes/`):** 12 independent local HTTP cases in `spikes/wallet-interop-cases.json` tested via `spikes/wallet-interop-probes.mjs` with runtime key generation, paired positive controls, and construction validation.
2. **BFF Protocol Integration (`apps/bff/`):** 6 strict presets (`000000000005`–`000000000010`) wired to `apps/mock-verifier` diagnostics (`diagnosticsVersion: 1`, `failure: {boundary, stage, code}`).
3. **Multi-Role Live Matrix (`apps/bff/src/matrix.ts`):** Supports combinations of issuers (`inji_certify`, `mock_issuer`), verifiers (`inji_verify`, `mock_verifier`), wallets (`reference_wallet`, `inji_web_assisted`, `inji_mobile`), and formats (`vc_sd_jwt`, `ldp_vc`).
4. **Android Journey (A2):** A hybrid pass (`A2-20261023-1848`) recorded in `submission/A2_MOBILE_EVIDENCE.md` utilizing *Local official Certify (tunneled HTTPS via `pnpm mobile:inji`) → Inji Android (1.0.0-alpha.1) → Collab Inji Verify*.
5. **Cross-Ecosystem Prior Art (`deploy/WALTID_COMPARISON.md`):** Complete architectural and protocol audit of walt.id v2 vs Inji completed by Person 4, documenting fundamental draft divergence (OIDC4VCI/VP 1.0 final with DCQL and encrypted responses vs Inji draft-era DIF PE and cleartext direct-post).

---

## 2. Senior SWE Audit: Bugs Found in Initial Plan & Rectifications

| Bug ID | Severity | Root Cause in Initial Plan | Consequence to Project | Senior SWE Rectification in this Plan |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **Critical (Build Breaker)** | Adding new P1 cases with unmapped failure codes (`HOLDER_PROOF_EXPIRED`, `UNTRUSTED_ISSUER_CERT`, `PAYLOAD_TOO_LARGE`). | Hardcoded validator `validateCatalog()` in `wallet-interop-probes.mjs` and `knownCodes` in `wallet-interop-evaluate.mjs` throw `ProbeError("configuration")`, breaking `pnpm test` and CI. | Map new cases strictly to existing `@playground/mock-verifier/diagnostics` stages (`KB_TIME_INVALID`, `MALFORMED_PRESENTATION`, etc.) and bump/extend the schema validator synchronously across both runner and evaluator. |
| **BUG-02** | **Critical (Mobile Blocker)** | Assuming Android Inji Wallet can connect to local Inji Verify over raw LAN IP (`http://192.168.x.x`). | Android 14+ / React Native strictly enforces `CLEARTEXT_NOT_PERMITTED` and rejects untrusted TLS certificates. Physical phone will fail with transport errors. | Formally declare Person 4's HTTPS tunnel/trusted proxy for local Verify as a blocking prerequisite for A2; define an honest stopping rule if untunneled. |
| **BUG-03** | **High (Wasted Velocity)** | Planning an independent audit and driver script for walt.id v2 from scratch. | Person 4 already documented in `deploy/WALTID_COMPARISON.md` that walt.id v2 (DCQL, encrypted `direct_post.jwt`) does not align with Inji draft-era specs. Attempting code violates the stopping rule. | Consume `deploy/WALTID_COMPARISON.md`, formalize the protocol mismatch finding in `GAPS.md`, and record the matrix cell as `not_tested (protocol draft mismatch)`. |
| **BUG-04** | **High (Scope Conflation)** | Conflating the 12-case local mock probe script with the multi-role "Live Matrix". | Misses the core P0 deliverable: establishing positive controls across real local services (`inji_certify`, `inji_verify`) vs mocks. | Explicitly separate the **Local Mock Probe Harness** from the **Live Multi-Role Matrix** (`apps/bff/src/matrix.ts`). |
| **BUG-05** | **High (False Inconclusive)** | Expecting mock diagnostic codes (`diagnosticsVersion: 1`) from real Inji Verify. | Real Inji Verify returns standard HTTP 400 or `valid: false` without MOSIP mock diagnostic headers. Evaluator marks all live negative cases `inconclusive`. | Implement tiered evaluation: strict diagnostic code verification for `mock_verifier`, and macroscopic verdict validation (`correct_rejection` via HTTP 400 or `outcome: invalid`) for real `inji_verify`. |
| **BUG-06** | **Medium (Missing Assignment)** | Omission of scheduled `collab.ts` post-integration refactoring. | Leaves Person 3 unprepared for the designated integrator handoff. | Add scheduled Workstream 6 for behavior-preserving `collab.ts` refactoring with baseline snapshot tests. |

---

## 3. Work Breakdown & Detailed Execution Strategy

```
                                  PERSON 3 EXECUTION ARCHITECTURE
                                  
   +------------------------------------------------------------------------------------------+
   |                                P0: CORE PROTOCOL & EVIDENCE                              |
   +------------------------------------------------------------------------------------------+
   |                                                                                          |
   |  [Workstream 1: Live Matrix & Positive Controls]                                         |
   |  - Pinned positive controls (inji_certify -> ref_wallet -> inji_verify)                  |
   |  - Re-run strongest Verify findings (X.509 vs did:jwk, nonce 400 direct-post)            |
   |  - Tiered evaluation (mock diagnostics vs live HTTP 400 / invalid)                        |
   |                                                                                          |
   |  [Workstream 2: All-Local Android Journey (A2)]                                          |
   |  - Consume Person 4 HTTPS tunneled endpoints for Local Certify + Local Verify            |
   |  - Real Android Inji Wallet: Scan -> Download -> Reopen persist -> Present to Local Verify|
   |  - Capture sanitized evidence (manifest, redacted screenshots, correlated JSON)         |
   |                                                                                          |
   |  [Workstream 3: External Ecosystem Profile Evaluation]                                   |
   |  - Leverage deploy/WALTID_COMPARISON.md findings                                         |
   |  - Record protocol draft divergence in GAPS.md (DCQL/encrypted response vs DIF-PE)       |
   |  - Mark matrix cell: not_tested (protocol mismatch) per stopping rules                   |
   +------------------------------------------------------------------------------------------+
                                              |
                                              v
   +------------------------------------------------------------------------------------------+
   |                             P1: TEST SUITE & REGISTRY EXPANSION                          |
   +------------------------------------------------------------------------------------------+
   |  [Workstream 4: Expand Spec-Cited Catalogue to 25-40 Cases]                              |
   |  - Synchronized updates to diagnostics.ts, wallet-interop-evaluate.mjs & probes.mjs      |
   |  - Add non-breaking cases: signed nbf, clock skew, KB time invalid, malformed envelope    |
   |                                                                                          |
   |  [Workstream 5: Expected-Fail Registry & Upstream Tracking]                              |
   |  - Maintain GAPS.md with reproducible synthetic steps                                    |
   |  - Private security triage under SECURITY.md for cryptographic anomalies                 |
   +------------------------------------------------------------------------------------------+
                                              |
                                              v
   +------------------------------------------------------------------------------------------+
   |                               STRETCH / SEAM HANDOFF                                     |
   +------------------------------------------------------------------------------------------+
   |  [Workstream 6: Post-Integration Refactor of collab.ts]                                  |
   |  - Scheduled after live journey freezes                                                  |
   |  - Behavior-preserving tests + clean driver decomposition                                |
   +------------------------------------------------------------------------------------------+
```

---

### Workstream 1: Version-Pinned Live Matrix with Positive Controls (P0)

* **Objective:** Produce a definitive, reproducible multi-role matrix report (`apps/bff/src/matrix.ts`) with positive controls for every tested cell.
* **Architecture & Distinctions:**
  1. **Positive Control Grid:**
     - `inji_certify` (local official) + `reference_wallet` + `inji_verify` (local official) -> `valid` (SD-JWT)
     - `mock_issuer` (X.509) + `reference_wallet` + `inji_verify` (local official) -> `valid` (SD-JWT)
     - `inji_certify` (local official) + `reference_wallet` + `mock_verifier` -> `valid` (SD-JWT)
  2. **Re-running Strongest Local Verify Findings:**
     - **Finding A (Issuer Trust):** X.509 issuer accepted vs `did:jwk` issuer rejected by Inji Verify (G-01).
     - **Finding B (Transport Nonce Rejection):** Nonce mismatch at `direct-post` produces HTTP 400 `invalid_request` rather than an invalid result poll timeout.
     - **Finding C (Signed Semantic Faults):** Validly signed expired credential rejected at `result` boundary.
  3. **Tiered Evaluation Logic:**
     - For `mock_verifier`: Require `diagnosticsVersion: 1`, verifying exact stage and failure code.
     - For `inji_verify` (live/local): Require macroscopic correctness (HTTP 400 at `direct_post` or `outcome: "invalid"` with `credentialProofValid: false` at `result`). Do **not** fail live runs for missing mock diagnostic codes.
  4. **Strict Evidence Tiers:**
     - `mock`: local mock services.
     - `reference_wallet`: automated reference holder with local official containers.
     - `inji_web`: web wallet assisted runs.
     - `inji_mobile`: physical phone runs.
     - `not_tested`: untestable or blocked cells.
     - Any missing component version is recorded as `"unreported"`, never guessed.

---

### Workstream 2: All-Local Android Journey (Inji Wallet → Local Certify + Local Verify) (P0)

* **Objective:** Complete the true all-local A2 mobile loop, eliminating reliance on public Collab Verify.
  $$\text{Local Official Certify} \xrightarrow[\text{HTTPS Tunnel}]{\text{Pre-Auth Offer}} \text{Inji Android Wallet} \xrightarrow[\text{HTTPS Tunnel}]{\text{OpenID4VP Presentation}} \textbf{Local Official Verify}$$
* **Prerequisites (Person 4 Dependency Gate):**
  - Android cannot connect to cleartext HTTP or private untrusted IPs. Person 4 must provide an HTTPS route (via `cloudflared` tunnel or local reverse proxy with installed root CA) for both Local Certify and Local Verify.
  - If Person 4's tunnel is only wired to Certify, presentation to local Verify cannot proceed over the air.
* **Step-by-Step Execution:**
  1. Launch `pnpm mobile:inji` (or Person 4's upgraded dual-tunnel profile).
  2. Confirm automated reference wallet control passes on local stack.
  3. Generate fresh pre-authorized SD-JWT issuance QR on local console.
  4. Physical Android phone (Nothing Phone 2a, Inji `1.0.0-alpha.1`):
     - Scan QR -> Download card -> Confirm "Playground SD-JWT Identity" appears in wallet.
     - Force close app and reopen: confirm wallet persistence across restarts.
  5. Generate OpenID4VP presentation QR targeting **Local Inji Verify**.
  6. Scan presentation QR with Inji Wallet, select credential, and confirm consent.
  7. Read Local Verify terminal result:
     - Verify HTTP 200, `valid`, `credentialProofValid: true`, `holderProofValid: true`.
  8. Capture sanitized evidence:
     - Redact device identifier, timestamps, personal data.
     - Store 4 screenshots and JSON manifest in `submission/evidence/person3-a2-local-YYYY-MM-DD/`.
     - Update `submission/A2_MOBILE_EVIDENCE.md`.
  9. **Stopping Rule:** If local Verify is unreachable due to cleartext HTTP blocking (`CLEARTEXT_NOT_PERMITTED`) or SSL handshake failure, document the exact network checkpoint in `submission/A2_MOBILE_EVIDENCE.md`, mark local mobile presentation `blocked (requires HTTPS tunnel for local verify)`, and stop.

---

### Workstream 3: External Ecosystem Profile Evaluation (walt.id v2) (P0)

* **Objective:** Execute the gated task: *"Add one independently implemented external issuer or verifier profile only if protocol versions align."*
* **Evaluation & Decision:**
  1. Review Person 4's exhaustive technical analysis in `deploy/WALTID_COMPARISON.md`.
  2. Protocol Alignment Audit:
     - **OpenID4VCI:** walt.id v2 implements final 1.0; Inji Certify implements draft-era pre-authorized endpoints.
     - **OpenID4VP Query:** walt.id Verifier 2 defaults to DCQL (`dcql_query`); Inji Verify requires DIF Presentation Exchange 2.0 (`presentation_definition`).
     - **Response Mode:** walt.id Verifier 2 enforces encrypted `direct_post.jwt`; Inji Verify accepts unencrypted `direct_post`.
     - **Trust Model:** walt.id enforces EUDI / ETSI trust anchors; Inji uses MOSIP Keymanager.
  3. **Verdict:** Protocol versions **do not align**. Creating a live HTTP adapter against walt.id v2 would require implementing DCQL translation, JWE encryption, and draft-1.0 bridges, which violates the strict stopping rule:
     > *"Stop an exploratory track when it cannot produce a reviewable result before the working code freeze; mark it `not_implemented` or `not_tested`."*
  4. **Deliverable:**
     - Record the verified protocol divergence in `GAPS.md` as an interoperability finding.
     - Mark the external cross-ecosystem matrix cell as `not_tested (protocol draft mismatch: DCQL vs DIF PE)`.

---

### Workstream 4: Expanding Spec-Cited Catalogue to 25–40 Cases (P1)

* **Objective:** Expand protocol negative test coverage while preserving 100% backward compatibility and test stability.
* **Strict Architecture Rule:** All new cases MUST synchronize across three layers:
  1. `apps/mock-verifier/src/diagnostics.ts` (rejection codes & stages)
  2. `spikes/wallet-interop-evaluate.mjs` (`knownCodes`)
  3. `spikes/wallet-interop-probes.mjs` (`validateCatalog()` & probe dispatch)

#### Approved New Test Cases (Mapped to Valid Diagnostic Stages)

| Case ID | Fault Name | Diagnostic Code | Stage | Spec Reference |
| :--- | :--- | :--- | :--- | :--- |
| `p3.credential.not_yet_valid` | `not_yet_valid` | `CREDENTIAL_NOT_YET_VALID` | `credential_time` | RFC 7519 §4.1.5 (`nbf` in future) |
| `p3.holder.expired_proof` | `expired_kb` | `KB_TIME_INVALID` | `holder_time` | RFC 9901 §7.3 (Key Binding `exp` in past) |
| `p3.holder.sd_hash_tamper` | `sd_hash_mismatch` | `SD_HASH_MISMATCH` | `binding_hash` | RFC 9901 §7.3 (`sd_hash` mismatch in KB-JWT) |
| `p3.holder.invalid_key` | `invalid_holder_key` | `INVALID_HOLDER_KEY` | `holder_binding` | RFC 9901 §7.3 (unsupported curve/format) |
| `p3.profile.kb_type_mismatch` | `kb_type_mismatch` | `KB_TYPE_MISMATCH` | `holder_proof` | RFC 9901 §7.3 (`typ` header != `kb+jwt`) |
| `p3.disclosure.digest_mismatch`| `digest_mismatch` | `DISCLOSURE_DIGEST_MISMATCH` | `disclosures` | RFC 9901 §4.2 (tampered disclosure salt/value) |
| `p3.disclosure.malformed` | `malformed_disclosure`| `MALFORMED_DISCLOSURE` | `disclosures` | RFC 9901 §4.2 (non-array / invalid JSON) |
| `p3.transport.invalid_token` | `invalid_vp_token` | `INVALID_VP_TOKEN` | `transport` | OpenID4VP 1.0 §8.2 (empty/invalid envelope) |
| `p3.transport.request_expired` | `request_expired` | `REQUEST_EXPIRED` | `state` | OpenID4VP 1.0 §8.2 (challenge TTL exceeded) |
| `p3.structure.malformed` | `malformed_presentation`| `MALFORMED_PRESENTATION` | `structure` | RFC 7515 §5.2 / RFC 9901 §5 |

* **Harness Upgrades:**
  - Update `validateCatalog()` in `spikes/wallet-interop-probes.mjs` to accept dynamic extensible catalog sizes while enforcing strict schema definitions.
  - Pair each new case with an automated baseline positive control execution.

---

### Workstream 5: Version-Pinned Expected-Fail Registry & GAPS Tracking (P1)

* **Objective:** Maintain `GAPS.md` and `submission/SCENARIO_SPEC_MAP.md` as an authoritative engineering findings register.
* **Rules:**
  1. Every entry must cite exact software versions or explicitly state `unreported`.
  2. Redact all canary tokens, private keys, student identifiers, and raw session URLs.
  3. Classify gaps accurately: `technical`, `semantic`, or `organisational`.
  4. For any security anomaly found (e.g., unintended cryptographic bypass), enforce private coordination under `SECURITY.md`.

---

### Workstream 6: Post-Integration Refactor of `collab.ts` (Scheduled Hand-off)

* **Objective:** Execute the assigned post-integration refactoring of `apps/bff/src/drivers/collab.ts` once the live journey stabilizes.
* **Execution Plan:**
  1. Freeze baseline behavior with comprehensive snapshot and contract tests.
  2. Extract driver into distinct sub-modules:
     - `collab-auth.ts`: token and session handling.
     - `collab-certify.ts`: issuance and credential retrieval.
     - `collab-verify.ts`: presentation challenge and verification polling.
  3. Ensure 100% pass on `apps/bff/src/protocol-integration.test.ts`.

---

## 4. File Boundaries & Clean Seams

### Person 3 Owned Paths (Write Access)
* `apps/mock-issuer/`
* `apps/mock-verifier/`
* `apps/bff/src/tamper/`
* `spikes/`
* `GAPS.md`
* `submission/SCENARIO_SPEC_MAP.md`
* `submission/A2_MOBILE_EVIDENCE.md` and `submission/evidence/person3-*`

### Strict Off-Limits Paths (Zero Direct Edits)
* `docker-compose.yml`, Dockerfiles, `deploy/` *(Person 4)*
* `apps/web/`, `apps/web/browser/` *(Person 2)*
* `apps/bff/src/capture/`, `apps/bff/src/redaction/` *(Person 1)*
* `apps/bff/src/app.ts`, `packages/shared/`, root `package.json` *(Integrator)*

---

## 5. Execution Sequence & Checkpoints

```
[Phase 1] Baseline Audit & Live Matrix Setup
   ├── Step 1.1: Verify baseline test health (pnpm test, pnpm typecheck) -> PASSED
   ├── Step 1.2: Re-run strongest local Verify findings (X.509 vs did:jwk, nonce HTTP 400)
   └── Step 1.3: Run multi-role matrix export and verify positive control cells

[Phase 2] All-Local Android Verification (A2)
   ├── Step 2.1: Audit Person 4's HTTPS tunnel/endpoint readiness for Local Verify
   ├── Step 2.2: Perform physical Inji Wallet issuance from local Certify
   ├── Step 2.3: Test wallet persistence across app restart
   ├── Step 2.4: Execute OpenID4VP presentation to Local Verify (or record network blocker)
   └── Step 2.5: Publish sanitized evidence in submission/evidence/person3-a2-local-*

[Phase 3] Cross-Ecosystem Protocol Assessment
   ├── Step 3.1: Review deploy/WALTID_COMPARISON.md against prompt stopping rules
   ├── Step 3.2: Formalize protocol draft mismatch finding in GAPS.md
   └── Step 3.3: Mark matrix cell not_tested (protocol draft mismatch)

[Phase 4] Spec-Cited Catalogue Expansion (P1)
   ├── Step 4.1: Synchronize diagnostics.ts, wallet-interop-evaluate.mjs, and probes.mjs
   ├── Step 4.2: Add approved new cases (nbf, clock skew, KB time invalid, malformed envelope)
   └── Step 4.3: Verify 100% paired positive controls execute cleanly

[Phase 5] Integrator Hand-off & collab.ts Refactor
   ├── Step 5.1: Update submission/SCENARIO_SPEC_MAP.md
   ├── Step 5.2: Execute behavior-preserving refactor of collab.ts
   └── Step 5.3: Submit branch person3/protocol-live-matrix-evidence for merge
```
