# Backend Design (Playground BFF)

**Stack:** Node 20 · Express 4 · TypeScript (strict) · Zod · Socket.IO · Prisma/PostgreSQL · pino
**Version:** 0.1 (design phase) · **Date:** 2026-10-17
**Related:** TRD.md (components), DATABASE.md (tables), flow.md (call paths), decisions.md

Base path for REST: `/api/v1`. Content type: JSON. Errors follow RFC 7807 (`application/problem+json`).

---

## 1. Folder structure (`apps/bff`)

```
apps/bff/
  prisma/schema.prisma
  src/
    server.ts                 # entry point: loads config, starts HTTP + Socket.IO
    app.ts                    # builds Express app, middleware, routes
    config/env.ts             # Zod-validated environment
    routes/
      health.routes.ts
      meta.routes.ts
      runs.routes.ts
      matrix.routes.ts
      scenarios.routes.ts
      tools.routes.ts
    controllers/              # thin: parse → call service → respond
    services/
      runService.ts           # create/list/get/cancel/replay runs
      reportService.ts
      matrixService.ts
      healthService.ts
      diffService.ts          # P2
      issueDraftService.ts    # P2
    orchestrator/
      runOrchestrator.ts      # executes the step list for a run
      steps.ts                # step definitions and order
      outcome.ts              # expected vs actual evaluation
    drivers/
      types.ts                # IssuerDriver, WalletDriver, VerifierDriver
      registry.ts             # resolves a driver from a role + implementation
      issuer/certify.ts
      issuer/mockIssuer.ts
      wallet/referenceWallet.ts
      wallet/injiWebAssisted.ts
      verifier/injiVerify.ts
      verifier/mockVerifier.ts
    wallet/                   # Reference Wallet internals
      oid4vciClient.ts
      oid4vpClient.ts
      keys.ts                 # per-run key generation (in memory)
      formats/ldp.ts
      formats/sdjwt.ts
      formats/mdoc.ts         # P2
    tap/
      proxy.ts                # /tap routes and forwarding
      recorder.ts             # writes exchanges
      redaction.ts            # masks secrets
    tamper/
      index.ts                # applyTamper(kind, credential) → {credential, expectedOutcome}
      expired.ts badSignature.ts wrongType.ts missingDisclosure.ts replayNonce.ts
    sequence/mermaid.ts       # exchanges → Mermaid text
    report/markdown.ts json.ts
    ws/gateway.ts             # Socket.IO rooms and event emit helpers
    db/client.ts              # Prisma client
    lib/
      errors.ts logger.ts ssrfGuard.ts runContext.ts
  test/
```

---

## 2. REST API

### 2.1 Health and metadata

| Method & path | Purpose | Response |
|---|---|---|
| `GET /health` | Aggregated status of dependent services | `{ services: [{ name, status: "up"|"down", version?, latencyMs }] }` |
| `GET /meta/implementations` | Role options, formats and valid combinations | `{ issuers[], wallets[], verifiers[], formats[], flows[], combos[] }` |

### 2.2 Runs

| Method & path | Purpose |
|---|---|
| `POST /runs` | Create and start a run. Returns `202 { runId }`. |
| `GET /runs` | List runs. Query: `issuer, wallet, verifier, format, flow, status, outcome, certifyVersion, verifyVersion, from, to, page, pageSize`. |
| `GET /runs/:id` | Run detail: config, status, outcome, timings, versions. |
| `GET /runs/:id/steps` | Ordered steps with summaries. |
| `GET /runs/:id/exchanges` | Ordered exchanges (redacted). Query: `stepId`. |
| `GET /runs/:id/credentials` | Issued and presented credentials with decoded views. |
| `GET /runs/:id/result` | Verification result. |
| `GET /runs/:id/report?format=json|md` | Report download. |
| `GET /runs/:id/sequence` | Mermaid sequence text and per-step markers for animation. |
| `POST /runs/:id/cancel` | Cancel a running run. |
| `POST /runs/:id/replay` | Clone a passed/failed run and execute a fresh full flow. Body: `{ tamper?: kind }`. Returns `202 { runId }` of the linked child run. |
| `POST /runs/:id/issue-draft` | (P2) Build a GitHub issue draft. |
| `GET /runs/diff?a=&b=` | (P2) Compare two runs. |

`POST /runs` body (Zod-validated, shared type):

```json
{
  "issuer": "inji_certify",
  "wallet": "reference_wallet",
  "verifier": "inji_verify",
  "format": "vc_sd_jwt",
  "flow": "cross_device",
  "tamper": null,
  "scenarioId": null
}
```

`tamper` accepts `expired`, `bad_signature`, `wrong_type`, `missing_disclosure`, or `replay_nonce`. A tamper run expects `invalid`; it passes when the verifier rejects the modified presentation as expected.

