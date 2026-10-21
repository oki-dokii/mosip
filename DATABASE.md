# Database Schema

**Engine:** PostgreSQL 16 · **Access layer:** Prisma (migrations and typed client)

> **Implementation status (2026-10-21):** `runs`, `run_steps`, and `exchanges` are implemented in `apps/bff/prisma/schema.prisma`. Phase 3 adds `runs.service_versions` JSONB as a compact per-run snapshot; the separate `service_versions` reference table below remains planned. The implemented exchange payload columns use JSONB so both structured JSON and JSON string values can be stored through one repository contract.
**Version:** 0.1 (design phase) · **Date:** 2026-10-17
**Related:** SRS.md (data needs), BACKEND.md (API that reads and writes this), decisions.md (D-006)

The SQL below is the reference design. The Prisma schema is derived from it; if they differ, fix the Prisma schema and note the change in `decisions.md`.

---

## 1. Entity overview

```
scenarios ──< runs >── run_steps
                │  └──< exchanges
                │  └──< credentials
                │  └─── verification_results (1:1)
                │  └──< service_versions
                │  └──< issue_drafts
                └── parent_run_id (replay/tamper chain)
qr_probes (optional run link)
matrix_latest  (view: latest run per combination)
```

---

## 2. Enums

```sql
CREATE TYPE run_status AS ENUM ('pending','running','passed','failed','errored','cancelled');
CREATE TYPE step_status AS ENUM ('pending','running','succeeded','failed','skipped');
CREATE TYPE issuer_impl AS ENUM ('inji_certify','mock_issuer');
CREATE TYPE wallet_impl AS ENUM ('inji_web_assisted','reference_wallet');
CREATE TYPE verifier_impl AS ENUM ('inji_verify','mock_verifier');
CREATE TYPE cred_format AS ENUM ('ldp_vc','vc_sd_jwt','mso_mdoc');
CREATE TYPE flow_variant AS ENUM ('cross_device','same_device');
CREATE TYPE verify_outcome AS ENUM ('valid','invalid','expired','error');
CREATE TYPE trigger_source AS ENUM ('ui','ci','api');
CREATE TYPE tamper_kind AS ENUM ('expired','bad_signature','wrong_type','missing_disclosure','replay_nonce');
CREATE TYPE service_name AS ENUM ('certify','mimoto','inji_web','verify','esignet','mock_issuer','mock_verifier','playground');
CREATE TYPE draft_status AS ENUM ('draft','filed');
```

---

## 3. Tables

### 3.1 scenarios
Saved run configurations and presets.

