# flow.md

How code travels between files and functions: **entry points, order of execution, and who calls whom.**

> **Status: PHASE 3 P1 ACCEPTANCE PASSED.** The BFF selects deterministic fixtures by default or live Collab plus mock roles through `PLAYGROUND_DRIVER_MODE=collab`. It selects PostgreSQL when `DATABASE_URL` is configured and otherwise uses an in-memory repository. Replay, reports, sequence playback, filtered history, matrix exports, and X.509 mock-issuer interoperability with Inji Verify are implemented. Assisted Inji Web presentation and transparent Tap capture remain open.

Legend: `file → function()` means "this function in that file". `A ⇒ B` means A calls B. Status: 🟦 planned · 🟩 implemented · 🟥 changed from plan (explain in decisions.md).

---

## 1. Entry points

### Contract spike 🟩

`node spikes/collab-contract-spike.mjs`
⇒ discover live Certify metadata and Verify OpenAPI
⇒ execute synthetic Certify pre-authorized issuance attempts for SD-JWT and JSON-LD
⇒ create and retrieve a synthetic Verify v2/DCQL request
⇒ submit a synthetic wallet cancellation and read status/result error
⇒ print a sanitized capability summary

`node --test spikes/collab-contracts.test.mjs`
⇒ load the contract, JSON-LD, and SD-JWT fixtures in `spikes/fixtures`
⇒ assert the pinned adapter contracts, both successful verification results, and reject secret-bearing fields/JWT values

`node spikes/collab-reference-wallet.mjs`
⇒ read the official public Collab client configuration from `OFFICIAL_POSTMAN_ENV_PATH`
⇒ complete eSignet authorization code with PKCE and obtain the issuer nonce
⇒ issue JSON-LD by default, or SD-JWT through environment-selected configuration
⇒ build an Ed25519 presentation proof or SD-JWT key-binding JWT
⇒ submit the DCQL response and fetch the Verify v2 result
⇒ print only a sanitized status summary

`MOCK_ISSUER_BASE_URL=http://127.0.0.1:4101 node spikes/mock-x509-verify.mjs`
⇒ issue a synthetic credential from the separately running X.509 mock issuer
⇒ present it to public Inji Verify through the Reference Wallet driver
⇒ print only status, outcome, and a safe failure category; `TAMPER_KIND=bad_signature` tests rejection

| Entry | File | What starts it | Status |
|---|---|---|---|
| BFF process | `apps/bff/src/server.ts` | `pnpm --filter @playground/bff dev` or `node dist/server.js` | 🟩 |
| Web app | `apps/web/src/main.tsx` | `pnpm --filter @playground/web dev` / built static files | 🟩 |
| Mock issuer | `apps/mock-issuer/src/server.ts` | `pnpm dev` or `node apps/mock-issuer/dist/server.js` | 🟩 |
| Mock verifier | `apps/mock-verifier/src/server.ts` | `pnpm dev` or `node apps/mock-verifier/dist/server.js` | 🟩 |
| DB migrations | `apps/bff/prisma/migrations` | `pnpm db:deploy` | 🟩 |
| DB seeds | `apps/bff/prisma/seed.ts` | Future preset-scenario seed | 🟦 |
| Nightly matrix runner (bonus) | `apps/bff/src/cli/nightly.ts` | GitHub Actions schedule | 🟦 |

---

## 2. Startup order (BFF walking skeleton) 🟩

1. `server.ts` ⇒ `store.ts → createRunRepository()` (`DATABASE_URL` selects Prisma; otherwise memory)
2. ⇒ `app.ts → buildApp(() => io, repository)`
3. ⇒ `http.createServer(app)`
4. ⇒ attach Socket.IO namespace `/runs`; clients join room `run:{runId}`
5. ⇒ `httpServer.listen(PORT)` (default `4000`)

Environment validation, database startup, structured logging, rate limiting, and graceful shutdown remain planned.

---

## 3. Main flow: "Run flow" button to final report

### 3.1 Frontend side 🟩
1. `App.tsx → startRun()`
2. ⇒ `lib/api.ts → createRun(config)` → `POST /api/v1/runs`
3. ⇒ connect Socket.IO namespace `/runs` and emit `join(runId)`; start a 500 ms polling fallback
4. Socket events or polling ⇒ `App.tsx → refresh(runId)` ⇒ fetch run, steps, and exchanges
5. ⇒ update `RunTimeline` and `Inspector`; selecting a step selects its recorded exchange

### 3.2 BFF side: implemented driver-backed order 🟩

