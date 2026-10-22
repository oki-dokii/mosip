# Person 4 Workstream Handoff — Packaging, CI, and Release Verification

**Branch**: `person4/packaging-ci`  
**Base**: `main` (`0e845dd`)  
**Audience**: Integrators, Collaborators, Reviewers  
**Status**: Ready for Pull Request & Merge  

---

## 1. Overview & What Changed

This workstream completes **Person 4: packaging, CI, and release checks** from the team's four-person execution plan. All deliverables were implemented strictly on `person4/packaging-ci` without modifying teammate-owned files or branches.

### Summary of Accomplishments:
1. **Multi-stage Dockerfile**:
   - Pinned base image to `node:22.14.0-bookworm-slim` (Node 22 LTS required by `pnpm@11.25.0` for the built-in `node:sqlite` module).
   - Enforced non-root user execution (`USER node`, UID 1000) for all runtime stages.
   - Injected OCI metadata labels (`org.opencontainers.image.source`, `revision`, `created`).
   - Separated database migrations into a dedicated, idempotent one-shot `migrate` target.
   - Pinned nginx base to `nginx:1.27.5-alpine`.
2. **Docker Compose Profiles**:
   - Added `profiles: [core]` to PostgreSQL and the one-shot `migrate` container.
   - Isolated mock issuer and mock verifier into `profiles: [mocks]`.
   - Real health checks on all services with explicit `depends_on: { condition: service_healthy }` and `depends_on: { condition: service_completed_successfully }` for migrations.
   - Bound host ports strictly to `127.0.0.1`.
3. **Automated E2E Smoke Test (`e2e/smoke.mjs`)**:
   - Bounded health polling (90s) asserting expected mode and Postgres storage.
   - Executes baseline valid SD-JWT journey and corrupted signature detection journey via `POST /api/v1/runs`.
   - Asserts expected vs actual API outcome fields.
   - Scans API responses for secret markers (Bearer tokens, JWK private members `"d":`, auth codes).
   - Validates matrix export and prints standard evidence limits banner.
4. **CI & Automation Upgrades (`.github/workflows/`)**:
   - Upgraded `.github/workflows/ci.yml` into a two-stage pipeline (`verify` $\rightarrow$ `compose-smoke`).
   - Uses verified `@v4` official action tags across all jobs.
   - Added concurrency control (`cancel-in-progress: true`), job timeouts, least-privilege `contents: read`, and automated Compose log dump artifacts on failure.
   - Added `.github/workflows/nightly.yml` for scheduled daily mock regression runs.
5. **Comprehensive Documentation (`DEPLOYMENT.md`)**:
   - Updated with startup recipes, profile comparison matrix, synthetic environment variable catalog, troubleshooting guide, and clean-machine verification checklist.

---

## 2. File-by-File Changes

| File | Status | Description |
| :--- | :--- | :--- |
| `Dockerfile` | Modified | Pinned Node 22 LTS, non-root user (`node`), OCI labels, separate `migrate` stage, direct `pnpm@11.25.0` installation. |
| `docker-compose.yml` | Modified | Profile separation (`core` / `mocks`), real HTTP/TCP health checks, explicit health dependencies, 127.0.0.1 port bindings. |
| `.dockerignore` | Modified | Comprehensive exclusions for `.env*`, `*.har`, Postman files (`*.postman_environment.json`), local evidence, and `dist/`. |
| `e2e/smoke.mjs` | Added | Deterministic HTTP smoke test with redaction scanning and evidence boundaries. |
| `.github/workflows/ci.yml` | Modified | Two-stage release gate (`verify` $\rightarrow$ `compose-smoke`), Node 22, pnpm 11.25.0, action tags `@v4`, log upload on failure. |
| `.github/workflows/nightly.yml` | Added | Scheduled cron workflow for daily mock regression checks (mock-only). |
| `DEPLOYMENT.md` | Modified | Full deployment guide with profile matrices, env catalog, modes, and reproduction checklist. |
| `package.json` | Modified | Added `"e2e:smoke": "node e2e/smoke.mjs"` to root `scripts` (Rule 8 owned exception). |

---

## 3. Important Notes for Collaborators & Integrator

### A. Node.js & pnpm Engine Requirements
- The repository uses `pnpm@11.25.0` which depends internally on `node:sqlite`.
- `node:sqlite` was introduced in Node 22.13+. Therefore, all Docker runtime images and GitHub Actions workflows now use **Node 22 LTS**.
- If working outside Docker, ensure your local Node version is **Node 22+**.

### B. Two Quick Requests for the Integrator
1. **Merge `package.json`**: Ensure `"e2e:smoke": "node e2e/smoke.mjs"` remains under `scripts`.
2. **README CI Badge**: Add the CI status badge to the top of `README.md`:
   ```markdown
   [![Playground CI](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml/badge.svg)](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml)
   ```

### C. Optional Future Enhancement (Mock Verifier)
- The mock verifier (`apps/mock-verifier/src/server.ts`) currently does not expose an HTTP `GET /health` route.
- In Compose, we use an ESM-compatible TCP connect check (`import('node:net')`).
- If Person 2 or 3 touches `apps/mock-verifier/src/server.ts`, adding a simple `GET /health` endpoint returning `{ status: "ok" }` would allow standard HTTP health checks.

---

## 4. How to Run and Verify Locally

### Full Stack (Core + Mocks)
```bash
docker compose --profile core --profile mocks up --build -d
# Check health of all services
docker compose --profile core --profile mocks ps

# Run the automated smoke test
node e2e/smoke.mjs
# or: pnpm e2e:smoke

# Teardown
docker compose --profile core --profile mocks down -v
```

### Core Stack Alone (Fixture Mode, Without Mocks)
```bash
docker compose --profile core up --build -d
docker compose --profile core ps
docker compose --profile core down
```

---

## 5. Verification Evidence Summary

- **Local Docker Compose**: All services healthy (`bff`, `web`, `postgres`, `mock-issuer`, `mock-verifier`).
- **Security**: Non-root user verified (`uid=1000(node)`), zero `.env` files present in container images.
- **E2E Smoke**: **30/30 assertions passed (0 failed)**.
- **Fresh-Clone Rehearsal**: Executed in a clean temporary directory (`rehearsal-660df6d9`) without local caches; all tests passed.
- **GitHub Actions CI**: Verified on GitHub Actions runner with Node 22 and pnpm 11.25.0.

---

## 6. Evidence Limits & Disclaimers

> **IMPORTANT**:
> - The packaging and e2e smoke tests exercise local synthetic mocks and fixture drivers only.
> - **They do not start a local Inji stack** and **do not prove Inji Web or Inji Wallet interoperability**.
> - Real-wallet (A1/A2) verification and live Collab integrations are owned by Persons 1–3.
