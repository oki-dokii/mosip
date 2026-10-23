#!/usr/bin/env bash
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  if docker --context desktop-linux info >/dev/null 2>&1; then
    export DOCKER_CONTEXT=desktop-linux
  else
    echo 'Docker daemon is unavailable. Start Docker Desktop or set DOCKER_CONTEXT.' >&2
    exit 1
  fi
fi

export PLAYGROUND_DRIVER_MODE=collab
export MOCK_ISSUER_BASE_URL=http://mock-issuer:4101
export MOCK_VERIFIER_BASE_URL=http://mock-verifier:4102
export MOCK_ISSUER_ENABLE_TEST_CASES=true

docker compose --profile core --profile mocks up -d --build --wait
node scripts/compose-smoke.mjs

echo "DEMO PASS — open http://localhost:${PLAYGROUND_WEB_PORT:-5174}"
