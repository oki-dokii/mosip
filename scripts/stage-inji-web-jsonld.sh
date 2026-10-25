#!/usr/bin/env bash
# Bring the already proven local official services and the synthetic Web adapter together.
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
export MOBILE_RUNTIME_DIR="${MOBILE_RUNTIME_DIR:-$(node -p 'require("node:os").tmpdir() + "/mosip-mobile-inji"')}"
export MIMOTO_RUNTIME_DIR="${MIMOTO_RUNTIME_DIR:-$(node -p 'require("node:os").tmpdir() + "/mosip-web-local"')}"
export LOCAL_INJI_ONLY=true
docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml \
  up -d --force-recreate --wait verify-service
bash scripts/demo-inji-local.sh
node scripts/seed-local-jsonld.mjs
node scripts/check-local-jsonld.mjs
node scripts/configure-local-csv-issuer.mjs
export LOCAL_WEB_JSONLD_ENABLED=true
node scripts/prepare-inji-web-local.mjs
node scripts/prepare-local-did-tls.mjs
docker compose -p mosip-local-inji -f deploy/docker-compose.verify-local.yml \
  -f deploy/docker-compose.verify-web-jsonld.yml up -d --force-recreate --wait verify-service
export MOBILE_DB_PASSWORD="$(node --input-type=module -e 'import {readFileSync} from "node:fs"; import {join} from "node:path"; const p=JSON.parse(readFileSync(join(process.env.MOBILE_RUNTIME_DIR, "settings.json"),"utf8")); process.stdout.write(p.databasePassword)')"
docker compose --env-file "$MIMOTO_RUNTIME_DIR/wallet.env" -p mosip-web-local \
  -f deploy/docker-compose.web-local.yml -f deploy/docker-compose.web-jsonld.yml \
  up -d --build --force-recreate --wait mimoto-service local-issuer-bridge inji-web

node --input-type=module <<'NODE'
const check = async (name, url, predicate) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const json = await response.json();
  if (response.status !== 200 || !predicate(json)) throw new Error(`${name}: NOT_READY`);
};
await check('Synthetic auth bridge', 'http://127.0.0.1:18096/.well-known/oauth-authorization-server',
  body => body.grant_types_supported?.includes('authorization_code'));
await check('Mimoto local issuer', 'http://127.0.0.1:18093/v1/mimoto/issuers',
  body => JSON.stringify(body).includes('LocalFarmer'));
await check('Mimoto parsed credential configuration',
  'http://127.0.0.1:18093/v1/mimoto/issuers/LocalFarmer/configuration',
  body => (body.errors?.length ?? 0) === 0 &&
    Object.keys(body.response?.credentials_supported ?? {}).length > 0);
console.log('LOCAL WEB JSON-LD ISSUER CATALOG READY http://127.0.0.1:18093/');
console.log('This confirms catalogue wiring, not wallet issuance/presentation.');
NODE