```
app.ts → POST /api/v1/runs
  ⇒ packages/shared → runConfigSchema.safeParse(body)
  ⇒ store.ts → repository.create(run plus createSteps(runId))
  ⇒ return 202 { runId }
  ⇒ orchestrator.ts → runDemo(runId, io)
       ⇒ mark run running; emit run:created
       ⇒ drivers/registry.ts → resolve fixture or Collab role drivers
       ⇒ for each step:
            INIT → ISSUE_OFFER → ISSUE_TOKEN → ISSUE_CREDENTIAL → STORE
            → PRESENT_REQUEST → PRESENT_SUBMIT → PRESENT_STATUS → PRESENT_RESULT → REPORT
            ⇒ emit step:started
            ⇒ call the responsible issuer, wallet, or verifier driver
            ⇒ redact each returned exchange before persistence
            ⇒ repository.addExchange(); emit exchange:recorded
            ⇒ repository.updateStep(succeeded); emit step:finished
       ⇒ repository.updateRun(passed/failed/errored); emit run:finished
```

`GET /api/v1/runs/:id`, `/steps`, and `/exchanges` read through the same repository. PostgreSQL records survive BFF restarts; memory records intentionally do not. Run configuration can select a tamper; the wallet applies it immediately before presentation, and the orchestrator marks the run passed when the verifier's invalid result matches the expected invalid outcome. Reports and sequence output are generated only from these already-redacted records.

### 3.3 Where exchange data is recorded

Fixture and Collab drivers return protocol exchanges to `orchestrator.ts`, which passes request and response objects through `redaction.ts → redact()` before writing them to `store.ts`. The Collab driver retains credentials, keys, cookies, bearer tokens, and complete presentations only in its per-run in-memory state and emits safe summaries for inspection.

The previously designed transparent Tap remains optional and planned. Its proposed path is:

```
client request → /tap/:runId/:service/*
  ⇒ tap/proxy.ts → forward()
       ⇒ buffers request body (size cap)
       ⇒ proxies to real service base URL
       ⇒ buffers response body
       ⇒ tap/redaction.ts → redact(exchange)
       ⇒ tap/recorder.ts → record(runId, exchange)
            ⇒ db: INSERT exchanges
            ⇒ ws/gateway.ts → emitToRun(runId, "exchange:recorded", meta)
  ⇒ returns the upstream response to the caller (Location headers rewritten to the Tap)
```

---

## 4. Driver call paths

### 4.1 Certify issuer (`drivers/collab.ts`) 🟩
`createOffer(ctx)` ⇒ load and validate Collab runtime configuration ⇒ `GET /.well-known/openid-credential-issuer` ⇒ require the chosen credential configuration.

### 4.2 Reference Wallet (`drivers/collab.ts`) 🟩
`authorize(ctx)` ⇒ eSignet CSRF → OAuth details with PKCE → OTP → authenticate → authorization code → token → issuer nonce.

`requestCredential(ctx)` ⇒ generate an in-memory Ed25519 holder key ⇒ create OpenID4VCI proof JWT ⇒ request credential ⇒ retry once with a refreshed nonce when required.

`present(ctx)` ⇒ validate credential-to-holder binding ⇒ build JSON-LD `Ed25519Signature2020` VP or SD-JWT `kb+jwt` ⇒ DCQL direct post.

When `config.tamper` is set, `tamper/index.ts → applyCredentialTamper()` changes the credential or presentation nonce before the holder proof is created. The untampered issued credential remains only in per-run memory.

### 4.3 Inji Web assisted (`drivers/wallet/injiWebAssisted.ts`) 🟦
`acceptOffer(ctx, offer)` ⇒ emit `action:required (open_inji_web)` ⇒ wait on `tap/recorder.ts → waitForExchange(runId, matcher)` until issuance calls are seen ⇒ read the credential from the recorded response.

### 4.4 Inji Verify (`drivers/collab.ts`) 🟩
- `createRequest` ⇒ `POST /v2/vp-request` with DCQL ⇒ fetch and decode the signed request object.
- `pollStatus` ⇒ `GET /vp-request/{requestId}/status` until `VP_SUBMITTED`, a terminal failure, or the configured deadline.
- `getResult` ⇒ `POST /v2/vp-results/{transactionId}` ⇒ map verification checks to the run outcome.

