# Technical Requirements Document (TRD)

**Project:** Inji Interoperability Playground
**Version:** 0.1 (design phase) · **Date:** 2026-10-17
**Related:** SRS.md, BACKEND.md, DATABASE.md, UIUX.md, decisions.md (reasons for every choice below), flow.md (how the code connects)

---

## 1. Architecture overview

```
┌────────────────────────────── Browser ──────────────────────────────┐
│ React + TS SPA (apps/web)                                           │
│  Selector · Run view · Inspector · Sequence · Report · History      │
└───────────────▲──────────────────────────────────┬──────────────────┘
                │ WebSocket (Socket.IO)            │ REST /api/v1
┌───────────────┴──────────────────────────────────▼──────────────────┐
│ Playground BFF (apps/bff, Node + Express + TS)                       │
│  Orchestrator ─ Drivers (issuer / wallet / verifier)                 │
│  Reference Wallet (OID4VCI + OID4VP client)   Tamper engine          │
│  Tap proxy + Recorder + Redaction             Report + Sequence gen  │
└───────┬──────────────┬───────────────┬───────────────┬───────────────┘
        │ via Tap      │ via Tap       │ via Tap       │
  Inji Certify     Mimoto ◄─ Inji Web   Inji Verify    Mock issuer / Mock verifier
        │                                                   (apps/mock-*)
        └──────── Postgres (runs, steps, exchanges, …) ─────┘
```

Core ideas:
1. **Adapters record authoritative boundaries.** Issuer, wallet and verifier adapters record the exact requests and responses they exchange. Proxy capture is added only for flows proven to tolerate it without changing signed issuer, audience, DID, request URI or redirect values.
2. **Drivers hide differences.** The orchestrator runs a fixed list of steps; each role has interchangeable drivers (Certify vs mock issuer, Reference Wallet vs Inji Web–assisted, Verify vs mock verifier).
3. **The recorded exchanges are the single source of truth.** The inspector, sequence diagram, report and history are all derived from stored exchanges and steps.

---

## 2. Technology choices

Reasons and trade-offs for each are logged in `decisions.md`.

| Area | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | `apps/web`, `apps/bff`, `apps/mock-issuer`, `apps/mock-verifier`, `packages/shared` |
| Language | TypeScript (strict) everywhere | One language across the stack |
| Frontend | React 18 + Vite + Tailwind CSS | SPA; no server rendering needed |
| Frontend state/data | TanStack Query for REST, Socket.IO client for live events | |
| Diagrams | mermaid.js | Generated from recorded exchanges |
| QR | `qrcode` (generate); `@mosip/pixelpass` for Inji-style compression (P2 probe) | |
| Verify SDK | `@mosip/react-inji-verify-sdk` used where it fits | Fall back to direct API calls through the Tap if the SDK bypasses it |
| BFF | Node 20 + Express 4 | |
| Validation | Zod, schemas shared via `packages/shared` | |
| Live events | Socket.IO (rooms per run) | |
| HTTP proxy | `http-proxy-middleware` | Optional capture for compatible browser flows; not the primary recorder |
| HTTP client | `undici` (built into Node) | Used by drivers; also routed through the Tap |
| Crypto/JWT | `jose` | JWS/JWT signing and verification |
| SD-JWT | `@sd-jwt/sd-jwt-vc` (and `@sd-jwt/core`) | Disclosures, key-binding |
| JSON-LD VC | `jsonld-signatures` + `@digitalbazaar/ed25519-signature-2020` (verify only, if needed) | Wallet mostly stores and forwards; see risk R-6 |
| mDoc | Deferred; mock mode only | P2 |
| DB | PostgreSQL 16 + Prisma | See DATABASE.md |
| Logging | `pino` JSON logs with run id | |
| Testing | Vitest (unit), Supertest (API), Playwright (one end-to-end smoke test) | |
| Packaging | Docker Compose with profiles `core`, `mocks`, `full` | |
| CI (P1) | GitHub Actions: lint, typecheck, unit tests, compose smoke test | |

Not used in v1 (deliberately): Redis, message queue, authentication service. See decisions.md.

---

## 3. Components

### 3.1 Orchestrator (`apps/bff/src/orchestrator`)
- Creates a run, resolves drivers, executes steps in order, records step status, evaluates the outcome and writes the report.
- Steps (in order): `INIT` → `ISSUE_OFFER` → `ISSUE_TOKEN` → `ISSUE_CREDENTIAL` → `STORE` → `PRESENT_REQUEST` → `PRESENT_SUBMIT` → `PRESENT_STATUS` → `PRESENT_RESULT` → `EVALUATE` → `REPORT`.
- Each step emits `step:started` / `step:finished` events. Failures stop the run with a stable error code.
- Supports **issue-only**, **present-only on an existing credential** (replay/tamper) and **full** runs.

### 3.2 Drivers (`apps/bff/src/drivers`)
Interfaces (simplified):

