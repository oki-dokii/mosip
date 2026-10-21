# flow.md

How code travels between files and functions: **entry points, order of execution, and who calls whom.**

> **Status: SPIKES, M1 WALKING SKELETON, AND RUN PERSISTENCE IMPLEMENTED; LIVE APPLICATION IN PROGRESS.** The current web/BFF flow uses sanitized fixture-backed exchanges. It selects PostgreSQL when `DATABASE_URL` is configured and otherwise uses an in-memory repository. Live drivers, Tap, replay, and reporting remain planned.

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

| Entry | File | What starts it | Status |
|---|---|---|---|
| BFF process | `apps/bff/src/server.ts` | `pnpm --filter @playground/bff dev` or `node dist/server.js` | 🟩 |
| Web app | `apps/web/src/main.tsx` | `pnpm --filter @playground/web dev` / built static files | 🟩 |
| Mock issuer | `apps/mock-issuer/src/server.ts` | Compose profile `mocks` | 🟦 |
| Mock verifier | `apps/mock-verifier/src/server.ts` | Compose profile `mocks` | 🟦 |
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

### 3.2 BFF side: implemented walking-skeleton order 🟩

```
app.ts → POST /api/v1/runs
  ⇒ packages/shared → runConfigSchema.safeParse(body)
  ⇒ store.ts → repository.create(run plus createSteps(runId))
  ⇒ return 202 { runId }
  ⇒ orchestrator.ts → runDemo(runId, io)
       ⇒ mark run running; emit run:created
       ⇒ for each fixture-backed step:
            INIT → ISSUE_OFFER → ISSUE_TOKEN → ISSUE_CREDENTIAL → STORE
            → PRESENT_REQUEST → PRESENT_SUBMIT → PRESENT_RESULT → REPORT
            ⇒ emit step:started
            ⇒ create sanitized exchange where the step has a protocol boundary
            ⇒ repository.addExchange(); emit exchange:recorded
            ⇒ repository.updateStep(succeeded); emit step:finished
       ⇒ repository.updateRun(passed, actualOutcome valid); emit run:finished
```

`GET /api/v1/runs/:id`, `/steps`, and `/exchanges` read through the same repository. PostgreSQL records survive BFF restarts; memory records intentionally do not. Real drivers, presentation polling, negative outcomes, and durable reports remain planned.

### 3.3 Where exchange data is recorded

The walking skeleton constructs protocol-shaped exchanges in `orchestrator.ts`, passes request and response objects through `redaction.ts → redact()`, and only then writes them to `store.ts`. This proves the UI and safe-storage boundary. Live adapters will record their real request/response boundaries through the same redaction contract, following D-017.

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

### 4.1 Certify issuer (`drivers/issuer/certify.ts`) 🟦 (⚠ depends on P-001)
`createOffer(ctx)` ⇒ `GET {tap}/certify/.well-known/openid-credential-issuer` ⇒ builds the credential offer for the chosen format ⇒ returns `Offer`.

### 4.2 Reference Wallet (`drivers/wallet/referenceWallet.ts`) 🟦
`acceptOffer(ctx, offer)`
⇒ `wallet/oid4vciClient.ts → fetchMetadata()`
⇒ `wallet/oid4vciClient.ts → requestToken(offer)` (grant per P-001)
⇒ `wallet/keys.ts → buildProofJwt(ctx.keys.holder, nonce, audience)`
⇒ `wallet/oid4vciClient.ts → requestCredential(token, proof)`
⇒ `wallet/formats/{ldp|sdjwt}.ts → parseCredential(raw)`
⇒ returns `IssuedCredential`.

`present(ctx, request, cred)`
⇒ `wallet/oid4vpClient.ts → parseRequest(request)`
⇒ `wallet/oid4vpClient.ts → selectCredential(presentationDefinition, cred)`
⇒ `wallet/oid4vpClient.ts → buildVpToken(cred, ctx.keys.holder, nonce, audience)` (shape per P-003)
⇒ `wallet/oid4vpClient.ts → directPost(responseUri, vpToken, state)` (through the Tap)

### 4.3 Inji Web assisted (`drivers/wallet/injiWebAssisted.ts`) 🟦
`acceptOffer(ctx, offer)` ⇒ emit `action:required (open_inji_web)` ⇒ wait on `tap/recorder.ts → waitForExchange(runId, matcher)` until issuance calls are seen ⇒ read the credential from the recorded response.

### 4.4 Inji Verify (`drivers/verifier/injiVerify.ts`) 🟦
- `createRequest` ⇒ `POST {tap}/verify/vp-request`
- `pollStatus` ⇒ repeated `GET {tap}/verify/vp-request/{requestId}/status` until `VP_SUBMITTED` or `EXPIRED`
- `getResult` ⇒ `GET {tap}/verify/vp-result/{transactionId}`

### 4.5 Mocks (`drivers/issuer/mockIssuer.ts`, `drivers/verifier/mockVerifier.ts`) 🟦
Same interfaces, calling `apps/mock-issuer` and `apps/mock-verifier` through the Tap.

---

## 5. Secondary flows

### 5.1 Replay with tamper
`POST /runs/:id/replay` ⇒ `runService.replay(parentId, tamper)` ⇒ new `runs` row with `parent_run_id` ⇒ `runOrchestrator.start()` with steps 1–5 skipped (credential loaded from `credentials`) ⇒ step 7 applies `tamper/index.ts → applyTamper()` ⇒ `outcome.evaluate(expectedFromTamper, actual)`.

### 5.2 Report download
`GET /runs/:id/report?format=md` ⇒ `reportService.build(runId)` ⇒ `report/markdown.ts → render(model)` (or `report/json.ts`).

### 5.3 Sequence view
`GET /runs/:id/sequence` ⇒ `sequence/mermaid.ts → fromExchanges(exchanges)` ⇒ returns text plus step markers ⇒ `components/SequenceDiagram.tsx` renders with mermaid.js and drives playback.

### 5.4 History and matrix
`GET /runs?filters` ⇒ `runService.list(filters)` ⇒ Prisma query joined with `service_versions`.
`GET /matrix` ⇒ `matrixService.latest()` ⇒ `SELECT * FROM matrix_latest`. `GET /matrix/export` ⇒ `matrixService.export(format)`.

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
| `apps/bff/src/orchestrator.ts` | Fixture-backed nine-step run and events |
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
