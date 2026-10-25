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
The one-command demo finds a working Docker context, builds the services, and runs six synthetic **mock issuer → Reference Wallet → mock verifier** SD-JWT presets. It checks a valid control and exact-reason rejections for corrupted signature, signed expiry/type, missing disclosure, and nonce mismatch. It prints `DEMO PASS` only after saving ten-step runs with exchanges and `mock_interop` provenance. The script enables test cases for the mock issuer and BFF; ordinary Compose defaults to false. `MATRIX_ARTIFACT_PATH` writes a sanitized report to a new owner-only file.

For the independent mock services, set the BFF driver and local service URLs:

```bash
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up --build -d --wait
```

Open **http://localhost:5174** in a browser. The app starts in cross-container mock mode. All run data is stored in PostgreSQL inside the Compose network.

Run history also contains a read-only, committed **25 October managed Inji Web A1** export. Open run `3dc6895d` to inspect its sanitized timeline, sequence and report. Its original ID and timestamps remain intact; this is historical evidence, not a fresh wallet run. The API projection corrects the archived export's erroneous Reference Wallet version label to `unreported`. Set `PLAYGROUND_ARCHIVED_A1=false` to disable the overlay. Normal newly executed runs continue to use PostgreSQL.

Or use the one-command demo script (builds, starts, runs six synthetic SD-JWT cases, prints DEMO PASS):

```bash
pnpm install        # only needed once, for the demo script itself
pnpm demo:docker
```

### Connected local Inji profile

```bash
pnpm start:local-full  # stages the connected JSON-LD services
pnpm smoke:local-full  # readiness only; failures return nonzero
pnpm demo:web-jsonld  # stages and tests actual wallet issuance/presentation
pnpm stop:local-full  # preserves volumes and generated keys
```

The entry point reuses `mosip-mobile-a2`, `mosip-local-inji`, and `mosip-web-local`.
It avoids creating duplicate services on occupied ports. Certify is switched to
0.14.0 for JSON-LD; do not run the alpha SD-JWT profile concurrently.
See [the exact adapters and evidence boundaries](../deploy/INJI_WEB_LOCAL.md).
The alternative `docker-compose.local-full.yml` is a legacy infrastructure shell,
not the connected demo or a CI-proven independent deployment.

---

## Prerequisites

| Tool | Minimum version | Tested with | Notes |
|---|---|---|---|
| Docker Engine / Desktop | 24.0+ | Desktop 27.x | Compose V2 must be available (`docker compose version`) |
| Docker Compose plugin | v2.20+ | v2.29+ | Bundled with Docker Desktop; `apt install docker-compose-plugin` on Linux |
| Node.js (non-Docker only) | 22+ LTS (22.13 min) | 24.12.0 | Required by pnpm 11.25.0 (uses `node:sqlite` introduced in Node 22.13). Use nvm or fnm to install. |
| pnpm (non-Docker only) | 11.25.0 | 11.25.0 | `npm install -g pnpm@11.25.0` (or `corepack enable && corepack prepare pnpm@11.25.0 --activate` on Node 22+) |

Docker must have at least **2 GB of available memory** (4 GB recommended). On Apple Silicon (M-series), `node:22.14.0-bookworm-slim` and `postgres:16-alpine` both publish `linux/arm64` layers, so builds run natively without Rosetta.

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
| `inji-certify` | `inji` (opt-in) | `mosipid/inji-certify:v0.14.0` | `127.0.0.1:8080→8080` | `GET /actuator/health` | Official Inji Certify (requires MOSIP Keymanager/eSignet) |
| `inji-verify` | `inji` (opt-in) | `mosipid/inji-verify:v0.18.2` | `127.0.0.1:8081→8081` | `GET /actuator/health` | Official Inji Verify (requires registered verifier config) |
| `mimoto` | `inji` (opt-in) | `mosipid/mimoto:v0.22.0` | `127.0.0.1:9090→9090` | `GET /actuator/health` | Official Mimoto wallet BFF (requires OIDC client keystore) |
| `inji-web` | `inji` (opt-in) | `mosipid/inji-web:v0.17.0` | `127.0.0.1:3000→80` | `wget /` | Official Inji Web frontend (requires Mimoto reachability) |

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
| `PLAYGROUND_ARCHIVED_A1` | `true` in Compose; unset for host-run BFF | Show the committed managed A1 export read-only in history and reports. | No |
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

## Modes and Evidence Tiers

The following are deployment categories; API evidence labels remain governed by the shared schemas.

| Evidence Tier | How to start | Valid claim | Cannot prove |
|---|---|---|---|
| **`mock`** | `docker compose --profile core --profile mocks up` (or `pnpm demo:docker`) | Synthetic OpenID4VCI/VP SD-JWT runs with mock issuer and verifier; tests BFF orchestration, storage, redaction and timeline | Official Inji Certify, Verify, or Inji Web/mobile wallet interoperability |
| **`reference_wallet`** | `pnpm demo:inji` (or `scripts/local-inji-smoke.mjs`) | Official Inji Certify and Inji Verify containers run on loopback; automated Reference Wallet completes SD-JWT journey | Inji Web browser wallet, mobile wallet UI/storage, or end-user consent |
| **`inji_web`** | `pnpm demo:web-jsonld` | Official local Web JSON-LD issuance, exact-card reload and presentation return Verify Valid with both proofs true | Production authentication, stock DID interoperability, BFF-managed local run or offline operation |
| **`inji_mobile`** | `pnpm mobile:inji` | Pinned official Certify issuance observed on physical Android device (A2 mobile route) | All-local execution without physical phone, or untested phone models |
| **`not_tested`** | N/A (unexercised paths) | Explicitly marks untracked or blocked components (e.g. unconfigured issuer catalog) | Any runtime guarantee whatsoever |

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