### 4.5 Local non-Inji mocks (`drivers/collab.ts`) 🟩 SD-JWT
With `MOCK_ISSUER_BASE_URL`, `MockIssuerDriver.createOffer()` ⇒ fetch the standalone issuer's discovery document. `CollabWalletDriver.authorize()` ⇒ form-encoded pre-authorized token exchange. `requestCredential()` ⇒ generate a holder proof JWT and call the issuer's `/credential` endpoint. `apps/mock-issuer/src/server.ts` validates the token, nonce, and holder proof, then signs a holder-bound SD-JWT. Without the URL, these steps use the in-process mock and `mock://` transport markers.

For optional X.509 mode, `apps/mock-issuer/src/signing.ts → loadIssuerSigner()` reads the PEM key and chain before the server listens, verifies that the leaf matches the key and HTTPS issuer hostname, and returns the `x5c` signing header. `scripts/dev-x509-mock.sh` creates an ephemeral test certificate, sets the mock endpoint and version label, then starts `pnpm dev`. `apps/bff/src/drivers/collab.ts → loadConfig()` skips Certify OAuth configuration for mock-issuer runs. The default in-memory mock keeps its `did:jwk` key path.

With `MOCK_VERIFIER_BASE_URL`, `MockVerifierDriver.createRequest()` ⇒ call the standalone `/vp-request` endpoint. `CollabWalletDriver.present()` ⇒ create a key-bound SD-JWT and post it to `/direct-post`. `pollStatus()` ⇒ read `/status/:id`. `getResult()` ⇒ read `/result/:id`. `apps/mock-verifier/src/verify.ts` checks issuer signature, type, expiry, holder proof, nonce, audience, and disclosure digests. Without the URL, the same checks run in the BFF's in-process mock. The embedded Certify certificate's trust chain is not checked.

---

## 5. Secondary flows

### 5.1 Replay with tamper 🟩
`POST /api/v1/runs/:id/replay` ⇒ require a passed or mismatched source run ⇒ clone its combination with the requested tamper ⇒ create a full child run with `parent_run_id` ⇒ execute the normal driver-backed flow with fresh credentials and protocol state. Re-running issuance follows D-015 because reusable tokens and credentials are not persisted.

### 5.2 Report download 🟩
`GET /api/v1/runs/:id/report?format=md|json` ⇒ load the stored run record ⇒ `report.ts → buildReport()` ⇒ return structured JSON or `renderMarkdown()` with sanitized exchanges.

### 5.3 Sequence view 🟩
`GET /api/v1/runs/:id/sequence` ⇒ `sequence.ts → buildSequence(exchanges)` ⇒ return Mermaid text plus exchange/step line markers. `SequenceView.tsx` renders recorded messages as an actor-to-actor list and reveals them one at a time during playback. Selecting a message selects its exact exchange and the corresponding timeline step. Mermaid source can be copied for external rendering.

### 5.4 History and matrix 🟩
`GET /api/v1/runs` ⇒ `repository.list()` ⇒ `history.ts → filterRuns()` ⇒ newest-first run summaries displayed by `RunArchive.tsx`; role, format, status, fault, and version filters can be applied. Selecting a row opens that run.

`GET /api/v1/matrix` ⇒ `matrix.ts → latestMatrix()` ⇒ newest run for each complete role/format/flow/fault combination. `GET /api/v1/matrix/export?format=json|csv|md` renders the same snapshot for download.

### 5.5 Health
`GET /health` ⇒ `healthService.check()` ⇒ parallel pings to each configured service plus a DB query ⇒ list of `{name, status, version, latencyMs}`.

### 5.6 Issue draft (P2)
`POST /runs/:id/issue-draft` ⇒ `issueDraftService.build(runId)` ⇒ `INSERT issue_drafts`.

---

## 6. Module dependency rules

Allowed direction of calls (lower layers never import upper ones):

```
routes → controllers → services → orchestrator → drivers → wallet / tap helpers
                                  └────────────→ db, ws (via small interfaces)
```

- `drivers/*` never import from `services/*` or `routes/*`.
- `tap/*` never imports from `drivers/*`.
- `tamper/*`, `report/*`, `sequence/*` are pure functions: no database or network access.
- `packages/shared` is imported by `apps/web` and `apps/bff`; it imports from neither.

---

## 7. File responsibility map

| File | Owns |
|---|---|
| `server.ts` | Process start and shutdown |
| `app.ts` | Express wiring |
| `routes/*` | URL → controller mapping only |
| `controllers/*` | Parse and validate input, call a service, shape the response |
| `services/*` | Business operations (runs, reports, matrix, health) |
| `orchestrator/*` | Step order, state transitions, outcome evaluation |
| `drivers/*` | Talking to one implementation of one role |
| `wallet/*` | Protocol client logic and keys |
| `tap/*` | Forwarding, recording, redaction |
| `tamper/*` | Deliberate corruption plus expected outcome |
| `report/*`, `sequence/*` | Rendering from stored data |
| `ws/gateway.ts` | Socket.IO rooms and emit helpers |
| `db/client.ts` | Prisma client |