```ts
interface IssuerDriver { createOffer(ctx): Promise<Offer>; metadata(ctx): Promise<IssuerMetadata>; }
interface WalletDriver { acceptOffer(ctx, offer): Promise<IssuedCredential>;
                         present(ctx, request, credential): Promise<Submission>; }
interface VerifierDriver { createRequest(ctx): Promise<VpRequest>; status(ctx, id): Promise<Status>;
                           result(ctx, txnId): Promise<VerifyResult>; }
```

| Role | Driver | Behaviour |
|---|---|---|
| Issuer | `certify` | Calls Inji Certify through the Tap. ⚠ P-001 decides the grant flow. |
| Issuer | `mockIssuer` | Calls the mock external issuer container |
| Wallet | `referenceWallet` | Headless client: fetches metadata, exchanges code for token, builds proof of possession, requests credential; builds `vp_token` and posts it to the verifier |
| Wallet | `injiWebAssisted` | The user acts in Inji Web; the driver waits for Tap-observed calls and advances the run. ⚠ P-002 for presentation. |
| Verifier | `injiVerify` | Version-aware adapter; current Collab uses `POST /v2/vp-request` with DCQL, signed request retrieval, v2 submission, status and result endpoints |
| Verifier | `mockVerifier` | Mock external OpenID4VP verifier |

### 3.3 Recorder and optional Tap (`apps/bff/src/recorder`, `apps/bff/src/tap`)

Phase 3 also provides separate localhost mock issuer and verifier processes. The BFF selects their real HTTP boundaries through `MOCK_ISSUER_BASE_URL` and `MOCK_VERIFIER_BASE_URL`; without those values, its in-process mock roles remain available for tests. The standalone issuer can sign with an operator-supplied X.509 key and chain so its SD-JWT passes the tested Inji Verify path; `pnpm dev:x509-mock` generates an ephemeral self-signed pair for a repeatable test. The standalone mock verifier checks cryptographic consistency but does not establish certificate-chain trust. The public Collab Verify positive test with a self-signed certificate likewise does not prove trust-anchor validation.
- Drivers call the recorder around external exchanges, preserving the original protocol URL and payload.
- The recorder stores method, URL, redacted headers, size-capped bodies, status, timing, provenance and actor pair.
- Redaction removes or hashes `Authorization`, `access_token`, `pre-authorized_code`, `refresh_token`, `c_nonce` where needed, and private JWK fields before persistence.
- An optional Tap route may observe compatible browser flows after a contract test proves that proxying requires no signed-value rewriting.
- Recording emits `exchange:recorded` through the WebSocket gateway.

### 3.4 Reference Wallet (`apps/bff/src/wallet`)
- OpenID4VCI draft 13 client: issuer metadata → token request → proof JWT (`openid4vci-proof+jwt`) → credential request → store.
- OpenID4VP draft 21 client: parse authorization request → build submission for the `presentation_definition` → `direct_post` to verifier.
- Holds a per-run key pair (ES256 or Ed25519 depending on the format) generated at run start. Keys never leave the BFF process memory and are not stored.

### 3.5 Tamper engine (`apps/bff/src/tamper`)
Pure functions taking a credential or presentation and returning a modified copy plus an **expected outcome**:

| Tamper | Effect | Expected verifier outcome |
|---|---|---|
| `expired` | Rewrite or re-issue with `exp` in the past | Valid but expired / Invalid |
| `badSignature` | Flip bytes in the signature | Invalid |
| `wrongType` | Change `type` / `vct` | Invalid or rejected for request mismatch |
| `missingDisclosure` | Drop a required SD-JWT disclosure | Invalid or incomplete |
| `replayNonce` | Resubmit a used `vp_token` | Rejected |

### 3.6 Report and sequence generators
- `report/`: builds JSON and Markdown from run, steps, exchanges and verification result.
- `sequence/`: converts ordered exchanges into Mermaid `sequenceDiagram` text with participant aliases per actor.

### 3.7 Mocks (`apps/mock-issuer`, `apps/mock-verifier`)
- Small Express apps written without any Inji code, following the public OpenID4VCI and OpenID4VP specs, to stand in for "other ecosystem" software.
- Mock issuer: metadata, token, credential endpoints; issues SD-JWT VC signed with `jose`.
- Mock verifier: creates requests with `presentation_definition`, accepts `direct_post`, validates SD-JWT VC.

### 3.8 Frontend (`apps/web`)
Described in UIUX.md. Key modules: `pages/Playground`, `components/RoleSelector`, `components/RunTimeline`, `components/Inspector`, `components/SequenceDiagram`, `components/ReportView`, `pages/History`, `pages/Matrix`, `lib/api.ts`, `lib/socket.ts`.

---

## 4. Environments and configuration

