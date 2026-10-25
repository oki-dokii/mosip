#!/usr/bin/env bash
# Run a synthetic control across official loopback-only Certify and Verify.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }

compose=(docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml)
"${compose[@]}" up -d --wait

launcher_log="$(mktemp "${TMPDIR:-/tmp}/mosip-local-inji.XXXXXX")"
chmod 600 "$launcher_log"
LOCAL_INJI_ONLY=true node scripts/mobile-inji.mjs >"$launcher_log" 2>&1 &
launcher_pid=$!
cleanup() {
  kill "$launcher_pid" 2>/dev/null || true
  wait "$launcher_pid" 2>/dev/null || true
  rm -f "$launcher_log"
}
trap cleanup EXIT INT TERM

ready=false
for _ in $(seq 1 120); do
  if grep -q 'Official Certify is ready for the separate local Inji Verify smoke' "$launcher_log"; then
    ready=true
    break
  fi
  if ! kill -0 "$launcher_pid" 2>/dev/null; then break; fi
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'Official Certify did not reach local readiness. Check Docker and the private mobile runtime logs.' >&2
  exit 1
fi

node scripts/local-inji-smoke.mjs
echo 'LOCAL INJI DEMO PASS'
echo 'Official Certify and Verify containers remain up. Stop them with the commands in deploy/INJI_LOCAL.md.'
