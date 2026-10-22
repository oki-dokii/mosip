# Deployment guide — Inji Interoperability Playground

This document tells a stranger how to start, stop, inspect, and reproduce the playground from a fresh clone. Read the **Evidence limits** section before making any interoperability claims.

---

## Contents

- [Quick start](#quick-start)
- [Prerequisites](#prerequisites)
- [Profiles and services](#profiles-and-services)
- [Environment variables](#environment-variables)
- [Modes](#modes)
- [Startup, shutdown and reset](#startup-shutdown-and-reset)
- [Persistent storage and migrations](#persistent-storage-and-migrations)
- [Troubleshooting](#troubleshooting)
- [CI and automation](#ci-and-automation)
- [Clean-machine verification procedure](#clean-machine-verification-procedure)
- [Evidence limits](#evidence-limits)
- [Not provided](#not-provided)

---

## Quick start

Requires Docker with Compose V2 (see [Prerequisites](#prerequisites)). From a fresh clone, no `.env` file needed:

```bash
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up --build -d --wait
```

Open **http://localhost:5174** in a browser. The app starts in cross-container mock mode. All run data is stored in PostgreSQL inside the Compose network.

Or use the one-command demo script (builds, starts, runs two synthetic SD-JWT cases, prints DEMO PASS):

```bash
pnpm install        # only needed once, for the demo script itself
pnpm demo:docker
```

---

## Prerequisites

| Tool | Minimum version | Tested with | Notes |
|---|---|---|---|
| Docker Engine / Desktop | 24.0+ | Desktop 27.x | Compose V2 must be available (`docker compose version`) |
| Docker Compose plugin | v2.20+ | v2.29+ | Bundled with Docker Desktop; `apt install docker-compose-plugin` on Linux |
| Node.js (non-Docker only) | 20.x LTS | 20.19.1 | Only needed to run `pnpm demo:docker` or `node e2e/smoke.mjs` locally |
| pnpm (non-Docker only) | 11.25.0 | 11.25.0 | `corepack enable && corepack prepare pnpm@11.25.0 --activate` |

Docker must have at least **2 GB of available memory** (4 GB recommended). On Apple Silicon (M-series), builds run under Rosetta2 emulation by default; native arm64 works if the base images have arm64 layers (`node:20.19.1-bookworm-slim` and `postgres:16-alpine` both do).

---

## Profiles and services

| Service | Profile | Build target | Default host port | Health check | Purpose |
|---|---|---|---|---|---|
| `postgres` | `core` | `postgres:16-alpine` (pull) | `127.0.0.1:55433→5432` | `pg_isready` | Durable run, step, exchange store |
| `migrate` | `core` | `migrate` (build) | None | one-shot exit 0 | Runs `prisma migrate deploy` before BFF starts |
| `bff` | `core` | `bff` (build) | `127.0.0.1:4000→4000` | `GET /api/v1/health` HTTP 200 | Run orchestration, drivers, Socket.IO |
| `web` | `core` | `web` (nginx build) | `127.0.0.1:5174→80` | `wget /` | React SPA + nginx reverse proxy to BFF |
| `mock-issuer` | `mocks` | `mock-issuer` (build) | Not published | `GET /.well-known/openid-credential-issuer` | Synthetic OpenID4VCI SD-JWT issuer |
| `mock-verifier` | `mocks` | `mock-verifier` (build) | Not published | TCP connect :4102 | Synthetic OpenID4VP SD-JWT verifier |

All host ports bind to `127.0.0.1` (loopback only). The mock services are on the Compose network only and not accessible from the host.

Override host ports with environment variables before running:

```bash
export PLAYGROUND_POSTGRES_PORT=55433   # default
export PLAYGROUND_WEB_PORT=5174         # default
```

---

## Environment variables

Copy `.env.example` as a reference. Do not commit real values. All defaults are synthetic and safe.

| Variable | Default | Purpose | Secret? |
|---|---|---|---|
| `PLAYGROUND_DRIVER_MODE` | `fixture` | `fixture` \| `collab`. `collab` uses mock or live Inji URLs. | No |
| `DATABASE_URL` | `postgresql://playground:playground@postgres:5432/playground?schema=public` | Prisma connection string (Compose DNS) | No (dev default) |
| `PLAYGROUND_POSTGRES_PORT` | `55433` | Host port for PostgreSQL | No |
| `PLAYGROUND_WEB_PORT` | `5174` | Host port for the web app | No |
| `MOCK_ISSUER_BASE_URL` | *(empty)* | BFF → mock issuer URL (Compose DNS: `http://mock-issuer:4101`) | No |
| `MOCK_VERIFIER_BASE_URL` | *(empty)* | BFF → mock verifier URL (Compose DNS: `http://mock-verifier:4102`) | No |
| `VERIFY_BASE_URL` | `https://injiverify.collab.mosip.net/v1/verify` | BFF → Inji Verify (Collab mode only) | No |
| `OFFICIAL_POSTMAN_ENV_PATH` | *(none)* | Path to Collab Postman env (Collab mode only, kept outside repo) | **Yes** |
| `MOCK_OTP` | *(none)* | Public mock OTP for Collab (Collab mode only) | Treat as secret |
| `GIT_REVISION` | `unknown` | Injected at build time for OCI image labels | No |
| `BUILD_DATE` | `unknown` | Injected at build time for OCI image labels | No |

See `.env.example` for the full list with comments. Never commit real Postman environment files or OTPs.

---

## Modes

| Mode | How to start | Valid claim | Cannot prove |
|---|---|---|---|
| **Fixture** (default) | `docker compose --profile core up` | Playground starts; API, storage and Socket.IO work in synthetic mode | Any interoperability with external services |
| **Mock** (separate services) | `--profile core --profile mocks` + `PLAYGROUND_DRIVER_MODE=collab` + `MOCK_*_BASE_URL` set | Cross-container mock issuer → Reference Wallet → mock verifier SD-JWT journey ran; result stored in PostgreSQL | Inji Certify, Inji Verify, or Inji Web/Wallet interoperability |
| **Collab** (live Inji) | Requires `OFFICIAL_POSTMAN_ENV_PATH` and Collab credentials outside the repo | Specific Inji Certify and Inji Verify versions accepted or rejected a credential | Only the exact Collab endpoint tested; not general Inji interoperability |
| **Assisted Inji wallet** | Needs a logged-in Inji Web test account + real Mimoto/eSignet | A real Inji wallet stored and presented a credential to Inji Verify | A1 gate — not complete; blocked until a persistent test account exists |

---

## Startup, shutdown and reset

### Start all services (core + mocks, mock mode)

```bash
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up --build -d --wait
```

`--wait` blocks until all health checks pass. On a cold build this takes 2–4 minutes.

### Start core only (fixture mode, no mock services)

```bash
docker compose --profile core up --build -d --wait
```

The BFF starts in fixture mode. No Inji Certify or mock services are needed.

### Check status

```bash
docker compose --profile core --profile mocks ps
curl -fsS http://localhost:4000/api/v1/health
# Should include: "storage":"postgres","driverMode":"collab"
```

### Stop (keep data)

```bash
docker compose --profile core --profile mocks down
```

Run data in the PostgreSQL volume is **preserved**.

### Stop and delete all data ⚠️

```bash
docker compose --profile core --profile mocks down -v
```

> **DATA LOSS WARNING**: `-v` removes the `playground-postgres` named volume and **permanently deletes all stored runs, steps, and exchanges**.

---

## Persistent storage and migrations

Run history is stored in a PostgreSQL named volume (`playground-postgres`). The `migrate` one-shot service runs `prisma migrate deploy` before the BFF starts; it is idempotent and safe to re-run.

To inspect the database from the host:

```bash
psql postgresql://playground:playground@127.0.0.1:55433/playground
```

To run migrations manually (outside Compose):

```bash
DATABASE_URL=postgresql://playground:playground@127.0.0.1:55433/playground?schema=public \
  pnpm db:deploy
```

---

## Troubleshooting

### Port already in use

If `55433` or `5174` are in use:

```bash
export PLAYGROUND_POSTGRES_PORT=55434
export PLAYGROUND_WEB_PORT=5175
docker compose --profile core --profile mocks up --build -d --wait
```

If local PostgreSQL is on port 5432, it does not conflict with Compose (which uses 55433 by default).

### Service never becomes healthy

Read the service logs:

```bash
docker compose logs bff --tail=50
docker compose logs migrate --tail=50
docker compose logs postgres --tail=30
```

Common causes:
- **BFF unhealthy**: Migration failed; check `migrate` logs first.
- **migrate fails**: PostgreSQL not ready yet; increase `HEALTH_TIMEOUT_MS` or wait and retry.
- **web unhealthy**: BFF not healthy; fix BFF first.

### Migration failures

If `migrate` exits non-zero:
1. Check `docker compose logs migrate` for the Prisma error.
2. Ensure `postgres` is healthy: `docker compose ps postgres`.
3. If the schema is corrupt, run `docker compose --profile core down -v` to reset.

### Docker memory limits

On Docker Desktop (macOS/Windows), ensure at least 2 GB RAM is allocated (Settings → Resources). The build stage is memory-intensive.

### Apple Silicon / ARM notes

`node:20.19.1-bookworm-slim`, `postgres:16-alpine`, and `nginx:1.27.5-alpine` all publish `linux/arm64` layers. Builds run natively on M-series without Rosetta. If you see `exec format error`, run:

```bash
docker buildx build --platform linux/arm64 ...
```

---

## CI and automation

### Workflows

| Workflow file | Trigger | Jobs | Purpose |
|---|---|---|---|
| `.github/workflows/ci.yml` | push to `main`/`person4/**`, PRs, `workflow_dispatch` | `verify`, `compose-smoke` | Release gate: typecheck, test, build, audit:secrets, Compose smoke |
| `.github/workflows/nightly.yml` | daily `0 2 * * *`, `workflow_dispatch` | `nightly-mock-smoke` | Regression: same Compose mock smoke on main daily |

### Job details

**`verify`** (ci.yml):
- Actions pinned to SHA. Node 20. pnpm 11.25.0.
- Runs `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit:secrets`.

**`compose-smoke`** (ci.yml, depends on `verify`):
- Builds the Docker stack from scratch with `--build --wait`.
- Runs `node e2e/smoke.mjs` which asserts health, runs two SD-JWT cases, checks redaction.
- Always collects and (on failure) uploads container logs as a GitHub Actions artifact.
- Always runs `docker compose ... down -v` to clean up.

**`nightly-mock-smoke`** (nightly.yml):
- Same Compose smoke on a daily schedule. Mock/fixture evidence only; not a Collab run.

### Run locally

```bash
# Equivalent to the verify job:
corepack enable && corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build && pnpm audit:secrets

# Equivalent to the compose-smoke job:
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up --build -d --wait
node e2e/smoke.mjs
docker compose --profile core --profile mocks down -v
```

### Download failure logs

On a failed `compose-smoke` run, go to the GitHub Actions run page → Artifacts → `compose-logs-<run_number>`. The archive contains up to 200 lines of `docker compose logs` output for all services.

---

## Clean-machine verification procedure

A reviewer on a **different machine** should follow these exact steps. This placeholder is marked **independent verification: open** until a second person completes and records it.

```bash
# 1. Clone the branch under test
git clone --branch person4/packaging-ci https://github.com/oki-dokii/mosip.git playground-verify
cd playground-verify

# 2. Confirm no .env, node_modules, or Postman files are present
ls -la .env* 2>/dev/null || echo "no .env files — correct"
ls node_modules 2>/dev/null || echo "no node_modules — correct"

# 3. Start the full stack from scratch
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up --build -d --wait

# 4. Check health
docker compose --profile core --profile mocks ps
curl -fsS http://localhost:4000/api/v1/health

# 5. Run the smoke test
node e2e/smoke.mjs

# 6. Clean up
docker compose --profile core --profile mocks down -v
```

Checklist to record:

| Item | Result |
|---|---|
| Date | |
| OS and version | |
| Docker version (`docker version`) | |
| Compose version (`docker compose version`) | |
| Clone succeeded with no extra files | |
| `docker compose up --build --wait` completed | |
| All services healthy (`ps`) | |
| `curl /api/v1/health` returns `storage:postgres` | |
| `node e2e/smoke.mjs` exits 0 with "All N assertions passed" | |
| `docker compose down -v` completed | |
| Independent verification status | **OPEN** |

---

## Evidence limits

> This section is mandatory. Do not remove or soften it.

The Compose stack and smoke test exercise **mock and fixture paths only**:

- The mock issuer is a synthetic OpenID4VCI server with an in-memory key. It does not represent Inji Certify.
- The mock verifier is a synthetic OpenID4VP server. It does not represent Inji Verify.
- The Reference Wallet is the playground's own automated wallet client. It is not Inji Web or Inji Wallet mobile.
- No local Inji Certify, Mimoto, Inji Web, eSignet, or Inji Verify instance is started.
- The CI nightly run is a mock-mode regression check, not a live Collab run.
- `DEMO PASS` or a passing smoke test **does not prove Inji interoperability**.

Real-wallet gates:
- **A1 (Inji Web)**: Requires a dedicated persistent Inji Web test account with login, storage, and Verify presentation. Owned by Person 2. Status: blocked (no test account available).
- **A2 (Inji mobile wallet)**: Requires a pinned Inji mobile wallet build tested against Certify and Verify. Owned by Person 3.

---

## Not provided

- **Local Inji stack profile**: A `docker compose` profile for Certify + Verify (and eventually Mimoto + Inji Web) is the next integration milestone. It requires: pinned official Inji image tags/digests, OIDC client keystore, eSignet/Mimoto configuration, and network/DNS setup matching the upstream bundled Compose example. These prerequisites are not yet confirmed; do not add placeholder images.
- **Collab nightly runs**: Require the public test environment credentials and are kept outside this repository.
- **Production hardening**: TLS termination, authentication, rate limiting, and secrets management are not part of this deployment.
- **Authentication**: The BFF API has no authentication. Do not expose this stack on a public interface with test credentials.
