# Local playground deployment

The container bundle packages **this playground**, PostgreSQL, and two independent test services. It does not yet include local Inji Certify, Mimoto, Inji Web, or Inji Verify. The one-command path uses synthetic data and proves a cross-container mock interoperability flow, not an all-Inji flow.

## One command

Requires Docker Desktop/Engine with Compose, Node.js 20+, and pnpm 11. From a fresh checkout:

```bash
pnpm install
pnpm demo:docker
```

The script finds a working Docker context (including Docker Desktop's `desktop-linux` context on macOS), builds the images, starts and waits for the five services, and runs two synthetic **standalone mock issuer → Reference Wallet → standalone mock verifier** SD-JWT journeys through the browser-facing API. It requires a valid baseline and an invalid corrupted-signature result, each with ten steps, saved exchanges, and `mock_interop` provenance before printing `DEMO PASS`. It leaves the stack up at **http://localhost:5174**.

On 2026-10-21, this path passed on Docker Desktop 29.9.2 with the BFF storing its run in PostgreSQL. A BFF restart preserved an earlier fixture run. A separate clean-machine rehearsal is still needed before calling A6 fully signed off.

The [CI workflow](.github/workflows/ci.yml) runs typecheck, tests, and build on pushes and pull requests. It also runs this two-cell synthetic container matrix on pushes, pull requests, and a daily schedule, uploading a sanitized JSON summary. This is **mock evidence**, not a nightly live-Inji matrix. The workflow needs a successful hosted run before its status can be called green.

| Service | Container address | Host address | Role |
|---|---|---|---|
| Web / nginx | `web:80` | `127.0.0.1:5174` | Static React app, API and Socket.IO reverse proxy |
| BFF | `bff:4000` | `127.0.0.1:4000` | Run orchestration, migrations, reports |
| PostgreSQL | `postgres:5432` | `127.0.0.1:55433` | Durable run, step, exchange store |
| Mock issuer | `mock-issuer:4101` | Not published | Synthetic OpenID4VCI SD-JWT issuer |
| Mock verifier | `mock-verifier:4102` | Not published | Synthetic OpenID4VP SD-JWT verifier |

The host web and database ports default to 5174 and 55433 to avoid other local projects using 5173, 5432, or 5433. Override them with `PLAYGROUND_WEB_PORT` or `PLAYGROUND_POSTGRES_PORT` before running the command. All published ports bind to loopback. The mock services are reachable only on the Compose network.

## Manual profiles

For fixture-mode UI and PostgreSQL without external mocks:

```bash
docker compose --profile core up -d --build --wait
```

For the independent mock services, the BFF must use the Collab driver with local mock URLs:

```bash
export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
docker compose --profile core --profile mocks up -d --build --wait
node scripts/compose-smoke.mjs
```

These values use Compose DNS names; do not set them to `127.0.0.1` inside the BFF container. The default mock issuer signs with an in-memory `did:jwk` key. The standalone mock verifier checks signatures and holder binding but does not provide production trust-anchor validation. External Collab combinations need separate test credentials and endpoint configuration; the demo command does not request or embed them.

Inspect status with `docker compose --profile core --profile mocks ps`. Stop containers without deleting saved runs with:

```bash
docker compose --profile core --profile mocks down
```

To reset the synthetic PostgreSQL volume deliberately, use `docker compose --profile core --profile mocks down -v`. This deletes all stored runs. Docker image build requires internet access on the first run for base images and pinned pnpm packages; later builds benefit from cache.

## Health and failure behavior

PostgreSQL uses `pg_isready`; the BFF health probe calls `/api/v1/health`; nginx serves `/`; the mock issuer checks discovery and the mock verifier checks its TCP listener. The BFF applies Prisma migrations before starting HTTP, and `depends_on` waits for PostgreSQL health. If the smoke command fails, it exits nonzero and does not print `DEMO PASS`. Read `docker compose logs bff` or the affected service logs. The host health URL is `http://localhost:5174/api/v1/health`.

The official upstream local Inji stack remains a separate integration milestone. Its Web path requires OIDC client/keystore and sign-in configuration, and the tested upstream bundled Compose example has Verify commented out. See [the catch-up plan](CATCH_UP.md) and [wallet validation gate](WALLET_VALIDATION.md). Do not claim an A1/A2 real-wallet pass from this mock bundle.
