# Endpoint sheet — Inji Interoperability Playground

**Purpose:** Canonical service map for synthetic local deployments. Persons 2 and 3 consume this sheet; they do not edit Compose. All configuration is synthetic; no real credentials, OTPs or personal data.

**26 October integration update:** The connected JSON-LD profile now passes issuance, exact-card reload and presentation. Use `pnpm start:local-full`, `pnpm smoke:local-full` and `pnpm demo:web-jsonld`. It reuses the existing three projects, switches Certify to 0.14.0, and uses an explicit synthetic authorization/DID adapter. The alpha SD-JWT entries below describe a mutually exclusive profile, not the connected JSON-LD configuration. See [the current runbook](INJI_WEB_LOCAL.md) and `connectedJsonld` in the catalogue. Endpoint readiness alone establishes no wallet evidence tier.

**Machine-readable copy:** [`endpoints.json`](endpoints.json) (same content, parseable by scripts).

**Status key:** `not_started` · `started` · `healthy` · `flow_observed(<run-id>)` · `BLOCKED: <reason>` · `unsettled`

---

## 1. Playground core (always available)

### 1.1 Playground BFF (`bff`, profile `core`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://localhost:4000` |
| **Container origin** | `http://bff:4000` (Compose network name `bff`) |
| **Host port binding** | `127.0.0.1:4000→4000` |
| **Health route** | `GET /api/v1/health` → `{"services":[…],"storage":"postgres","driverMode":"…"}` |
| **Run API** | `POST /api/v1/runs` body `{issuer,wallet,verifier,format,tamper}` |
| **Steps API** | `GET /api/v1/runs/:id/steps` |
| **Exchanges API** | `GET /api/v1/runs/:id/exchanges` |
| **Matrix export** | `GET /api/v1/matrix` |
| **Driver env var** | `PLAYGROUND_DRIVER_MODE` (`fixture` or `collab`); `VERIFY_BASE_URL`; `MOCK_ISSUER_BASE_URL`; `MOCK_VERIFIER_BASE_URL` |
| **Image / tag** | Built from repo `Dockerfile` target `bff` |
| **Protocol** | Internal REST; not an OpenID4VCI/VP endpoint |
| **Status** | `healthy` (CI-verified; see ci.yml compose-smoke job) |

### 1.2 Playground Web (`web`, profile `core`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://localhost:5174` |
| **Container origin** | `http://web:80` |
| **Host port binding** | `127.0.0.1:${PLAYGROUND_WEB_PORT:-5174}→80` |
| **Health route** | `GET /` (nginx; HTTP 200) |
| **Image / tag** | Built from repo `Dockerfile` target `web` (nginx) |
| **Status** | `healthy` |

### 1.3 Playground PostgreSQL (`postgres`, profile `core`)

| Field | Value |
|---|---|
| **Host port** | `127.0.0.1:${PLAYGROUND_POSTGRES_PORT:-55433}→5432` |
| **Database** | `playground`, user `playground`, password `playground` (synthetic default; override with `POSTGRES_PASSWORD`) |
| **Volume** | `playground-postgres` |
| **Health route** | `pg_isready -U playground -d playground` |
| **Image / tag** | `postgres:16-alpine` (digest not attested; pull-time latest patch) |
| **Status** | `healthy` |

---

## 2. Mock services (profile `mocks`, Compose network only)

### 2.1 Mock issuer (`mock-issuer`, profile `mocks`)

| Field | Value |
|---|---|
| **Container origin** | `http://mock-issuer:4101` (container-to-container only; not published to host) |
| **Public browser origin** | Not published; reachable only inside Compose network |
| **Discovery / health** | `GET /.well-known/openid-credential-issuer` HTTP 200 |
| **Credential endpoint** | `POST /credential` (synthetic SD-JWT) |
| **Pre-authorized grant** | Used when `MOCK_ISSUER_ENABLE_TEST_CASES=true` |
| **Issuer metadata URL** | `http://mock-issuer:4101/.well-known/openid-credential-issuer` |
| **Image / tag** | Built from repo `Dockerfile` target `mock-issuer` |
| **Protocol draft** | OID4VCI (draft, pre-authorized only, SD-JWT) |
| **Status** | `healthy` |

### 2.2 Mock verifier (`mock-verifier`, profile `mocks`)

| Field | Value |
|---|---|
| **Container origin** | `http://mock-verifier:4102` |
| **Public browser origin** | Not published |
| **Health** | TCP connect :4102 |
| **Presentation request URL** | `POST /vp-request` (internal, BFF-driven) |
| **Image / tag** | Built from repo `Dockerfile` target `mock-verifier` |
| **Protocol draft** | OID4VP (mock, SD-JWT) |
| **Status** | `healthy` |

