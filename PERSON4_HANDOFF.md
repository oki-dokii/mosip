# Person 4 Workstream Handoff — Packaging, CI, and Release Verification

**Branch**: `person4/packaging-ci`  
**Base**: `origin/main` (`0e845dd`)  
**Audience**: Integrator, Collaborators, Reviewers  
**Status**: Completed and Verified; Ready for Integration  

---

## 1. Overview & What Changed

This workstream completes **Person 4: packaging, CI, local Inji profile architecture, and release verification** in accordance with the team's four-person plan. All deliverables were implemented strictly on `person4/packaging-ci` without modifying teammate-owned code or branches.

### Summary of Accomplishments:
1. **Multi-stage Production Dockerfile**:
   - Pinned Node base image to `node:22.14.0-bookworm-slim` (Node 22 LTS required by `pnpm@11.25.0` for `node:sqlite`).
   - Enforced non-root user execution (`USER node`, UID 1000) for all runtime stages.
   - Injected OCI metadata labels (`org.opencontainers.image.source`, `revision`, `created`).
   - Separated database migrations into a dedicated, idempotent one-shot `migrate` target (`prisma migrate deploy`).
   - Pinned nginx base to `nginx:1.27.5-alpine`.
2. **Docker Compose Profiles & Opt-In Inji Architecture**:
   - Added `profiles: [core]` to PostgreSQL, BFF, Web, and the one-shot `migrate` container.
   - Isolated mock issuer and mock verifier into `profiles: [mocks]`.
   - Real health checks on all services with explicit `depends_on: { condition: service_healthy }` and `depends_on: { condition: service_completed_successfully }` for migrations.
   - Bound host ports strictly to `127.0.0.1`.
   - Created opt-in Inji profile in `deploy/docker-compose.inji.yml` (`profiles: [inji]`) for official Inji services without polluting core/mocks.
3. **Local Inji Profile Architecture & Blocker Analysis (`deploy/INJI_LOCAL.md`)**:
   - Pinned component provenance table for Inji Certify (`v0.14.0`), Inji Verify (`v0.18.2`), Mimoto (`v0.22.0`), and Inji Web (`v0.17.0`) retrieved on 2026-10-22.
   - Stage 1 & Stage 2 evaluations documenting why standalone local Inji execution requires MOSIP Keymanager and eSignet IDP with registered client keystores.
   - Clear endpoint handoff to Person 2 (`http://localhost:3000` Inji Web, `http://localhost:9090` Mimoto).
   - Canonical origins and capture proxy prerequisites table handed to Person 1.
4. **walt.id v2 Compatibility Comparison (`deploy/WALTID_COMPARISON.md`)**:
   - Documentation-only study analyzing `waltid-identity` `v1.2.0` (Issuer2/Verifier2) vs. Inji draft-era components.
   - Detailed dimension matrix covering protocol versions (OID4VCI 1.0 vs draft 13, OID4VP 1.0 vs drafts 21-23), formats, DCQL vs DIF PEX, grant types, and encryption.
   - Honest finding: zero driver changes made, no cross-vendor pass claimed.
5. **Automated E2E Smoke Test (`e2e/smoke.mjs`)**:
   - Bounded health polling (90s) asserting expected mode and Postgres storage.
   - Executes baseline valid SD-JWT journey and corrupted signature detection journey via `POST /api/v1/runs`.
   - Scans API responses for secret markers (Bearer tokens, JWK private members `"d":`, auth codes).
   - 30/30 assertions pass against live Compose stack.
6. **Hardened CI & Scheduled Regression (`.github/workflows/`)**:
   - Upgraded `.github/workflows/ci.yml` into a two-stage pipeline (`verify` $\rightarrow$ `compose-smoke`).
   - Wired `pnpm audit:secrets` into `verify` job.
   - Uses verified official `@v4` actions, concurrency control (`cancel-in-progress: true`), job timeouts, least-privilege `contents: read`, and automated Compose log dump artifacts on failure.
   - Added `.github/workflows/nightly.yml` for scheduled daily mock regression runs (mock-only).
7. **Hygiene & Clean-Machine Rehearsal**:
   - `git ls-files` sensitive file audit: zero sensitive files committed (only `.env.example`).
   - `pnpm audit:secrets`: 156 tracked files scanned, 0 secrets detected.
   - Fresh-clone rehearsal verified on developer machine.

---

## 2. File-by-File Ownership & Changes

All modified and added files belong strictly to Person 4's owned area (Rule 8):

