# Phase 2: application walking skeleton

Status: **M1 walking skeleton and PostgreSQL persistence complete; live adapters next.**

Phase 2 turns the verified protocol work from Phase 1 into a usable application. The first slice is deliberately fixture-backed: it proves the browser-to-BFF contract, run lifecycle, real-time updates, exchange inspection, and write-time redaction before live service adapters and Postgres add more moving parts.

## What works now

- Pick an issuer, wallet, verifier, and either SD-JWT VC or W3C VC JSON-LD.
- Start a run through `POST /api/v1/runs`.
- Watch the nine issue → hold → present → verify steps update through Socket.IO, with polling as a recovery path.
- Inspect sanitized request and response payloads for each protocol boundary.
- See the selected proof type and algorithm alongside the final expected-versus-actual result.
- Validate run configuration at runtime from the same Zod schema used by the web app and BFF.
- Persist runs, step transitions, and redacted exchanges in PostgreSQL when `DATABASE_URL` is set.

The stored exchanges are synthetic and use `.example` hosts. They model the successful Phase 1 contracts, but they do not make live Collab calls yet. Without `DATABASE_URL`, the BFF intentionally uses in-memory storage for a zero-setup development loop.

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
- `POST /api/v1/runs`
- `GET /api/v1/runs/:id`
- `GET /api/v1/runs/:id/steps`
- `GET /api/v1/runs/:id/exchanges`
- Socket.IO namespace `/runs`, room `run:{id}`

## Next slice

1. Extract issuer, wallet, and verifier driver interfaces.
2. Move the completed Phase 1 Reference Wallet logic behind those drivers.
3. Record sanitized live adapter exchanges into the same inspector model.
4. Keep the fixture-backed runner as the deterministic local development path.