| Variable | Purpose |
|---|---|
| `CERTIFY_BASE_URL`, `MIMOTO_BASE_URL`, `VERIFY_BASE_URL`, `ESIGNET_BASE_URL` | Real service URLs (local or Collab); adapters discover capabilities from metadata/OpenAPI |
| `MOCK_ISSUER_BASE_URL`, `MOCK_VERIFIER_BASE_URL` | Mock services |
| `MOCK_ISSUER_SIGNING_KEY_PATH`, `MOCK_ISSUER_CERT_CHAIN_PATH`, `MOCK_ISSUER_ISSUER_ID` | Optional PEM-backed X.509 test issuer; key kept outside the repository and issuer ID must be HTTPS and match the leaf certificate hostname |
| `MOCK_ISSUER_VERSION_LABEL` | Optional BFF snapshot label for an external mock issuer; `unreported` when absent |
| `PUBLIC_BASE_URL` | Public URL used in QR codes and callbacks (ngrok or reverse proxy when needed) |
| `DATABASE_URL` | Postgres connection |
| `TAP_BODY_LIMIT_BYTES` | Cap for stored bodies |
| `ALLOWED_TARGET_HOSTS` | SSRF allow list |
| `LOG_LEVEL` | pino level |

Compose profiles: `core` (playground web, BFF, Postgres), `inji` (Certify, Mimoto, Inji Web, Verify and their dependencies), `mocks` (mock issuer/verifier). `full` = all. A **Collab mode** disables the `inji` profile and points the base URLs at the sandbox.

---

## 5. Security and privacy
1. Synthetic identities only; a banner states this in the UI.
2. Secrets are masked in the Tap before storage; the UI never receives unmasked secrets.
3. SSRF guard: any user-supplied URL must resolve to a host on `ALLOWED_TARGET_HOSTS`.
4. CORS: only the playground web origin is allowed on the BFF; the browser never calls Inji services directly.
5. Rate limit run creation per client to protect the shared stack.
6. No authentication in v1 (single-tenant demo). If deployed publicly, put it behind basic auth or a reverse proxy; recorded in decisions.md as an accepted trade-off.
7. Per-run keys exist only in memory.

---

## 6. Testing strategy
| Level | What | Tool |
|---|---|---|
| Unit | Redaction, tamper functions, report builder, Mermaid generator, schema validation | Vitest |
| Contract | Driver behaviour against recorded fixtures of real Inji responses | Vitest + fixtures captured in Spike M0 |
| API | Runs, reports, history, matrix endpoints | Supertest + test Postgres |
| End-to-end | One happy path against the mock services (fast) and one against real Inji (slow, optional in CI) | Playwright |
| Manual | Inji Web–assisted flow; QR scanning | Checklist in README |

Fixtures from real Inji traffic captured during M0 are committed so most tests run without the full stack.

---

## 7. CI/CD (P1)
GitHub Actions: install → lint → typecheck → unit tests → build images → compose smoke test with the `core` and `mocks` profiles. A nightly workflow (bonus) runs the full matrix against the Collab environment and posts the matrix as an artifact.

---

## 8. Team split (2–4 people, about 1 week)

| Role | Owns | Days |
|---|---|---|
| **A: Stack & spikes** | Docker Compose for Inji services, Collab fallback, answers to P-001..P-004, fixtures | 1–3, then helps with mocks and CI |
| **B: BFF core** | Orchestrator, Tap, recorder, redaction, Postgres/Prisma, WebSocket gateway, drivers for Certify/Verify | 1–5 |
| **C: Frontend** | Selector, run view, inspector, report, history, matrix, sequence view | 2–6 |
| **D: Wallet & mocks** (or shared by A/B) | Reference Wallet, tamper engine, mock issuer/verifier, decoder | 2–6 |

With 2 people: merge A+B and C+D. With 3: merge A and D.

Day plan:
| Day | Target |
|---|---|
| 1 | Repo, compose skeleton, spikes started (get a credential, get a VP verified/rejected) |
| 2 | Spike results logged; shared schemas; BFF skeleton; web skeleton |
| 3 | Walking skeleton: run → Tap → live inspector |
| 4 | Both formats end to end; report |
| 5 | P0 complete; matrix; health view |
| 6 | Tamper, sequence diagram, history, mocks |
| 7 | Polish, README, demo video, interop report, gap write-up |

---

## 9. Technical risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Certify headless issuance flow unclear (P-001) | Spike on Day 1; decide the driver; fall back to Inji Web–assisted or Collab |
| R-2 | Inji Web may not support presentation (P-002) | Reference Wallet presents; label clearly |
| R-3 | `vp_token` shape mismatch with Verify (P-003) | Capture working traffic first; compare field by field |
| R-4 | Draft-version mismatch (draft 13 issuance, draft 21 presentation) | Pin implementation to those drafts; avoid newer features |
| R-5 | Proxying breaks redirect or QR flows | Per-run path prefix; test Inji Web early |
| R-6 | JSON-LD proof libraries add weight and complexity | Wallet stores and forwards the VC as issued; only verify locally if needed for the decoder |
| R-7 | Local resource use (many containers) | Compose profiles; Collab mode; document minimum RAM |
| R-8 | Time | Priority order P0 → P1 → P2; cut from the bottom |

---

## 10. Definition of done (per feature)
1. Requirement ID(s) from the SRS are listed in the pull request.
2. Unit tests cover the new logic.
3. Secrets masking checked for any new exchange type.
4. `decisions.md` has entries for meaningful choices; `flow.md` is updated for any new entry point, function or call path.
5. README or docs updated if setup or behaviour changed.
