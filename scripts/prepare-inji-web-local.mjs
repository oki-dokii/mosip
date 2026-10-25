// Prepare a synthetic, local-only Mimoto/Web startup profile from pinned official files.
// Raw upstream configuration, generated keys, and passwords stay in owner-only temp storage.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const commit = 'a9f4f829d3070be34ae11649327ea1561e123a2b';
const runtime = resolve(process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local'));
const repoRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const upstreamDir = process.env.UPSTREAM_INJI_WEB_DIR;
const xsdCommit = '9f995c06228a1b9b718c00bf54caef5dbd77aacf';
const xsdSha256 = '76fc2162fc2caed939d5de8879a11d3d36e66b16ffb21b020817812c49a07a3b';
const files = {
  'mimoto_init.sql': ['docker-compose/mimoto_init.sql', '26e70f5f51b83309a95f5a04b002e757794cf8c62001e85628cf942a64bc62cd'],
  'mimoto-default.properties': ['docker-compose/config/mimoto-default.properties', '825622fac9ef681d175eb2fb2035bf79258e0df55ee5dcf3fbd127af988af768'],
  'mimoto-bootstrap.properties': ['docker-compose/config/mimoto-bootstrap.properties', 'c62c1272295d71db0f4472b4b1ac16e003235676cf44c63d62c4230f7fc54aad'],
  'credential-template.html': ['docker-compose/config/credential-template.html', '986e00fd070ebcc5d51ce057d860486d612908ef20b1f75ca2a3b0982bac6244'],
};

function assert(ok, code) { if (!ok) throw new Error(code); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function pinnedFile(name) {
  const [path, expected] = files[name];
  const cache = join(runtime, 'upstream', name);
  let bytes;
  if (await exists(cache)) bytes = await readFile(cache);
  else if (upstreamDir) bytes = await readFile(join(upstreamDir, path));
  else {
    const response = await fetch(`https://raw.githubusercontent.com/inji/inji-web/${commit}/${path}`, { signal: AbortSignal.timeout(30_000) });
    assert(response.ok, 'UPSTREAM_FETCH_FAILED');
    bytes = Buffer.from(await response.arrayBuffer());
  }
  assert(sha256(bytes) === expected, 'UPSTREAM_HASH_MISMATCH');
  if (!(await exists(cache))) await writeFile(cache, bytes, { mode: 0o600 });
  return bytes.toString('utf8');
}
async function pinnedXsd() {
  const cache = join(runtime, 'upstream', 'mosip-cbeff.xsd');
  let bytes;
  if (await exists(cache)) bytes = await readFile(cache);
  else if (process.env.UPSTREAM_CBEFF_XSD_FILE) bytes = await readFile(process.env.UPSTREAM_CBEFF_XSD_FILE);
  else {
    const url = `https://raw.githubusercontent.com/mosip/mosip-config/${xsdCommit}/mosip-cbeff.xsd`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    assert(response.ok, 'XSD_FETCH_FAILED');
    bytes = Buffer.from(await response.arrayBuffer());
  }
  assert(sha256(bytes) === xsdSha256, 'XSD_HASH_MISMATCH');
  if (!(await exists(cache))) await writeFile(cache, bytes, { mode: 0o600 });
  return bytes;
}
function setProperty(source, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = new RegExp(`^${escaped}=.*$`, 'm');
  assert(line.test(source), 'UPSTREAM_PROPERTY_MISSING');
  return source.replace(line, `${key}=${value}`);
}
async function credentials() {
  const path = join(runtime, 'wallet.env');
  if (await exists(path)) return;
  const env = {
    MIMOTO_RUNTIME_DIR: runtime,
    MIMOTO_DB_PASSWORD: randomBytes(24).toString('base64url'),
    MIMOTO_OIDC_P12_PASSWORD: randomBytes(24).toString('base64url'),
    MIMOTO_GOOGLE_CLIENT_SECRET: randomBytes(24).toString('base64url'),
  };
  await writeFile(path, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
}
async function keystore() {
  const p12 = join(runtime, 'oidckeystore.p12');
  if (await exists(p12)) return;
  const env = Object.fromEntries((await readFile(join(runtime, 'wallet.env'), 'utf8')).trim().split('\n').map(line => line.split(/=(.*)/s).slice(0, 2)));
  const key = join(runtime, 'oidc-key.pem');
  const cert = join(runtime, 'oidc-cert.pem');
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
      '-subj', '/CN=local-synthetic-mimoto', '-days', '7'], { stdio: 'ignore' });
    execFileSync('openssl', ['pkcs12', '-export', '-inkey', key, '-in', cert, '-out', p12,
      '-name', 'local-synthetic', '-passout', `pass:${env.MIMOTO_OIDC_P12_PASSWORD}`], { stdio: 'ignore' });
    await chmod(p12, 0o600);
  } finally {
    await Promise.all([unlink(key).catch(() => {}), unlink(cert).catch(() => {})]);
  }
}