### 2.3 Matrix and scenarios

`GET /api/v1/runs` accepts optional `issuer`, `wallet`, `verifier`, `format`, `status`, `tamper`, `issuerVersion`, and `verifierVersion` query filters. Each run carries a `serviceVersions` snapshot; remote labels default to `unreported` unless configured. Live run creation returns `422 UNSUPPORTED_COMBINATION` for role/format selections the current adapter cannot execute.

| Method & path | Purpose |
|---|---|
| `GET /api/v1/matrix` | Latest outcome per combination (computed from run history). |
| `GET /matrix/export?format=md|json|csv` | Download the matrix. |
| `GET /scenarios` | Presets and saved scenarios. |
| `POST /scenarios` | Save a scenario. |

### 2.4 Tools (P2)

| Method & path | Purpose |
|---|---|
| `POST /tools/decode` | Decode a pasted JWT, SD-JWT or JSON-LD credential. |
| `POST /tools/qr-probe` | Measure payload size against QR limits. |

### 2.5 Optional Tap routes

The separate test-only mock services run on localhost when selected with `MOCK_ISSUER_BASE_URL` and `MOCK_VERIFIER_BASE_URL`. The mock issuer exposes `GET /.well-known/openid-credential-issuer`, `POST /token`, and `POST /credential`. The mock verifier exposes `POST /vp-request`, `POST /direct-post`, `GET /status/:id`, and `GET /result/:id`. Their bearer tokens, nonces, holder proofs, and presentations remain in process memory; the playground stores sanitized summaries of the HTTP exchanges. Mock-issuer runs need no Certify OAuth environment. The standalone issuer defaults to `did:jwk`; optional `MOCK_ISSUER_SIGNING_KEY_PATH`, `MOCK_ISSUER_CERT_CHAIN_PATH`, and matching HTTPS `MOCK_ISSUER_ISSUER_ID` select X.509 signing. `pnpm dev:x509-mock` supplies an ephemeral test certificate and `MOCK_ISSUER_VERSION_LABEL=mock-x509-1`.

| Route | Meaning |
|---|---|
| `ANY /tap/:runId/:service/*` | Optional forwarding for a client/flow whose signed values remain unchanged; record the exchange against `runId`. |

`:service ∈ certify | mimoto | verify | esignet | mockIssuer | mockVerifier`. Clients that can send headers may use `/tap/:service/*` with `X-Playground-Run-Id`.

### 2.6 Errors
```json
{ "type": "https://playground/errors/verify-request-failed",
  "title": "Verifier request failed",
  "status": 502,
  "detail": "POST /vp-request returned 500",
  "code": "VERIFY_REQUEST_FAILED",
  "runId": "…" }
```

Stable error codes (extend as needed): `VALIDATION_FAILED`, `COMBINATION_UNSUPPORTED`, `SERVICE_UNREACHABLE`, `ISSUER_OFFER_FAILED`, `TOKEN_EXCHANGE_FAILED`, `CREDENTIAL_REQUEST_FAILED`, `VERIFY_REQUEST_FAILED`, `PRESENTATION_REJECTED`, `RESULT_TIMEOUT`, `SSRF_BLOCKED`, `RUN_CANCELLED`.

---

## 3. WebSocket events (Socket.IO)

Namespace `/runs`. The client joins room `run:{runId}` with `join` and receives:

| Event | Payload |
|---|---|
| `run:created` | `{ runId, config }` |
| `step:started` | `{ runId, stepId, seq, stepKey, title }` |
| `step:finished` | `{ runId, stepId, status, summary }` |
| `exchange:recorded` | `{ runId, exchangeId, seq, actorFrom, actorTo, method, url, status, durationMs }` (bodies fetched on demand) |
| `action:required` | `{ runId, kind: "scan_qr" | "open_inji_web", payload }` (user action needed) |
| `run:finished` | `{ runId, status, expected, actual }` |
| `run:error` | `{ runId, code, detail }` |

Bodies are not pushed over the socket; the UI fetches `GET /runs/:id/exchanges` when a row is opened, which keeps events small.

---

## 4. Orchestrator behaviour

1. `runService.create` validates the body, checks the combination is supported, inserts `runs` (status `pending`) and snapshots `service_versions`.
2. `runOrchestrator.start(runId)` resolves three version-aware drivers via `drivers/registry.ts` and builds a `RunContext` (ids, discovered capabilities, original service URLs, per-run keys, recorder and emitters).
3. Steps run in order (`steps.ts`). Each step: insert/update `run_steps`, emit `step:started`, call the driver, store results, emit `step:finished`.
4. After `PRESENT_RESULT`, `outcome.ts` compares `expected_outcome` with the verifier's outcome and sets `actual_outcome`, `status` (`passed` / `failed`).
5. `reportService` builds the report; `run:finished` is emitted.
6. Any uncaught error sets `status = errored` with a stable error code.

