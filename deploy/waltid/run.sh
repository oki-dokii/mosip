#!/usr/bin/env bash
set -eu
here=$(cd "$(dirname "$0")" && pwd)
export PLAYGROUND_WALT_RELAY="$here/loopback-relay.mjs"
case "${WALT_EXPERIMENT:-off}" in
  observe|adapt|sd-only|as-alias) export PLAYGROUND_WALT_RELAY="$here/experiment-relay.mjs" ;;
  off) ;;
  *) exit 2 ;;
esac
rev=ef516ecec4c79fd9fba6f1e8b226b52a4e8cf790
src=${WALTID_CHECKOUT:-${TMPDIR:-/tmp}/playground-waltid-$rev}
if [ ! -d "$src/.git" ]; then
  git clone --depth 1 --branch v1.2.0 --filter=blob:none --sparse https://github.com/walt-id/waltid-identity.git "$src"
  git -C "$src" sparse-checkout set docker-compose
fi
test "$(git -C "$src" rev-parse HEAD)" = "$rev"
cd "$src/docker-compose"
cmd=(docker compose -p playground-waltid --profile identity -f docker-compose.yaml -f "$here/compose.override.yml")
case "${1:-up}" in
  up) exec "${cmd[@]}" up -d issuer-api2 verifier-api2 wallet-api2 wallet-loopback ;;
  ps|down|config) exec "${cmd[@]}" "$1" ;;
  *) exit 2 ;;
esac
