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

Docker `29.8.1` is installed on this host. The exact `pnpm demo:docker` command was **not** rerun from this clone because an existing Docker service occupies the fixed BFF host port `4000`; stopping that service might disrupt another task. The same source passed a clean-checkout six-case Docker matrix and three Chromium checks in [hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583), which uploaded [the sanitized matrix](evidence/2026-10-23-ci-mock-matrix.json). A separate human on another machine should still follow [DEPLOYMENT.md](../DEPLOYMENT.md), run `pnpm demo:docker`, and save the actual result before calling independent-machine setup complete.

No real Inji Certify/Mimoto/Web/Wallet authentication or A1/A2 wallet flow was exercised by these commands.