| File | Status | Description |
| :--- | :--- | :--- |
| `Dockerfile` | Modified | Pinned Node 22 LTS, non-root user (`node`), OCI labels, separate `migrate` stage, direct `pnpm@11.25.0` installation. |
| `docker-compose.yml` | Modified | Profile separation (`core` / `mocks`), real HTTP/TCP health checks, explicit health dependencies, 127.0.0.1 port bindings. |
| `.dockerignore` | Modified | Comprehensive exclusions for `.env*`, `*.har`, Postman files (`*.postman_environment.json`), local evidence, and `dist/`. |
| `deploy/INJI_LOCAL.md` | Added | Component provenance table, Stage 1/2 evaluations, Person 2 endpoints, Person 1 canonical origins. |
| `deploy/docker-compose.inji.yml` | Added | Opt-in Inji stack definition with health checks and port mappings. |
| `deploy/WALTID_COMPARISON.md` | Added | Documentation-only comparison between walt.id Issuer2/Verifier2 and Inji stack. |
| `DEPLOYMENT.md` | Modified | Full deployment guide with profile matrices, env catalog, modes, clean-machine checklist, and evidence limits. |
| `e2e/smoke.mjs` | Added | Deterministic HTTP smoke test with redaction scanning and evidence boundaries. |
| `.github/workflows/ci.yml` | Modified | Two-stage release gate (`verify` $\rightarrow$ `compose-smoke`), Node 22, pnpm 11.25.0, action tags `@v4`, secret audit, log upload. |
| `.github/workflows/nightly.yml` | Added | Scheduled cron workflow for daily mock regression checks (mock-only). |
| `package.json` | Modified | Added `"e2e:smoke": "node e2e/smoke.mjs"` to root `scripts` (Rule 8 owned exception). |
| `PERSON4_HANDOFF.md` | Modified | Complete handoff document with real outputs, patch series instructions, and integrator snippets. |

---

## 3. Local Inji Profile Status & Provenance Summary

### Component Provenance:
| Component | Repository | Tag / Commit | Config Source | Local Port | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Inji Certify | `mosip/inji-certify` | `v0.14.0` | `https://docs.inji.io/inji-certify/` | `8080` | **BLOCKED**: Requires MOSIP Keymanager + eSignet IDP |
| Inji Verify | `mosip/inji-verify` | `v0.18.2` | `https://docs.inji.io/inji-verify/` | `8081` | **BLOCKED**: Requires registered verifier configuration |
| Mimoto | `mosip/mimoto` | `v0.22.0` | `https://docs.inji.io/inji-wallet/inji-web/` | `9090` | **BLOCKED**: Requires eSignet OIDC client keystore |
| Inji Web | `mosip/inji-web` | `v0.17.0` | `https://docs.inji.io/inji-wallet/inji-web/` | `3000` | **BLOCKED**: Dependent on Mimoto & authenticated user |

### Handed to Person 2 (Inji Web Assisted UI):
- Inji Web UI: `http://localhost:3000`
- Mimoto BFF: `http://localhost:9090`
- Prerequisites: modern browser, OIDC client keystore registered in eSignet, test user identity.
- Status: Handed over with documented external blocker. Person 2 consumes these endpoints without changing Compose.

### Handed to Person 1 (Protocol Capture Proxy):
- Pinned Canonical Origins:
  - Certify: `http://127.0.0.1:8080` (Collab: `https://injicertify-mock.collab.mosip.net`)
  - Verify: `http://127.0.0.1:8081` (Collab: `https://injiverify.collab.mosip.net`)
  - Mimoto: `http://127.0.0.1:9090`
  - Inji Web: `http://127.0.0.1:3000`
  - eSignet: `https://esignet-mock.collab.mosip.net`
- Redirect URIs: `http://localhost:3000/callback` (Web), `http://localhost:9090/login/oauth2/code/esignet` (Mimoto).
- Constraints: No path rewriting (`/tap/...` invalidates client authentication and JWT signatures); transparent forwarding only.

---

## 4. Verification Evidence (Real Outputs)

### A. Compose Configuration & Health
```bash
docker compose --profile core --profile mocks config
# Exited 0; valid YAML

docker compose --profile core --profile mocks up -d
# Created & started:
# mosip-postgres-1: Up (healthy)
# mosip-migrate-1: Completed successfully (exit 0)
# mosip-bff-1: Up (healthy)
# mosip-web-1: Up (healthy)
# mosip-mock-issuer-1: Up (healthy)
# mosip-mock-verifier-1: Up (healthy)

curl -fsS http://localhost:4000/api/v1/health
# {"services":[{"name":"playground","status":"up","version":"0.2.0","latencyMs":0}],"storage":"postgres","driverMode":"fixture"}
```