```sql
CREATE TABLE scenarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  config        jsonb NOT NULL,           -- issuer, wallet, verifier, format, flow, tamper
  is_preset     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 3.2 runs
One execution. Replays and tamper runs point to their parent.

```sql
CREATE TABLE runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       uuid REFERENCES scenarios(id) ON DELETE SET NULL,
  parent_run_id     uuid REFERENCES runs(id) ON DELETE SET NULL,
  status            run_status NOT NULL DEFAULT 'pending',
  issuer            issuer_impl NOT NULL,
  wallet            wallet_impl NOT NULL,
  verifier          verifier_impl NOT NULL,
  format            cred_format NOT NULL,
  proof_type        text,                        -- e.g. Ed25519Signature2020, RS256, ES256
  algorithm         text,                        -- JOSE alg or equivalent
  flow              flow_variant NOT NULL DEFAULT 'cross_device',
  tamper            tamper_kind,                 -- null = no tamper
  expected_outcome  verify_outcome NOT NULL DEFAULT 'valid',
  actual_outcome    verify_outcome,
  outcome_matches   boolean GENERATED ALWAYS AS (actual_outcome IS NOT NULL AND actual_outcome = expected_outcome) STORED,
  error_code        text,                        -- stable code, e.g. VERIFY_REQUEST_FAILED
  error_detail      text,
  triggered_by      trigger_source NOT NULL DEFAULT 'ui',
  created_at        timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  finished_at       timestamptz
);
CREATE INDEX runs_created_idx   ON runs (created_at DESC);
CREATE INDEX runs_combo_idx     ON runs (issuer, wallet, verifier, format, flow, created_at DESC);
CREATE INDEX runs_status_idx    ON runs (status);
CREATE INDEX runs_parent_idx    ON runs (parent_run_id);
```

### 3.3 run_steps
Ordered stages of a run (see TRD orchestrator step list).

```sql
CREATE TABLE run_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq          integer NOT NULL,
  step_key     text NOT NULL,        -- INIT, ISSUE_OFFER, ISSUE_TOKEN, ISSUE_CREDENTIAL, STORE, PRESENT_REQUEST, PRESENT_SUBMIT, PRESENT_STATUS, PRESENT_RESULT, EVALUATE, REPORT
  title        text NOT NULL,
  status       step_status NOT NULL DEFAULT 'pending',
  summary      jsonb,                -- small, UI-friendly facts (no secrets)
  error_code   text,
  started_at   timestamptz,
  finished_at  timestamptz,
  UNIQUE (run_id, seq)
);
CREATE INDEX run_steps_run_idx ON run_steps (run_id, seq);
```

### 3.4 exchanges
Every HTTP exchange recorded by the Tap. One row = one request/response pair.

```sql
CREATE TABLE exchanges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id         uuid REFERENCES run_steps(id) ON DELETE SET NULL,
  seq             integer NOT NULL,                -- order within the run
  actor_from      text NOT NULL,                   -- 'wallet','playground','browser', ...
  actor_to        service_name NOT NULL,
  method          text NOT NULL,
  url             text NOT NULL,
  req_headers     jsonb NOT NULL DEFAULT '{}',     -- redacted
  req_body        text,                            -- redacted, size-capped
  req_truncated   boolean NOT NULL DEFAULT false,
  resp_status     integer,
  resp_headers    jsonb NOT NULL DEFAULT '{}',     -- redacted
  resp_body       text,                            -- redacted, size-capped
  resp_truncated  boolean NOT NULL DEFAULT false,
  redactions      jsonb NOT NULL DEFAULT '[]',     -- list of JSON paths / header names that were masked
  duration_ms     integer,
  error           text,                            -- network-level failure, if any
  started_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
