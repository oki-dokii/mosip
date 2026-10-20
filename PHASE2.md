# Phase 2: application walking skeleton

Status: **M1 walking skeleton complete; live adapters and persistence next.**

Phase 2 turns the verified protocol work from Phase 1 into a usable application. The first slice is deliberately fixture-backed: it proves the browser-to-BFF contract, run lifecycle, real-time updates, exchange inspection, and write-time redaction before live service adapters and Postgres add more moving parts.

## What works now

- Pick an issuer, wallet, verifier, and either SD-JWT VC or W3C VC JSON-LD.
- Start a run through `POST /api/v1/runs`.
- Watch the nine issue → hold → present → verify steps update through Socket.IO, with polling as a recovery path.
- Inspect sanitized request and response payloads for each protocol boundary.
- See the selected proof type and algorithm alongside the final expected-versus-actual result.
- Validate run configuration at runtime from the same Zod schema used by the web app and BFF.

The stored exchanges are synthetic and use `.example` hosts. They model the successful Phase 1 contracts, but they do not make live Collab calls yet. Runs are kept in memory and disappear when the BFF restarts.

## Run it

Requires Node.js 20+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The BFF listens on `http://localhost:4000`.

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

1. Add Postgres and migrations so runs survive restarts.
2. Extract issuer, wallet, and verifier driver interfaces.
3. Move the completed Phase 1 Reference Wallet logic behind those drivers.
4. Record sanitized live adapter exchanges into the same inspector model.
5. Keep the fixture-backed runner as the deterministic local development path.