---

## 3. Official Inji Certify + Verify (pinned local control)

These two components run as a **separate** Compose project `mosip-local-inji` plus the Certify instance in the dedicated `mosip-mobile-a2` project. Started with `pnpm demo:inji`. They are **not** part of the `inji` opt-in profile in `docker-compose.inji.yml`.

### 3.1 Inji Certify with plugins (`mobile-certify`, project `mosip-mobile-a2`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://127.0.0.1:18090` |
| **Container origin** | `http://127.0.0.1:18090` (loopback-only; not a Compose network alias) |
| **Host port binding** | `127.0.0.1:18090→8090` |
| **Issuer URL** | `http://127.0.0.1:18090/v1/certify` |
| **Issuer metadata URL** | `http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer` |
| **Token endpoint** | `http://127.0.0.1:18090/v1/certify/oauth/token` |
| **Credential endpoint** | `http://127.0.0.1:18090/v1/certify/issuance/credential` |
| **Pre-auth data** | `POST http://127.0.0.1:18090/v1/certify/pre-authorized-data` |
| **Health route** | `GET /v1/certify/.well-known/openid-credential-issuer` HTTP 200 |
| **Image / tag / digest** | `injistack/inji-certify-with-plugins:1.0.0-alpha.1@sha256:1579b2449f1a7213fe25de1f6a1509b5636f1fedf0d7f5c4cfd07b9f0fc5b346` |
| **Config source commit** | `8fdf71656979a72fa8263766d4dec3cc25127b76` |
| **Credential format** | `dc+sd-jwt` (credential type label used by Certify) |
| **Protocol** | OID4VCI pre-authorized grant |
| **TLS / DNS** | None; loopback only; no hosts-file entry needed |
| **Status** | `flow_observed(local-inji-smoke 2026-10-25)` |

### 3.2 Inji Verify service (`verify-service`, project `mosip-local-inji`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://127.0.0.1:18081` |
| **Container origin** | `http://127.0.0.1:18081` (loopback; project `mosip-local-inji`) |
| **Host port binding** | `127.0.0.1:18081→8080` |
| **Verifier base URL** | `http://127.0.0.1:18081/v1/verify` |
| **VP request URL** | `POST http://127.0.0.1:18081/v1/verify/vp-request` |
| **Direct-post URL** | `POST http://127.0.0.1:18081/v1/verify/vp-submission/direct-post` |
| **Result URL** | `GET http://127.0.0.1:18081/v1/verify/v2/vp-results/:transactionId` |
| **Health route** | `GET /v1/verify/actuator/health` → `{"status":"UP"}` |
| **DID** | `did:web:localhost%3A18081:v1:verify` |
| **Image / tag / digest** | `injistack/inji-verify-service:0.18.2@sha256:2ed468e7e1f1ce317a41476dd131f4ce8f081b0f055a080c95e99a92cc192bdd` |
| **Presentation format** | Accepts `vc+sd-jwt` in Presentation Exchange |
| **Protocol** | OID4VP + Presentation Exchange |
| **TLS / DNS** | None; loopback only |
| **Status** | `flow_observed(local-inji-smoke 2026-10-25)` |

### 3.3 Verify PostgreSQL (`verify-db`, project `mosip-local-inji`)

| Field | Value |
|---|---|
| **Host port** | Not published (Compose network only) |
| **Database** | `inji_verify`, user `postgres`, password `local-verify-synthetic` (synthetic) |
| **Volume** | `mosip-local-inji_verify-db-data` |
| **Image / tag / digest** | `postgres:13@sha256:4689940c683801b4ab839ab3b0a0a3555a5fe425371422310944e89eca7d8068` |
| **Status** | `healthy` |

---

## 4. Official Inji Web + Mimoto (pinned wallet shell, project `mosip-web-local`)

Started with `pnpm stage:web-local`. Requires `pnpm install` and network access on first run. Generated files live in `${MIMOTO_RUNTIME_DIR:-/tmp/mosip-web-local}` (git-ignored).

> **Evidence boundary:** wallet login and persistence proven. Local issuance and presentation are **not** configured. See [`deploy/INJI_WEB_LOCAL.md`](INJI_WEB_LOCAL.md).

### 4.1 Inji Web frontend (`inji-web`, project `mosip-web-local`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://127.0.0.1:18093` |
| **Container origin** | `http://inji-web:3004` (within `mosip-web-local` Compose network) |
| **Host port binding** | `127.0.0.1:18093→3004` |
| **Health route** | `GET http://127.0.0.1:18093/` HTTP 200 |
| **OIDC redirect URI** | `http://127.0.0.1:18093/v1/mimoto/oauth2/callback/google` (handled by Mimoto) |
| **Image / tag / digest** | `injistack/inji-web:0.17.0@sha256:62ca25a6c2f5c3d61edfed1e43e52885f1bcf1229b3a3ffb89c117245f839719` |
| **Status** | `flow_observed(check-inji-web-local 2026-10-25)` |