State machine for a run: `pending → running → passed | failed | errored | cancelled`.

Concurrency: runs are independent; each has its own `RunContext`. A global limit (default 3 concurrent runs) protects the Inji stack.

Timeouts: per step default 30 s, request polling up to 120 s (configurable). Polling interval 1–2 s.

---

## 5. Driver contracts

```ts
interface RunContext {
  config: RunConfig;
  state: Map<string, unknown>; // per-run protocol state; never persisted
}

interface DriverResult { exchanges?: DriverExchange[]; summary?: Record<string, unknown>; }
interface IssuerDriver   { createOffer(ctx): Promise<DriverResult>; }
interface WalletDriver   { authorize(ctx): Promise<DriverResult>;
                           requestCredential(ctx): Promise<DriverResult>;
                           store(ctx): Promise<DriverResult>;
                           present(ctx): Promise<DriverResult>; }
interface VerifierDriver { createRequest(ctx): Promise<DriverResult>;
                           pollStatus(ctx): Promise<DriverResult>;
                           getResult(ctx): Promise<DriverResult>; }
```

Mapping to the current Inji Verify Collab contract discovered on 2026-10-20:

| Driver call | Inji Verify endpoint |
|---|---|
| `createRequest` | `POST {verify}/v2/vp-request` (client id and DCQL query) |
| `present` (by wallet) | `POST {verify}/v2/vp-submission/direct-post` |
| `pollStatus` | `GET {verify}/vp-request/{requestId}/status` (ACTIVE, VP_SUBMITTED, EXPIRED) |
| `getResult` | `POST {verify}/v2/vp-results/{transactionId}` |

The implemented Collab application path uses eSignet authorization code with PKCE, `POST /v1/certify/nonce`, and `POST /v1/certify/issuance/credential`. The separately tested pre-authorized paths are `POST /v1/certify/pre-authorized-data`, `GET /v1/certify/credential-offer-data/{id}`, and `POST /v1/certify/oauth/token`. Current Mimoto discovery uses `/v1/mimoto/issuers` and `/v1/mimoto/issuers/{issuer-id}/configuration`; the older `/credentialTypes` route is absent. Version-specific adapters must use discovered contracts rather than assuming these paths for every deployment.

---

## 6. Tap and redaction details

- `proxy.ts` forwards using `http-proxy-middleware`, buffers request and response bodies up to `TAP_BODY_LIMIT_BYTES`, and passes them to `recorder.record(...)`.
- `redaction.ts` applies, in order: header rules (`authorization`, `cookie`, `set-cookie`, `dpop`), JSON path rules (`access_token`, `refresh_token`, `pre-authorized_code`, `c_nonce` optional, `d` in JWKs), form-field rules, and a JWT rule that keeps header and payload visible but replaces the signature segment for access tokens only. Credentials the playground itself issues keep their signature so they can be verified and tampered with.
- Each masked item is listed in `exchanges.redactions`.
- The proxy never follows redirects for the browser; it returns them so Inji Web flows keep working with rewritten `Location` headers pointing back at the Tap.

---

## 7. Reference Wallet flow (summary)

Issuance (OpenID4VCI draft 13):
1. Read credential offer; fetch issuer metadata.
2. Obtain access token (grant depends on P-001).
3. Build proof JWT signed with the per-run holder key.
4. Request the credential; decode and store it.

Presentation (OpenID4VP draft 21):
1. Receive the authorization request (from `vp-request` response).
2. Select credential matching `presentation_definition`.
3. Build `vp_token` (shape per P-003), optionally apply a tamper.
4. `POST` to the verifier's `direct_post` endpoint (response mode `direct_post`).

---

## 8. Validation, security and operations
- All request bodies, query strings and env vars are validated with Zod; schemas live in `packages/shared`.
- SSRF guard (`lib/ssrfGuard.ts`) wraps any outbound URL that came from user input.
- CORS limited to the web origin.
- Rate limiting on `POST /runs` and `/tools/*`.
- Logging with pino: every line carries `runId` when available; request ids on all HTTP logs.
- Graceful shutdown: stop accepting runs, let running runs finish up to a timeout, close DB and sockets.
- Health endpoint also checks the database.

---

## 9. Testing focus
- `redaction.ts`: table-driven tests for every rule.
- `tamper/*`: each function returns a changed artifact and the expected outcome.
- `report/*` and `sequence/mermaid.ts`: snapshot tests from fixture exchanges.
- `drivers/*`: contract tests against fixtures captured from real Inji during Spike M0.
- `outcome.ts`: expected vs actual matrix, including tamper cases.
