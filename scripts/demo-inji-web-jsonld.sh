#!/usr/bin/env bash
# Official local credential flow with an explicit synthetic authorization fixture.
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
bash scripts/stage-inji-web-jsonld.sh
node scripts/check-inji-web-local.mjs
node scripts/check-inji-web-jsonld.mjs
node scripts/check-inji-web-presentation.mjs
echo 'LOCAL INJI WEB JSON-LD DEMO PASS'
