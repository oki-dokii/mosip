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

| Check | Result | Notes |
|---|---|---|
| Node `v24.11.0` (pinned engine `>=20`) | Available | Meets Node 20+ requirement |
| Pinned pnpm `11.25.0` | Available | Pinned `pnpm@11.25.0` installed globally via npm |
| `pnpm run doctor` | Failed (`CHECK Pinned pnpm unavailable`, Docker unavailable) | On Windows, `spawnSync('pnpm', ...)` in `doctor.mjs` returns `ENOENT` without `.cmd` / `shell: true`. Docker daemon & compose unavailable on host |
| `pnpm install --frozen-lockfile` | Passed | Packages installed (517 packages) and Prisma Client v6.19.0 generated in 1m |
| `CI=true pnpm typecheck` | Passed | 0 TypeScript errors across all workspace packages (`@playground/shared`, `@playground/mock-issuer`, `@playground/mock-verifier`, `@playground/web`, `@playground/bff`) |
| `CI=true pnpm build` | Passed | Built all packages and generated Vite production bundle (`apps/web/dist`) in 5.53s |
| `CI=true pnpm audit:secrets` | Passed | 597 tracked/non-ignored filenames checked; no leaks found |
| `node scripts/build-aggregate-report.mjs --check` | Blocked by CRLF checkout (`AGGREGATE_OUTPUT_STALE`) | Exact byte match when git CRLF is normalized to LF (`\r\n` vs `\n`) |
| Unit tests: `@playground/shared` | Passed | 3/3 tests passed |
| Unit tests: `@playground/bff` | 221 passed, 5 skipped, 3 failed | All 3 failures due to POSIX mode checks (`stat.mode & 0o777 === 0o600`), which evaluate to `0o666` (438) on Windows NTFS |
| Unit tests: `@playground/web` | 99 passed, 1 failed | Failed test `browser/local/profile.test.ts` due to POSIX mode check `(info.mode & 0o077) !== 0` on Windows |
| Root tests: `node --test spikes/*.test.mjs scripts/*.test.mjs` | 45 passed, 2 failed | 1 failed due to `new URL(...).pathname` resolving to `/C:/Users/...` (causes `MODULE_NOT_FOUND` on Windows `execFileSync`); 1 failed due to child process loopback binding in test |
| `pnpm demo:docker` | Blocked | Docker is not installed on this host; `bash scripts/demo-docker.sh` invokes WSL bash returning access denied on systems without configured WSL |

No credentials or personal IDs were committed or logged during this rehearsal.