### 4.2 Mimoto wallet BFF (`mimoto-service`, project `mosip-web-local`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://127.0.0.1:18099` |
| **Container origin** | `http://mimoto-service:8099` |
| **Host port binding** | `127.0.0.1:18099→8099` |
| **Issuer catalog URL** | `GET http://127.0.0.1:18093/v1/mimoto/issuers` (proxied through Inji Web nginx) |
| **OAuth2 callback** | `GET /v1/mimoto/oauth2/callback/google` |
| **Health route** | `GET http://127.0.0.1:18093/v1/mimoto/issuers` HTTP 200 (readiness probe; aggregate actuator reports HSMHealth DOWN — expected for this isolated profile, not hidden) |
| **OIDC client ID** | `local-synthetic` (synthetic) |
| **OIDC client secret** | Generated at setup time by `scripts/prepare-inji-web-local.mjs`; stored in `${MIMOTO_RUNTIME_DIR}/wallet.env`; never committed |
| **OIDC keystore** | `${MIMOTO_RUNTIME_DIR}/oidckeystore.p12`; generated by OpenSSL; never committed |
| **Image / tag / digest** | `injistack/mimoto:0.22.0@sha256:89fc81eeb8c911c8a9944e4071d8f3e8f287d3de697c4461f2b3a2e8ce29858e` |
| **Status** | `flow_observed(check-inji-web-local 2026-10-25)` |

### 4.3 Synthetic OAuth2 identity provider (`synthetic-idp`, project `mosip-web-local`)

| Field | Value |
|---|---|
| **Public browser origin** | `http://127.0.0.1:18095` |
| **Container origin** | `http://synthetic-idp:8080` |
| **Host port binding** | `127.0.0.1:18095→8080` |
| **Authorization endpoint** | `GET http://127.0.0.1:18095/authorize` (auto-approves fixed synthetic user) |
| **Token endpoint** | `POST http://synthetic-idp:8080/token` (container-internal) |
| **Userinfo endpoint** | `GET http://synthetic-idp:8080/userinfo` |
| **JWKS endpoint** | `GET http://synthetic-idp:8080/jwks` |
| **Health route** | `GET http://127.0.0.1:18095/health` HTTP 200 |
| **Registered client ID** | `local-synthetic` (matches Mimoto `GOOGLE_OAUTH_CLIENT_ID`) |
| **Client secret** | Matches `MIMOTO_GOOGLE_CLIENT_SECRET` in `${MIMOTO_RUNTIME_DIR}/wallet.env` |
| **Image / tag / digest** | `node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914` |
| **Script** | `scripts/local-web-idp.mjs` (mounted read-only) |
| **Status** | `flow_observed(check-inji-web-local 2026-10-25)` |

### 4.4 Mimoto PostgreSQL (`mimoto-db`, project `mosip-web-local`)

| Field | Value |
|---|---|
| **Host port** | Not published (Compose network only) |
| **Database** | `inji_mimoto`, user `postgres`, password from `${MIMOTO_DB_PASSWORD}` (generated) |
| **Volume** | `mosip-web-local_mimoto-db-data` |
| **Image / tag / digest** | `postgres:13@sha256:4689940c683801b4ab839ab3b0a0a3555a5fe425371422310944e89eca7d8068` |
| **Status** | `healthy` |

---

## 5. Start/stop commands

Connected JSON-LD (current default for the unified launcher):
```bash
pnpm start:local-full
pnpm smoke:local-full
pnpm demo:web-jsonld
pnpm stop:local-full
```

The alpha reference control and bare wallet shell below are alternative profiles, not commands to run concurrently with the connected profile.

### Core + mocks (mock playground)
```bash
docker compose --profile core --profile mocks up --build -d --wait
docker compose --profile core --profile mocks down          # preserves run history
docker compose --profile core --profile mocks down -v       # WARNING: deletes run history
```

### Official Certify → reference holder → Verify (local control)
```bash
pnpm demo:inji          # starts mosip-mobile-a2 Certify + mosip-local-inji Verify; runs smoke
# Stop only these services (preserves synthetic DBs and generated keys):
pnpm mobile:inji stop
docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml down
```