async function main() {
  assert(runtime !== repoRoot && !runtime.startsWith(repoRoot + sep), 'RUNTIME_IN_REPO_FORBIDDEN');
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  const actualRuntime = await realpath(runtime);
  assert(actualRuntime !== repoRoot && !actualRuntime.startsWith(repoRoot + sep), 'RUNTIME_IN_REPO_FORBIDDEN');
  await chmod(runtime, 0o700);
  await mkdir(join(runtime, 'upstream'), { recursive: true, mode: 0o700 });
  await credentials();
  await keystore();
  await writeFile(join(runtime, 'mimoto_init.sql'), await pinnedFile('mimoto_init.sql'), { mode: 0o600 });
  await writeFile(join(runtime, 'credential-template.html'), await pinnedFile('credential-template.html'), { mode: 0o600 });
  await writeFile(join(runtime, 'mosip-cbeff.xsd'), await pinnedXsd(), { mode: 0o600 });
  let properties = await pinnedFile('mimoto-default.properties');
  properties = properties.replace(/https?:\/\/[A-Za-z0-9.-]*collab\.mosip\.net/gi, 'http://unavailable.invalid');
  const overrides = {
    'mosip.api.public.url': 'http://127.0.0.1:18093',
    'mosip.inji.web.url': 'http://127.0.0.1:18093',
    'mosip.data.share.url': 'http://unavailable.invalid',
    'mosip.kernel.xsdstorage-uri': 'http://inji-web:3004/',
    'spring.security.oauth2.client.registration.google.redirect-uri': 'http://127.0.0.1:18093/v1/mimoto/oauth2/callback/google',
    'spring.security.oauth2.client.provider.google.authorization-uri': 'http://127.0.0.1:18095/authorize',
    'spring.security.oauth2.client.provider.google.token-uri': 'http://synthetic-idp:8080/token',
    'spring.security.oauth2.client.provider.google.user-info-uri': 'http://synthetic-idp:8080/userinfo',
    'spring.security.oauth2.client.provider.google.jwk-set-uri': 'http://synthetic-idp:8080/jwks',
  };
  for (const [key, value] of Object.entries(overrides)) properties = setProperty(properties, key, value);
  properties += '\nmanagement.health.redis.enabled=false\n';
  assert(!properties.includes('collab.mosip.net'), 'REMOTE_COLLAB_URL_REMAINS');
  await writeFile(join(runtime, 'mimoto-default.properties'), properties, { mode: 0o600 });
  await writeFile(join(runtime, 'mimoto-bootstrap.properties'), await pinnedFile('mimoto-bootstrap.properties'), { mode: 0o600 });
  const localJsonLd = process.env.LOCAL_WEB_JSONLD_ENABLED === 'true';
  const issuers = localJsonLd ? [{
    issuer_id: 'LocalFarmer', protocol: 'OpenId4VCI',
    display: [{ name: 'Playground Synthetic Farmer', title: 'Synthetic Farmer Credential',
      description: 'Locally issued test credential', language: 'en',
      logo: { url: 'http://127.0.0.1:18093/favicon.ico', alt_text: 'Synthetic issuer' } }],
    client_id: 'local-jsonld-web', client_alias: 'local-synthetic',
    token_endpoint: 'http://127.0.0.1:18093/v1/mimoto/get-token/LocalFarmer',
    qr_code_type: 'EmbeddedVC', enabled: 'true',
    credential_issuer_host: 'http://127.0.0.1:18090',
    wellknown_endpoint: 'http://127.0.0.1:18090/.well-known/openid-credential-issuer',
    redirect_uri: 'http://127.0.0.1:18093/redirect',
    authorization_audience: 'http://127.0.0.1:18096/token',
    proxy_token_endpoint: 'http://127.0.0.1:18096/token',
    credential_issuer: 'LocalFarmer',
  }] : [];
  const verifiers = localJsonLd ? [{ client_id: 'did:web:local.test:verify',
    redirect_uris: ['http://127.0.0.1:18081/'],
    response_uris: ['http://127.0.0.1:18081/v1/verify/vp-submission/direct-post'],
  }] : [];
  await writeFile(join(runtime, 'mimoto-issuers-config.json'), JSON.stringify({ issuers }) + '\n', { mode: 0o600 });
  await writeFile(join(runtime, 'mimoto-trusted-verifiers.json'), JSON.stringify({ verifiers }) + '\n', { mode: 0o600 });
  console.log(`Prepared pinned synthetic Mimoto/Web startup files in ${runtime}`);
  console.log(`Compose environment: ${join(runtime, 'wallet.env')}`);
}

main().catch(error => {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'WEB_LOCAL_PREPARATION_FAILED');
  process.exitCode = 1;
});