### B. E2E Smoke Test (`node e2e/smoke.mjs`)
```
── Step 1: BFF health check ──────────────────────────────────────
   BFF responded: driverMode=fixture storage=postgres
── Step 2: Health field assertions ────────────────────────────────
  ✓  driverMode is valid ("fixture" or "collab")
  ✓  storage === "postgres"
  ✓  services array non-empty
  ✓  Redaction check: health response
── Step 3: Run cases ───────────────────────────────────────────────
   [baseline (valid)] Starting run (tamper=none, expected=valid)
  ✓  baseline (valid): POST /api/v1/runs → runId
  ✓  baseline (valid): run completed within 120s
  ✓  baseline (valid): run.status === "passed"
  ✓  baseline (valid): run.actualOutcome === "valid"
  ✓  baseline (valid): run.expectedOutcome === "valid"
  ✓  Redaction check: run baseline (valid)
  ✓  baseline (valid): steps.items non-empty
  ✓  Redaction check: steps baseline (valid)
  ✓  baseline (valid): exchanges.items non-empty
  ✓  Redaction check: exchanges baseline (valid)
  ✓  baseline (valid): report.evidence.tier === "fixture"
  ✓  Redaction check: report baseline (valid)
   [bad_signature (invalid)] Starting run (tamper=bad_signature, expected=invalid)
  ✓  bad_signature (invalid): POST /api/v1/runs → runId
  ✓  bad_signature (invalid): run completed within 120s
  ✓  bad_signature (invalid): run.status === "passed"
  ✓  bad_signature (invalid): run.actualOutcome === "invalid"
  ✓  bad_signature (invalid): run.expectedOutcome === "invalid"
  ✓  Redaction check: run bad_signature (invalid)
  ✓  bad_signature (invalid): steps.items non-empty
  ✓  Redaction check: steps bad_signature (invalid)
  ✓  bad_signature (invalid): exchanges.items non-empty
  ✓  Redaction check: exchanges bad_signature (invalid)
  ✓  bad_signature (invalid): report.evidence.tier === "fixture"
  ✓  Redaction check: report bad_signature (invalid)
── Step 4: Matrix export ───────────────────────────────────────────
  ✓  Matrix contains both test runs
  ✓  Redaction check: matrix export
────────────────────────────────────────────────────────────────────
E2E smoke summary: Passed 30/30 (0 failed)
```

### C. Security & Non-Root Verification
```bash
docker compose --profile core --profile mocks run --rm --entrypoint id bff
# uid=1000(node) gid=1000(node) groups=1000(node)

docker compose --profile core --profile mocks run --rm --entrypoint "sh -c 'ls -la /workspace/.env* 2>&1 || true'" bff
# -rwxr-xr-x 1 root root 1686 Oct 22 05:56 /workspace/.env.example
# (zero real .env files present)
```

### D. Core-Only Profile Verification
```bash
docker compose --profile core up -d
# Starts postgres (healthy) -> migrate (exit 0) -> bff (healthy) -> web (healthy)
# No mock services started.
docker compose --profile core down
# Clean teardown.
```

### E. Public-Submission Hygiene Audit
```bash
git ls-files | Select-String -Pattern '(\.env($|\.)|postman|\.har$|\.pem$|\.key$|\.p12$|\.jks$|keystore|id_rsa|student)'
# .env.example (expected documentation default; zero leaks)

node scripts/audit-secrets.mjs
# v24.12.0
# Secret audit passed: 156 tracked/non-ignored filenames checked; documentation, evidence, fixtures and scripts scanned.
```

---

## 5. Requests for the Integrator

1. **Root `package.json`**:
   Ensure the following script entry is preserved in the merged `package.json`:
   ```json
   "e2e:smoke": "node e2e/smoke.mjs"
   ```
2. **README CI Badge**:
   Add the GitHub Actions CI badge to `README.md` (Integrator owned):
   ```markdown
   [![Playground CI](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml/badge.svg)](https://github.com/oki-dokii/mosip/actions/workflows/ci.yml)
   ```
3. **Proposed README.md Docker Quickstart Snippet**:
   ```markdown
   ### Run with Docker Compose

   ```bash
   docker compose --profile core --profile mocks up --build -d --wait
   ```
   Open [http://localhost:5174](http://localhost:5174). All mock services, PostgreSQL, and the BFF start with synthetic defaults.
   See [DEPLOYMENT.md](DEPLOYMENT.md) for full operational details.
   ```

---

## 6. Patch Series for the Integrator

To apply these commits in order on `main` while preserving original author identity:

```bash
git format-patch origin/main..person4/packaging-ci -o ../person4-patches
# To apply on main:
# git am ../person4-patches/*.patch
```

---

## 7. Evidence Limits & Disclaimers

> **CRITICAL EVIDENCE BOUNDARY**:
> - The Compose smoke tests and local profiles exercise local synthetic mocks and fixture drivers only.
> - **They do not prove all-Inji, HAIP compliance, or live cross-vendor certification.**
> - Real-wallet gates (**A1: Inji Web**, **A2: Inji Mobile Wallet**) are separate deliverables owned by Persons 1–3.
> - Standalone local Inji services remain **BLOCKED** on upstream MOSIP Keymanager and eSignet IDP provisioning.
> - Independent clean-machine verification remains **OPEN** until repeated on an independent host by another contributor.
