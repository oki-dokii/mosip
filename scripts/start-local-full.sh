#!/usr/bin/env bash
# Setup and start/stop the unified local Inji profile (Verify + Web/Mimoto).
# Certify is started separately by pnpm mobile:inji or pnpm demo:inji.
#
# Usage:
#   bash scripts/start-local-full.sh [up|down] [extra-docker-compose-args...]
#
# The script:
#   1. Generates Mimoto secrets and keystore if not already done (idempotent).
#   2. Starts the unified project with a dedicated name (mosip-local-full).
#   3. Waits for all services to become healthy.
#
# To also start Certify, run separately:
#   pnpm demo:inji          (full smoke including Certify)
#   OR: pnpm mobile:inji start   (Certify only, for the mobile/local route)
#
# Evidence boundary:
#   Starting these services proves infrastructure health, not an end-to-end
#   issuance + presentation journey. See deploy/INJI_WEB_LOCAL.md.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }

action="${1:-up}"
shift || true

# ── Resolve Mimoto runtime directory ─────────────────────────────────────────
temp_parent="${TMPDIR:-/tmp}"
export MIMOTO_RUNTIME_DIR="${MIMOTO_RUNTIME_DIR:-${temp_parent%/}/mosip-web-local}"

PROJECT_NAME="mosip-local-full"
COMPOSE_FILE="deploy/docker-compose.local-full.yml"
ENV_FILE="$MIMOTO_RUNTIME_DIR/wallet.env"

if [ "$action" = "down" ]; then
  if [ -f "$ENV_FILE" ]; then
    docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down "$@"
  else
    docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" down "$@" 2>/dev/null || true
  fi
  echo "mosip-local-full project stopped."
  exit 0
fi

# ── One-time setup: generate Mimoto secrets and keystore ─────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "Generating Mimoto secrets and keystore (first-time setup)..."
  node scripts/prepare-inji-web-local.mjs
else
  echo "Using existing Mimoto runtime at $MIMOTO_RUNTIME_DIR"
fi

echo "Starting unified local profile (project: $PROJECT_NAME)..."
echo "  Compose: $COMPOSE_FILE"
echo "  Env:     $ENV_FILE"
echo ""
echo "Port layout (all bound to 127.0.0.1):"
echo "  18081  Inji Verify service"
echo "  18093  Inji Web (nginx frontend + Mimoto reverse proxy)"
echo "  18095  Synthetic OAuth2 IdP"
echo "  18099  Mimoto wallet BFF"
echo "  18090  Inji Certify (separate project; start with pnpm demo:inji)"
echo ""

docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --wait "$@"

echo ""
echo "── Unified local profile running ───────────────────────────────────────────"
docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps
echo ""
echo "Inji Web (login + wallet persistence): http://127.0.0.1:18093/"
echo "  Synthetic sign-in: click 'Continue With Google' (no Google account used)"
echo "  Inji Verify API:   http://127.0.0.1:18081/v1/verify"
echo ""
echo "To also start Inji Certify:"
echo "  pnpm demo:inji          (full Certify + Verify smoke run)"
echo ""
echo "To stop this profile (preserves synthetic DBs and generated keys):"
echo "  bash scripts/start-local-full.sh down"
echo ""
echo "Evidence boundary: login and wallet persistence are proven."
echo "Local issuance and presentation are not yet configured."