Current M1 files:

| File | Owns |
|---|---|
| `apps/web/src/App.tsx` | Run configuration, Socket.IO/polling refresh, screen composition |
| `apps/web/src/components/*` | Role selectors, timeline, and exchange inspector |
| `apps/web/src/lib/api.ts` | Typed browser calls to the BFF |
| `apps/bff/src/server.ts` | HTTP and Socket.IO process wiring |
| `apps/bff/src/app.ts` | Implemented REST routes and run creation |
| `apps/bff/src/orchestrator.ts` | Driver-backed ten-step run, events, redaction, and failure transitions |
| `apps/bff/src/drivers/types.ts` | Issuer, wallet, verifier, and per-run context contracts |
| `apps/bff/src/drivers/fixture.ts` | Deterministic local driver set |
| `apps/bff/src/drivers/collab.ts` | Live Certify/eSignet, Reference Wallet, and Verify adapter |
| `apps/bff/src/tamper/index.ts` | Pure JSON-LD/SD-JWT fault injection and nonce replay simulation |
| `apps/bff/src/report.ts` | Sanitized JSON report model and Markdown rendering |
| `apps/bff/src/sequence.ts` | Mermaid sequence text and exchange-to-step markers |
| `apps/bff/src/matrix.ts` | Latest-combination projection and CSV/Markdown exports |
| `apps/bff/src/history.ts` | Run history filters |
| `apps/bff/src/capabilities.ts` | Live combination validation |
| `apps/bff/src/versions.ts` | Immutable service release-label snapshot |
| `apps/mock-issuer/src/server.ts` | Standalone test-only OpenID4VCI discovery, token, and credential endpoints |
| `apps/mock-verifier/src/server.ts` | Standalone test-only OpenID4VP request, direct-post, status, and result endpoints |
| `apps/mock-verifier/src/verify.ts` | Standalone SD-JWT issuer and holder proof checks |
| `apps/bff/src/redaction.ts` | Recursive write-time masking |
| `apps/bff/src/store.ts` | Repository contract plus memory and Prisma implementations |
| `apps/bff/prisma/schema.prisma` | Implemented PostgreSQL run, step, and exchange schema |
| `packages/shared/src/index.ts` | Shared Zod configuration schema and API types |

---

## 8. How to keep this file true

When you change code:
1. Find the section above that your change touches (new entry point, new function in a chain, new file, new call path, reordered steps).
2. Update the chain using the same `⇒` notation and set the status marker.
3. If you added a file, add it to §7; if you broke a dependency rule in §6, fix the code or record the exception in `decisions.md`.
4. If the order of steps changed, also update the step list in `BACKEND.md` §4 and the `run_steps.step_key` comment in `DATABASE.md`.
5. Add a line to the change log below.

### Change log
| Date | Change | By |
|---|---|---|
| 2026-10-17 | Initial planned flow | design phase |
| 2026-10-20 | Added completed Collab contract spike entry point; adapter recording replaces mandatory proxy routing | implementation |
| 2026-10-20 | Added token/JWKS diagnostics, Verify cancellation lifecycle, and sanitized contract fixture test | implementation |
| 2026-10-20 | Added the headless authorization-code Reference Wallet flow for JSON-LD and SD-JWT issuance, holder proof, DCQL direct post, and Verify results | implementation |
| 2026-10-21 | Added the M1 web/BFF walking skeleton, shared schemas, in-memory orchestration, live events, inspector, and write-time redaction | implementation |
| 2026-10-21 | Added Prisma/PostgreSQL run persistence, initial migration, repository fallback, and graceful disconnect | implementation |
| 2026-10-21 | Added Phase 3 local SD-JWT mock roles, exact-exchange sequence playback, filtered history, and service version snapshots | implementation |
| 2026-10-21 | Added optional X.509 signing and ephemeral test setup for the standalone mock issuer; removed unnecessary Certify OAuth configuration from mock-issuer runs | implementation |
| 2026-10-21 | Added a standalone OpenID4VCI mock issuer and an opt-in HTTP adapter in the Reference Wallet path | implementation |
| 2026-10-21 | Added a standalone OpenID4VP mock verifier, opt-in HTTP adapter, and reliable signature fault mutation | implementation |
