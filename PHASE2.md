# Phase 2: application walking skeleton

Status: **Complete for the Reference Wallet track (2026-10-21).**

Phase 2 turns the verified protocol work from Phase 1 into a usable application. The deterministic fixture path proves the browser-to-BFF contract, run lifecycle, real-time updates, exchange inspection, and write-time redaction. The same orchestrator can now select the live MOSIP Collab adapter.

## What works now

- Pick an issuer, wallet, verifier, and either SD-JWT VC or W3C VC JSON-LD.
- Start a run through `POST /api/v1/runs`.
- Watch the ten issue → hold → present → verify steps update through Socket.IO, with browser polling as a recovery path.
- Inspect sanitized request and response payloads for each protocol boundary.
- See the selected proof type and algorithm alongside the final expected-versus-actual result.
- Validate run configuration at runtime from the same Zod schema used by the web app and BFF.
- Persist runs, step transitions, and redacted exchanges in PostgreSQL when `DATABASE_URL` is set.
- Select role-specific issuer, wallet, and verifier drivers per run.
- Run the Phase 1 authorization-code + PKCE Reference Wallet path against Collab for JSON-LD or SD-JWT.
- Poll Inji Verify until the presentation reaches `VP_SUBMITTED`, recording each attempt with a bounded timeout.
- Run five negative paths—expired, bad signature, wrong type, missing disclosure, and replayed nonce—and compare the verifier outcome with the expected invalid result.
- Replay any passed or mismatched run as a new linked run, optionally changing the selected fault.
- Download a sanitized run report as JSON or Markdown and derive a Mermaid sequence with exchange-to-step markers.
- Browse run history, open an earlier run, and inspect the latest result for every complete issuer × wallet × verifier × format × flow × fault combination.
- Export the latest interoperability matrix as JSON, CSV, or Markdown.
- Follow a clickable protocol sequence that stays synchronized with the step timeline and inspector; copy the generated Mermaid source when needed.
- Mark the active step failed and the run errored when an adapter or upstream service fails.

Fixture mode stores synthetic exchanges using `.example` hosts. Collab mode calls the live services and records redacted protocol metadata while keeping credentials, holder keys, cookies, proofs, and bearer tokens in the run's in-memory context. Without `DATABASE_URL`, the BFF intentionally uses in-memory storage for a zero-setup development loop.

## Run it

Requires Node.js 20+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The BFF listens on `http://localhost:4000`.

For durable runs, start PostgreSQL and deploy the migration first:

```bash
docker compose up -d postgres
export DATABASE_URL=postgresql://playground:playground@127.0.0.1:5432/playground?schema=public
pnpm db:deploy
pnpm dev
```

`GET /api/v1/health` reports `storage: "postgres"` or `storage: "memory"` so the active mode is explicit.

Fixture mode is the default. To run the live adapter, use the official public test-client environment described in Phase 1:

```bash
export PLAYGROUND_DRIVER_MODE=collab
export OFFICIAL_POSTMAN_ENV_PATH=/absolute/path/to/inji-certify-with-mock-identity.postman_environment.json
export MOCK_OTP=<official-public-mock-otp>
pnpm dev
```

The live adapter currently accepts only `Inji Certify + Reference Wallet + Inji Verify`. JSON-LD selects the Farmer deployment and `FarmerCredential_VCDM2.0`; SD-JWT selects the mock deployment and `MockVerifiableCredential_SD_JWT`. The base URLs and credential configuration remain overridable through `.env.example`.

Verifier polling defaults to a one-second interval and a two-minute deadline. Override these with `VERIFY_POLL_INTERVAL_MS` and `VERIFY_POLL_TIMEOUT_MS`.

Validation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## API implemented in this slice

- `GET /api/v1/health`
- `GET /api/v1/meta/implementations`
- `GET /api/v1/runs`
- `GET /api/v1/matrix`
- `GET /api/v1/matrix/export?format=json|csv|md`
- `POST /api/v1/runs`
- `GET /api/v1/runs/:id`
- `GET /api/v1/runs/:id/steps`
- `GET /api/v1/runs/:id/exchanges`
- `POST /api/v1/runs/:id/replay`
- `GET /api/v1/runs/:id/report?format=json|md`
- `GET /api/v1/runs/:id/sequence`
- Socket.IO namespace `/runs`, room `run:{id}`

## Completion evidence

- Application-level Collab smoke on 2026-10-21: JSON-LD run `5680225a-a374-401b-8b72-5bf4da076ac2` passed all ten steps and Verify returned `valid`.
- Application-level Collab smoke on 2026-10-21: SD-JWT run `25b59c93-8715-4376-9dc3-6ba9ade0b445` passed all ten steps and Verify returned `valid`.
- Matrix smoke returned both latest combinations, CSV export, and 14 sequence markers for the SD-JWT run.
- BFF: 21 tests passed. Shared package: 2 tests passed. Strict TypeScript checks and the production web build passed.

The run IDs above came from memory-mode smoke runs and identify the test evidence in this record; they are not durable public links. The official public Postman environment was read from `/tmp` and was not committed.

## Deferred boundary

Assisted Inji Web automation and a transparent Tap are not part of the completed Reference Wallet track. Phase 1 proved Farmer issuance/download in Inji Web, while presentation requires a persistent logged-in wallet and SD-JWT presentation remains unavailable in the tested Web path. Adapter-level recording remains the safe default because proxy URL rewriting can invalidate signed protocol values (D-017). These items move to Phase 3 if a dedicated test account and a no-rewrite capture design are available.
