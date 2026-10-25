#!/usr/bin/env bash
# Start a pinned local Inji Web + Mimoto wallet shell with synthetic sign-in.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }

temp_parent="${TMPDIR:-/tmp}"
export MIMOTO_RUNTIME_DIR="${MIMOTO_RUNTIME_DIR:-${temp_parent%/}/mosip-web-local}"
node scripts/prepare-inji-web-local.mjs
docker compose --env-file "$MIMOTO_RUNTIME_DIR/wallet.env" \
  -p mosip-web-local -f deploy/docker-compose.web-local.yml up -d --wait

node --input-type=module <<'NODE'
for (const [name, url] of [
  ['Inji Web', 'http://127.0.0.1:18093/'],
  ['Mimoto issuer catalog', 'http://127.0.0.1:18093/v1/mimoto/issuers'],
  ['synthetic IdP', 'http://127.0.0.1:18095/health'],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${name} readiness failed: HTTP ${response.status}`);
}
console.log('LOCAL INJI WEB WALLET SHELL READY http://127.0.0.1:18093/');
console.log('Synthetic sign-in and wallet persistence are available; local issuance/presentation are not configured.');
NODE
