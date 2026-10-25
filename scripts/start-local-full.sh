#!/usr/bin/env bash
# One entry point over the proven local projects; preserves their existing volumes.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
action="${1:-up}"
case "$action" in
  up)
    [ "$#" -le 1 ] || { echo 'Usage: start-local-full.sh [up|down]' >&2; exit 2; }
    exec bash scripts/stage-inji-web-jsonld.sh
    ;;
  down)
    [ "$#" -eq 1 ] || { echo 'Volume deletion is not supported by this wrapper.' >&2; exit 2; }
    export MIMOTO_RUNTIME_DIR="${MIMOTO_RUNTIME_DIR:-$(node -p 'require("node:os").tmpdir() + "/mosip-web-local"')}"
    # Base config is sufficient to stop all members, including the optional bridge.
    if [ -f "$MIMOTO_RUNTIME_DIR/wallet.env" ]; then
      docker compose --env-file "$MIMOTO_RUNTIME_DIR/wallet.env" -p mosip-web-local \
        -f deploy/docker-compose.web-local.yml down --remove-orphans
    fi
    docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml down
    node scripts/mobile-inji.mjs stop
    echo 'Local services stopped; databases and generated keys preserved.'
    ;;
  *) echo 'Usage: start-local-full.sh [up|down]' >&2; exit 2 ;;
esac