### Official Inji Web + Mimoto wallet shell
```bash
pnpm stage:web-local    # prepares and starts mosip-web-local
pnpm check:web-local    # verifies login and wallet persistence
# Stop (preserves synthetic wallet DB):
docker compose --env-file "${MIMOTO_RUNTIME_DIR:-/tmp/mosip-web-local}/wallet.env" \
  -p mosip-web-local -f deploy/docker-compose.web-local.yml down
```

---

## 6. Database isolation table

| Component | Database | User | Volume | Port (host) |
|---|---|---|---|---|
| Playground BFF | `playground` | `playground` | `playground-postgres` | `127.0.0.1:55433` |
| Inji Verify | `inji_verify` | `postgres` | `mosip-local-inji_verify-db-data` | Not exposed |
| Inji Certify | `inji_certify` | `postgres` | `mosip-mobile-a2_mobile-postgres` | Not exposed |
| Mimoto | `inji_mimoto` | `postgres` | `mosip-web-local_mimoto-db-data` | Not exposed |

Separate PostgreSQL instances and volumes are used. Official-service databases use the `postgres` superuser within their synthetic instance; they are not separate least-privilege roles.

---

## 7. Synthetic sign-in procedure (Inji Web local profile)

1. Open `http://127.0.0.1:18093/` in a browser.
2. Click **Continue With Google** — this label is overridden in the local profile to point to the local synthetic IdP at `http://127.0.0.1:18095/authorize`.
3. The IdP auto-approves a fixed fake identity and redirects to `http://127.0.0.1:18093/v1/mimoto/oauth2/callback/google`.
4. Inji Web prompts for a new six-digit passcode on first login. Save the passcode locally; it is stored only in the synthetic wallet database volume. `check:web-local` generates its own passcode automatically.
5. Wallet persistence: a second browser session at `http://127.0.0.1:18093/` shows the existing-passcode page and unlocks the same wallet. This proves session storage across connections.

No Google account is used. The synthetic IdP must never be exposed outside loopback.

---

## 8. Capture proxy hook (disabled)

Person 1's capture proxy can be inserted transparently between the browser and these origins **after** the capture contract passes leakage tests. The origins are stable (no path rewriting). At that point, a reverse-proxy entry at `127.0.0.1:18090` → proxy → Certify and `127.0.0.1:18081` → proxy → Verify can be added to `deploy/` without changing issuer identifiers, redirect URIs or signed protocol values. Until Person 1 publishes the contract, this hook is documented only; no proxy traffic is routed.

---

## 9. Hosts-file and TLS requirements

For the connected JSON-LD profile, internal `https://local.test` uses generated TLS trusted only by the service JVM truststore copies. It needs no host hosts-file or system trust modification. Public context URLs still require network access. All services bind to `127.0.0.1`. The Android/mobile route (`pnpm mobile:inji`) requires a temporary HTTPS tunnel (ngrok or similar) because a phone cannot reach Mac/Linux loopback — see `deploy/MOBILE_INJI.md`. That tunnel is external and ephemeral; it is not documented here.

---

## 10. Version and digest provenance

See [`deploy/INJI_LOCAL.md`](INJI_LOCAL.md) and [`deploy/INJI_WEB_LOCAL.md`](INJI_WEB_LOCAL.md) for the full provenance table per component (upstream repo URL, tag/digest, source of configuration, date retrieved, local overrides and reason, port, health check, status). Digest attestation status:

| Component | Tag | Digest attested? |
|---|---|---|
| `injistack/inji-certify-with-plugins` | `1.0.0-alpha.1` | ✅ yes |
| `injistack/inji-verify-service` | `0.18.2` | ✅ yes |
| `injistack/mimoto` | `0.22.0` | ✅ yes |
| `injistack/inji-web` | `0.17.0` | ✅ yes |
| `postgres:13` | `13` | ✅ yes (pinned by digest in Compose files) |
| `postgres:16-alpine` | `16-alpine` | ❌ not yet digest-attested |
| `node:22-alpine` (synthetic IdP) | `22-alpine` | ✅ yes (digest in `docker-compose.web-local.yml`) |
| BFF / Web / mock images | repo builds | n/a (built from source at CI time) |

`mosipid/inji-certify:v0.14.0` and `mosipid/inji-verify:v0.18.2` in `deploy/docker-compose.inji.yml` are the historical unvalidated sketch (marked DO NOT USE AS A DEMO COMMAND) — those are **not** the component versions the proven control uses.

---

*First published:* 2026-10-25. *Evidence tier:* `reference_wallet` for Certify/Verify path; `inji_web` for Web/Mimoto login and wallet persistence; `mock` for playground core/mocks. The later connected JSON-LD wallet journey has [separate evidence](../submission/evidence/2026-10-26-local-web-jsonld/README.md).
