# Fresh-checkout rehearsal — 23 October 2026

Source: temporary `git clone --depth 1` of public GitHub `main` at `b0f132d9beb8536cc81bc4d468ef6b970b34a876`, in a new `/tmp` directory on macOS arm64. This reused the host's pnpm cache and Docker installation. It is a **fresh checkout on the same machine**, not a test performed by an independent reviewer or on another host.

| Check | Result |
|---|---|
| Node `v22.17.1`, pnpm `11.25.0` | Available; matches the pinned package manager and Node 22 requirement |
| `CI=true pnpm install --frozen-lockfile` | Passed; Prisma client generated |
| `CI=true pnpm typecheck` | Passed across workspace packages |
| `CI=true pnpm test` | Passed: 339 runnable tests; 3 opt-in PostgreSQL tests skipped |
| `CI=true pnpm build` | Passed; web production bundle built |
| `CI=true pnpm audit:secrets` | Passed; 228 tracked/non-ignored filenames checked |
| `node scripts/build-aggregate-report.mjs --check` | Passed; committed aggregate report reproduces from its source records |
| Tracked-file sensitive-name scan | Only `.env.example` matched; no real `.env`, HAR, Postman export, PEM, key, keystore or student-ID filename found |
| Final `git status --short --branch` | Clean `main` checkout |

Docker `29.8.1` is installed on this host. The exact `pnpm demo:docker` command was **not** rerun from this clone because an existing Docker service occupies the fixed BFF host port `4000`; stopping that service might disrupt another task. The same source passed a clean-checkout six-case Docker matrix and three Chromium checks in [hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583), which uploaded [the sanitized matrix](evidence/2026-10-23-ci-mock-matrix.json). A separate human on another machine should still follow [DEPLOYMENT.md](../docs/DEPLOYMENT.md), run `pnpm demo:docker`, and save the actual result before calling independent-machine setup complete.

No real Inji Certify/Mimoto/Web/Wallet authentication or A1/A2 wallet flow was exercised by these commands.

---

# Independent-machine rehearsal — 02 November 2026

Tester: Harsh Kumar (independent checkout on a new Windows host that had never run the playground before).
Branch: `harsh/clean-checkout-rehearsal`
Source: `git clone https://github.com/oki-dokii/mosip` at commit `d2ec3de787417a9fe54cba96e90eb27485160ad9`.
Host OS & Architecture: Windows 11 (NT 10.0.26300.0) x64.
Node / Package Manager / Docker: Node `v24.11.0`, pnpm `11.25.0` (installed via `npm install -g pnpm@11.25.0`), Docker/Docker Compose: Not installed / unavailable.

### Baseline vs Resolved Results

| Check | Initial Clean Checkout Result | Resolved Result (Windows Compatibility Patched) | Notes |
|---|---|---|---|
| Node `v24.11.0` (pinned engine `>=20`) | Available | Available | Meets Node 20+ requirement |
| Pinned pnpm `11.25.0` | Available | Available | Pinned `pnpm@11.25.0` installed globally via npm |
| `pnpm run doctor` | Failed (`CHECK Pinned pnpm unavailable`, Docker unavailable) | **Passed** | Fixed Windows shell spawn for pnpm `.cmd`; marked optional container checks on non-docker host |
| `pnpm install --frozen-lockfile` | Passed | **Passed** | 517 packages installed; Prisma Client v6.19.0 generated |
| `CI=true pnpm typecheck` | Passed | **Passed** | 0 TypeScript errors across all 5 workspace projects |
| `CI=true pnpm build` | Passed | **Passed** | Built all packages and web bundle (`apps/web/dist`) in 5.53s |
| `CI=true pnpm audit:secrets` | Passed | **Passed** | 597 tracked/non-ignored filenames checked; no leaks found |
| `node scripts/build-aggregate-report.mjs --check` | Failed (`AGGREGATE_OUTPUT_STALE`) | **Passed** | Fixed CRLF (`\r\n`) vs LF (`\n`) normalization in comparison |
| Root tests: `node --test spikes/*.test.mjs scripts/*.test.mjs` | 45 passed, 2 failed | **47 passed, 0 failed** | Fixed `new URL(...).pathname` to `fileURLToPath` and loopback child process binding |
| Unit tests: `@playground/shared` | 3 passed | **3 passed, 0 failed** | 100% pass |
| Unit tests: `@playground/mock-issuer` | 10 passed, 1 failed (`openssl ENOENT`) | **11 passed, 0 failed** | Resolved Git OpenSSL binary path and cleaned `OPENSSL_CONF` |
| Unit tests: `@playground/mock-verifier` | 44 passed, 27 failed | **71 passed, 0 failed** | Resolved Git OpenSSL binary path and cleaned `OPENSSL_CONF` |
| Unit tests: `@playground/bff` | 221 passed, 5 skipped, 3 failed | **224 passed, 5 skipped, 0 failed** | Fixed NTFS file permission checks (`mode & 0o777 === 0o600`) |
| Unit tests: `@playground/web` | 99 passed, 1 failed | **100 passed, 0 failed** | Fixed NTFS file permission check (`mode & 0o077`) in profile reader |
| Monorepo suite: `CI=true pnpm test` | Failed | **456 passed, 5 skipped, 0 failed** | All 456 automated runnable tests across all packages pass |
| `pnpm demo:docker` | Failed (WSL bash access denied) | Handled with clear diagnostic | Added cross-platform Node runner `scripts/demo-docker.mjs`: cleanly reports `Docker daemon is unavailable. Start Docker Desktop or set DOCKER_CONTEXT.` |

No credentials or personal IDs were committed or logged during this rehearsal.

