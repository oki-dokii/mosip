# flow.md

How code travels between files and functions: **entry points, order of execution, and who calls whom.**

> **Status: PLANNED.** No code exists yet. Every name below is the intended design from `BACKEND.md` and `TRD.md`. When code is written or changed, update the matching section **in the same change** and flip its status (`planned` → `implemented`) or correct the name. A name here that does not exist in the code is a bug in this document.

Legend: `file → function()` means "this function in that file". `A ⇒ B` means A calls B. Status: 🟦 planned · 🟩 implemented · 🟥 changed from plan (explain in decisions.md).

---

## 1. Entry points

### Contract spike 🟩

`node spikes/collab-contract-spike.mjs`
⇒ discover live Certify metadata and Verify OpenAPI
⇒ execute a synthetic Certify pre-authorized issuance
⇒ create and retrieve a synthetic Verify v2/DCQL request
⇒ submit a synthetic wallet cancellation and read status/result error
⇒ print a sanitized capability summary

`node --test spikes/collab-contracts.test.mjs`
⇒ load `spikes/fixtures/collab-contracts-2026-10-20.json`
⇒ assert the pinned adapter contract and reject secret-bearing fields/JWT values

| Entry | File | What starts it | Status |
|---|---|---|---|
| BFF process | `apps/bff/src/server.ts` | `node dist/server.js` (Docker `CMD`) | 🟦 |
| Web app | `apps/web/src/main.tsx` | Vite dev server / built static files | 🟦 |
| Mock issuer | `apps/mock-issuer/src/server.ts` | Compose profile `mocks` | 🟦 |
| Mock verifier | `apps/mock-verifier/src/server.ts` | Compose profile `mocks` | 🟦 |
| DB migrations and seeds | `apps/bff/prisma/migrations`, `apps/bff/prisma/seed.ts` | `prisma migrate deploy` on container start | 🟦 |
| Nightly matrix runner (bonus) | `apps/bff/src/cli/nightly.ts` | GitHub Actions schedule | 🟦 |

---

## 2. Startup order (BFF)

1. `server.ts → main()`
2. ⇒ `config/env.ts → loadEnv()` (Zod validation; process exits on bad config)
3. ⇒ `db/client.ts → connect()`
4. ⇒ `app.ts → buildApp()`
   - registers middleware: request id, pino logger, CORS, JSON body parser, rate limiter
   - mounts routes: `health`, `meta`, `runs`, `matrix`, `scenarios`, `tools`
   - mounts Tap: `tap/proxy.ts → mountTap(app)`
   - adds the error handler (`lib/errors.ts → problemJson()`)
5. ⇒ `ws/gateway.ts → attachGateway(httpServer)` (Socket.IO, namespace `/runs`)
6. ⇒ `httpServer.listen(PORT)`

Shutdown: SIGTERM ⇒ stop accepting runs ⇒ wait for running runs (timeout) ⇒ close sockets ⇒ close DB.

---

## 3. Main flow: "Run flow" button to final report

### 3.1 Frontend side
1. `pages/Playground.tsx → onRunClick()`
2. ⇒ `lib/api.ts → createRun(config)` → `POST /api/v1/runs`
3. ⇒ `lib/socket.ts → joinRun(runId)` (room `run:{runId}`)
4. `hooks/useRunStream.ts` receives `step:started`, `step:finished`, `exchange:recorded`, `action:required`, `run:finished` and updates `RunTimeline`, `ActionPanel`, `Inspector`, `ResultCard`.
5. Opening an inspector row ⇒ `lib/api.ts → getExchanges(runId, stepId)` → `GET /runs/:id/exchanges`.

### 3.2 BFF side: order of execution

```
routes/runs.routes.ts → POST /runs
  ⇒ controllers/runs.controller.ts → createRun()
     ⇒ shared schema.parse(body)                       (packages/shared)
     ⇒ services/runService.ts → create(config)
          ⇒ checks combination (drivers/registry.ts → isSupported())
          ⇒ db: INSERT runs (status = pending)
          ⇒ services/versionService.ts → snapshotVersions(runId)   (service_versions)
          ⇒ orchestrator/runOrchestrator.ts → start(runId)         (not awaited; returns 202)

orchestrator/runOrchestrator.ts → start(runId)
  ⇒ lib/runContext.ts → buildContext(run)       (urls via Tap, per-run keys, emitters)
  ⇒ drivers/registry.ts → resolve(ctx)          (issuer, wallet, verifier drivers)
  ⇒ for each step in orchestrator/steps.ts → STEPS:
       1 INIT              ⇒ ws emit run:created; set status = running
       2 ISSUE_OFFER       ⇒ issuerDriver.createOffer(ctx)
       3 ISSUE_TOKEN       ⇒ walletDriver.acceptOffer(ctx, offer)       (token part)
       4 ISSUE_CREDENTIAL  ⇒ walletDriver.acceptOffer(ctx, offer)       (credential part)
       5 STORE             ⇒ db: INSERT credentials (role = issued)
       6 PRESENT_REQUEST   ⇒ verifierDriver.createRequest(ctx)
                             ⇒ ws emit action:required (scan_qr) when user action is needed
       7 PRESENT_SUBMIT    ⇒ tamper/index.ts → applyTamper(kind, cred)  (only if tamper set)
                             ⇒ walletDriver.present(ctx, request, cred)
       8 PRESENT_STATUS    ⇒ verifierDriver.pollStatus(ctx, requestId)  (loop until submitted/expired)
       9 PRESENT_RESULT    ⇒ verifierDriver.getResult(ctx, txnId)
                             ⇒ db: INSERT verification_results
      10 EVALUATE          ⇒ orchestrator/outcome.ts → evaluate(expected, actual)
      11 REPORT            ⇒ services/reportService.ts → build(runId)
  ⇒ db: UPDATE runs (status, actual_outcome, finished_at)
  ⇒ ws emit run:finished
```

Every step wrapper (`orchestrator/steps.ts → runStep()`) does the same four things: write `run_steps` row ⇒ emit `step:started` ⇒ call the driver ⇒ write result ⇒ emit `step:finished`. On exception it records an error code and the orchestrator marks the run `errored`.

### 3.3 Where HTTP traffic is recorded

Any driver or browser call to a service goes through the Tap:

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
