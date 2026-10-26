// Recreate only the local canonical bridge to activate its private capture mount.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const mobile = process.env.MOBILE_RUNTIME_DIR ?? join(tmpdir(), 'mosip-mobile-inji');
const settings = JSON.parse(readFileSync(join(mobile, 'settings.json'), 'utf8'));
const capture = JSON.parse(readFileSync(join(runtime, 'capture/settings.json'), 'utf8'));
const port = new URL(capture.bffOrigin).port;
const response = await fetch(`http://127.0.0.1:${port}/api/v1/capture/local/session`, { headers: { 'x-capture-bridge-token': capture.token }, signal: AbortSignal.timeout(5000) });
if (!response.ok) throw new Error('LOCAL_CAPTURE_BFF_NOT_READY');
execFileSync('docker', ['compose', '--env-file', join(runtime, 'wallet.env'), '-p', 'mosip-web-local',
  '-f', 'deploy/docker-compose.web-local.yml', '-f', 'deploy/docker-compose.web-jsonld.yml',
  'up', '-d', '--no-deps', '--force-recreate', 'local-issuer-bridge'], {
  env: { ...process.env, MIMOTO_RUNTIME_DIR: runtime, MOBILE_DB_PASSWORD: settings.databasePassword }, stdio: 'inherit',
});
console.log('LOCAL CANONICAL CAPTURE ATTACHED');