CREATE INDEX exchanges_run_idx  ON exchanges (run_id, seq);
CREATE INDEX exchanges_step_idx ON exchanges (step_id);
```

Bodies are stored as text so non-JSON payloads (form-encoded, JWTs) survive intact. The UI parses JSON when possible.

### 3.5 credentials
The credential obtained in a run, or the tampered version used for presentation.

```sql
CREATE TABLE credentials (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'issued',   -- 'issued' | 'presented' (tampered copy)
  format         cred_format NOT NULL,
  issuer_id      text,                              -- iss / issuer DID or URL
  subject_id     text,
  credential_type text,                             -- VC type or vct
  algorithm      text,
  proof_type     text,
  raw            text NOT NULL,                     -- test credential only; contains no secrets
  decoded        jsonb,                             -- decoded view for the UI
  issued_at      timestamptz,
  expires_at     timestamptz,
  tampered       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credentials_run_idx ON credentials (run_id);
```

### 3.6 verification_results
Verifier output for the run (1:1).

```sql
CREATE TABLE verification_results (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
  verifier       verifier_impl NOT NULL,
  outcome        verify_outcome NOT NULL,
  request_id     text,                              -- e.g. Verify requestId
  transaction_id text,                              -- e.g. Verify transactionId
  per_credential jsonb,                             -- verifier's per-VC verdicts
  raw            jsonb,                             -- raw result JSON (redacted)
  error_code     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

### 3.7 service_versions
Versions of each service touched by a run (FR-83).

```sql
CREATE TABLE service_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  service      service_name NOT NULL,
  image_tag    text,
  version      text,
  commit_sha   text,
  source       text,                                -- 'env' | 'actuator' | 'manual'
  captured_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, service)
);
CREATE INDEX service_versions_lookup_idx ON service_versions (service, version);
```

### 3.8 issue_drafts (P2)
GitHub issue drafts generated from runs.

```sql
CREATE TABLE issue_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  target_repo  text NOT NULL,                       -- e.g. mosip/inji-verify
  title        text NOT NULL,
  body         text NOT NULL,
  status       draft_status NOT NULL DEFAULT 'draft',
  issue_url    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 3.9 qr_probes (P2)
QR capacity measurements.

```sql
CREATE TABLE qr_probes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid REFERENCES runs(id) ON DELETE SET NULL,
  label          text NOT NULL,                     -- e.g. 'vp-request', 'credential-offer'
  payload_bytes  integer NOT NULL,
  qr_version     integer,
  ecc_level      text,
  fits           boolean NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Views

### 4.1 matrix_latest
Latest finished run per combination, used by the interop matrix.

```sql
CREATE VIEW matrix_latest AS
SELECT DISTINCT ON (issuer, wallet, verifier, format, flow, COALESCE(tamper::text,'none'))
  id AS run_id, issuer, wallet, verifier, format, proof_type, flow, tamper,
  expected_outcome, actual_outcome, outcome_matches, status, error_code, finished_at
FROM runs
WHERE status IN ('passed','failed')
ORDER BY issuer, wallet, verifier, format, flow, COALESCE(tamper::text,'none'), finished_at DESC;
```

A run is `passed` when `actual_outcome = expected_outcome` (so a tamper run that is correctly rejected counts as passed) and `failed` when it differs. `errored` means the run could not complete (for example a service was unreachable) and is excluded from the matrix.

---

## 5. Data rules
1. **Secrets:** redaction happens before insert. Tables never contain access tokens, pre-authorized codes, refresh tokens or private keys. `exchanges.redactions` lists what was masked.
2. **Size caps:** bodies above `TAP_BODY_LIMIT_BYTES` are truncated and flagged.
3. **Deletes:** deleting a run cascades to steps, exchanges, credentials, result, versions and drafts.
4. **Retention:** keep the last 500 runs by default (configurable); a nightly job removes older rows except runs referenced by a saved report.
5. **Immutability:** exchanges and steps are append-only after a run finishes.
6. **Time:** all timestamps are `timestamptz` in UTC.
7. **IDs:** UUIDs generated in the database.

---

## 6. Example queries

History with filters (FR-80, FR-81):
```sql
SELECT r.id, r.created_at, r.issuer, r.wallet, r.verifier, r.format, r.status, r.actual_outcome
FROM runs r
JOIN service_versions sv ON sv.run_id = r.id AND sv.service = 'certify'
WHERE sv.version = $1 AND r.format = $2 AND r.actual_outcome = $3
ORDER BY r.created_at DESC
LIMIT 50 OFFSET $4;
```

Regression between two versions of Verify:
```sql
SELECT r.issuer, r.wallet, r.format, sv.version,
       count(*) FILTER (WHERE r.status = 'passed') AS passed,
       count(*) FILTER (WHERE r.status = 'failed') AS failed
FROM runs r
JOIN service_versions sv ON sv.run_id = r.id AND sv.service = 'verify'
WHERE sv.version IN ($1, $2)
GROUP BY r.issuer, r.wallet, r.format, sv.version;
```

---

## 7. Migrations and seeds
- Prisma migrations live in `apps/bff/prisma/migrations`; `20261021000100_init` creates the implemented run, step, and exchange slice.
- Seeds: preset scenarios (all-Inji SD-JWT, all-Inji JSON-LD, mock issuer → Verify, Certify → mock verifier, and one preset per tamper kind).