## Persistent storage and database isolation

Each component running a database maintains strict isolation with its own dedicated database name, user, volume, and host port binding (loopback `127.0.0.1` only). Volumes and database instances are separate. Official service profiles use the PostgreSQL `postgres` superuser within their isolated synthetic instances.

| Component / Service | Database Name | Database User | Volume Name | Port (Host / Container) | Isolation Notes |
|---|---|---|---|---|---|
| **Playground Core** (`postgres`) | `playground` | `playground` | `playground-postgres` | `127.0.0.1:55433` → `5432` | Stores playground runs, steps, and sanitized exchanges |
| **Inji Verify DB** (`verify-db`) | `inji_verify` | `postgres` | `verify-db-data` | Internal only (`5432`) | Isolated from playground and Mimoto databases |
| **Mimoto DB** (`mimoto-db`) | `inji_mimoto` | `postgres` | `mimoto-db-data` | Internal only (`5432`) | Stores local wallet profiles and card references |
| **Inji Certify DB** (`certify-db`) | `inji_certify` | `postgres` | `mobile-postgres` | Internal only (`5432`) | Used exclusively in mobile/demo Inji profile |

Run history is stored in the PostgreSQL named volume (`playground-postgres`). The `migrate` one-shot service runs `prisma migrate deploy` before the BFF starts; it is idempotent and safe to re-run.

To inspect the playground database from the host:

```bash
psql postgresql://playground:playground@127.0.0.1:55433/playground
```

To run migrations manually (outside Compose):

```bash
DATABASE_URL=postgresql://playground:playground@127.0.0.1:55433/playground?schema=public \
  pnpm db:deploy
```

---

## Key and secret generation

All cryptographic keys, certificates, keystores, and credentials required by the local profiles are generated at setup time into owner-only, git-ignored runtime directories:

- **Certify signing keys & DIDs**: Generated by `pnpm mobile:inji setup` (or `node scripts/mobile-inji.mjs setup`). Keys reside in a git-ignored temporary storage directory.
- **Mimoto OIDC client keystore & OAuth secrets**: Generated by `node scripts/prepare-inji-web-local.mjs` into `$MIMOTO_RUNTIME_DIR` (defaults to `/tmp/mosip-web-local` or OS temp).
- **Nested `.gitignore` protection**: Runtime key directories include a nested `.gitignore` (`*` and `!.gitignore`) ensuring no private keys, `.p12` keystores, or `.env` files enter git tracking.
- **Strict permissions**: Sensitive secret files are generated with restrictive `0600` file modes.
- **Zero secrets in images/repo**: Dockerfiles and Compose files never bake secrets, certificates, or real credentials into images or repo files. Default env values are synthetic and non-secret.

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

`node:22.14.0-bookworm-slim`, `postgres:16-alpine`, and `nginx:1.27.5-alpine` all publish `linux/arm64` layers. Builds run natively on M-series without Rosetta. If you see `exec format error`, run:

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
- Actions pinned to verified major version tags (`@v4`). Node 22 (required by pnpm 11.25.0 for `node:sqlite`). Pinned pnpm 11.25.0.
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
npm install -g pnpm@11.25.0
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

The **core/mocks Compose stack** and `pnpm demo:docker` exercise mock and fixture paths only:

- The mock issuer is a synthetic OpenID4VCI server with an in-memory key. It does not represent Inji Certify.
- The mock verifier is a synthetic OpenID4VP server. It does not represent Inji Verify.
- The Reference Wallet is the playground's own automated wallet client. It is not Inji Web or Inji Wallet mobile.
- This specific command does not start local Inji services. The separate `pnpm demo:inji` command runs official Certify and Verify with a reference holder; see [its scope](../deploy/INJI_LOCAL.md).
- The CI nightly run is a mock-mode regression check, not a live Collab run.
- `DEMO PASS` or a passing smoke test **does not prove Inji interoperability**.

Real-wallet gates:
- **A1 (Inji Web)**: A dedicated signed-in account completed a managed JSON-LD journey on 25 October. The read-only committed export is browsable in the Compose demo; see [the evidence and limits](../submission/evidence/person2-managed-a1-2026-10-25/README.md). Final team review remains pending.
- **A2 (Inji mobile wallet)**: Passed for the recorded hybrid Android profile; [evidence and limits](../submission/evidence/person3-a2-mobile-2026-10-23/README.md).

---

## Not provided

- **Complete local Inji wallet stack**: The separate [official Certify/Verify control](../deploy/INJI_LOCAL.md) runs successfully on loopback with a reference holder. Local Mimoto/Inji Web login and presentation are still unimplemented. The older `deploy/docker-compose.inji.yml` is an unvalidated historical sketch and must not be used as evidence.
- **walt.id Compatibility Study**: A documentation-only comparison of walt.id Issuer2/Verifier2 vs. Inji components is available at `deploy/WALTID_COMPARISON.md`.
- **Collab nightly runs**: Require the public test environment credentials and are kept outside this repository.
- **Production hardening**: TLS termination, authentication, rate limiting, and secrets management are not part of this deployment.
- **Authentication**: The BFF API has no authentication. Do not expose this stack on a public interface with test credentials.

## Real Android SD-JWT setup

`pnpm mobile:inji` starts the separate controlled official-Certify mobile route and local QR console. See [mobile deployment](../deploy/MOBILE_INJI.md) for its digest pin, runtime-only keys, HTTPS tunnel, supported pre-authorized flow, stop command and exact evidence limits. It does not start or change the normal core/mocks profiles, and it does not close A2 without an observed phone journey.
