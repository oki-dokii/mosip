// Private settings for one synthetic local operator. Never print generated secrets.
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, chmod, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const directory = join(runtime, 'capture');
await mkdir(directory, { recursive: true, mode: 0o700 });
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const actual = await realpath(directory);
if (actual === root || actual.startsWith(root + sep)) throw new Error('LOCAL_CAPTURE_RUNTIME_MUST_BE_EXTERNAL');
const port = Number(process.env.LOCAL_CAPTURE_BFF_PORT ?? 4500);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('LOCAL_CAPTURE_PORT_INVALID');
execFileSync('pnpm', ['--filter', '@playground/bff', 'build'], { stdio: 'ignore' });
let previous;
try { previous = JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('LOCAL_CAPTURE_SETTINGS_INVALID'); }
const token = previous?.token ?? randomBytes(32).toString('hex');
if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('LOCAL_CAPTURE_TOKEN_INVALID');
await copyFile(new URL('../apps/bff/dist/capture/public-view.js', import.meta.url), join(directory, 'public-view.mjs'));
await writeFile(join(directory, 'settings.json'), JSON.stringify({ bffOrigin: `http://host.docker.internal:${port}`, token }), { mode: 0o600 });
await writeFile(join(directory, 'bff.json'), JSON.stringify({ PORT: String(port),
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://playground:playground@127.0.0.1:55433/playground?schema=public',
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:5173', PLAYGROUND_DRIVER_MODE: 'collab',
  ASSISTED_LOCAL_PROFILE: 'jsonld-0.14', ASSISTED_LIVE_ENABLED: 'true', CAPTURE_BRIDGE_TOKEN: token,
  CERTIFY_BASE_URL: 'http://127.0.0.1:18090/v1/certify', VERIFY_BASE_URL: 'http://127.0.0.1:18081/v1/verify',
  ASSISTED_WALLET_URL: 'http://127.0.0.1:18093/', ASSISTED_OFFER_URL: 'http://127.0.0.1:18093/issuers/LocalFarmer',
  CERTIFY_VERSION_LABEL: '0.14.0', VERIFY_VERSION_LABEL: '0.18.2', INJI_WEB_VERSION_LABEL: '0.17.0',
  CAPTURE_ORIGINS_JSON: JSON.stringify({ 'http://127.0.0.1:18093': 'mimoto', 'http://127.0.0.1:18090': 'certify', 'https://local.test': 'verify', 'http://127.0.0.1:18081': 'verify' }),
}) + '\n', { mode: 0o600 });
for (const name of ['settings.json', 'bff.json']) await chmod(join(directory, name), 0o600);
await writeFile(join(directory, '.gitignore'), '*\n!.gitignore\n', { mode: 0o600 });
console.log('LOCAL CAPTURE CONFIG READY (private runtime files only)');
console.log('Start pnpm capture:local, then restart the local-issuer-bridge container.');
