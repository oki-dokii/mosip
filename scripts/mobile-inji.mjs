// Controlled real-Certify mobile setup. Raw credentials/codes remain in memory.
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, generateKeyPairSync, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod, open } from 'node:fs/promises';
import { tmpdir, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { SignJWT, exportJWK, decodeJwt, decodeProtectedHeader, importX509, jwtVerify } from 'jose';

const root = fileURLToPath(new URL('..', import.meta.url));
const runtime = resolve(process.env.MOBILE_RUNTIME_DIR ?? join(tmpdir(), 'mosip-mobile-inji'));
const port = Number(process.env.MOBILE_CONSOLE_PORT ?? 8060);
const backend = 'http://127.0.0.1:18090';
const verify = 'https://injiverify.collab.mosip.net/v1/verify';
const localOnly = process.env.LOCAL_INJI_ONLY === 'true';
const source = '8fdf71656979a72fa8263766d4dec3cc25127b76';
const configId = 'MockVerifiableCredential_SD_JWT';
const files = 'https://raw.githubusercontent.com/inji/inji-certify/' + source + '/docker-compose/docker-compose-injistack/';
const state = { phase: 'starting', issuer: null, offer: null, presentation: null, control: null, result: null };
let settings, server, tunnel;
const processes = new Set();
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const hash = (value) => createHash('sha256').update(value).digest('base64url');
const fail = (code) => { throw new Error(code); };
const sql = (s) => "'" + String(s).replaceAll("'", "''") + "'";

async function bounded(url, options = {}, limit = 2_097_152) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  let size = 0; const chunks = [];
  for await (const c of response.body ?? []) { size += c.length; if (size > limit) fail('RESPONSE_LIMIT'); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  let body; try { body = JSON.parse(raw); } catch { body = raw; }
  return { status: response.status, body, raw };
}
function post(body) { return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }; }
async function save(name, value) {
  await writeFile(join(runtime, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await chmod(join(runtime, name), 0o600);
}
const composeProject = process.env.MOBILE_COMPOSE_PROJECT ?? 'mosip-mobile-a2';
if (!/^[a-z][a-z0-9-]{0,40}$/.test(composeProject)) throw new Error('INVALID_COMPOSE_PROJECT');
function dockerArgs(args) { return ['compose', '-p', composeProject, '-f', join(root, 'deploy/docker-compose.mobile.yml'), ...args]; }
function dockerEnvironment() { return { ...process.env, MOBILE_RUNTIME_DIR: runtime, MOBILE_DB_PASSWORD: settings.databasePassword }; }
async function runDocker(args, capture = false, input) {
  return new Promise((done, reject) => {
    const child = spawn('docker', dockerArgs(args), { cwd: root, env: dockerEnvironment(), stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    processes.add(child); const out = [], err = []; let length = 0;
    child.stdout.on('data', c => { length += c.length; if (length < 2_000_000) out.push(c); });
    child.stderr.on('data', c => { length += c.length; if (length < 2_000_000) err.push(c); });
    if (input) child.stdin.end(input);
    child.on('error', () => { processes.delete(child); reject(new Error('DOCKER_UNAVAILABLE')); });
    child.on('close', async (code) => {
      processes.delete(child);
      if (code) { await save('docker-last-error.log', Buffer.concat(err).toString()); reject(new Error('DOCKER_COMMAND_FAILED')); }
      else done(capture ? Buffer.concat(out).toString() : undefined);
    });
  });
}
async function prepare() {
  if (runtime === resolve(root) || (runtime.startsWith(resolve(root) + '/') && runtime !== join(resolve(root), '.mobile-inji'))) fail('RUNTIME_MUST_BE_OUTSIDE_GIT_OR_IN_MOBILE_INJI');
  await mkdir(runtime, { recursive: true, mode: 0o700 }); await chmod(runtime, 0o700);
  await mkdir(join(runtime, 'keys'), { recursive: true, mode: 0o700 });
  try { settings = JSON.parse(await readFile(join(runtime, 'settings.json'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') fail('RUNTIME_STATE_INVALID');
    settings = { databasePassword: randomBytes(24).toString('hex'), keystorePassword: randomBytes(24).toString('hex') };
    await save('settings.json', settings);
  }
}
async function obtainTunnel() {
  let binary = process.env.MOBILE_TUNNEL_BIN;
  if (!binary) {
    if (platform() !== 'darwin' || arch() !== 'arm64') fail('SET_MOBILE_TUNNEL_BIN_FOR_THIS_PLATFORM');
    binary = join(runtime, 'cloudflared');
    try { await readFile(binary); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // Download the pinned official binary; extract with the OS tar utility.
      const archive = await fetch('https://github.com/cloudflare/cloudflared/releases/download/2026.10.3/cloudflared-darwin-arm64.tgz', { signal: AbortSignal.timeout(60_000) });
      if (!archive.ok) fail('TUNNEL_DOWNLOAD_FAILED');
      const bytes = Buffer.from(await archive.arrayBuffer());
      if (bytes.length > 60_000_000 || createHash('sha256').update(bytes).digest('hex') !== '1165d14b6f6360a3b8c283d7d1100024d6ec7cd9bc9e32519e96150645f3ec55') fail('TUNNEL_DIGEST_MISMATCH');
      await writeFile(join(runtime, 'cloudflared.tgz'), bytes, { mode: 0o600 });
      execFileSync('tar', ['-xzf', join(runtime, 'cloudflared.tgz'), '-C', runtime, 'cloudflared'], { stdio: 'ignore' });
      await chmod(binary, 0o700);
    }
  }
  const log = await open(join(runtime, 'tunnel.log'), 'w', 0o600);
  return new Promise((done, reject) => {
    let reported = false, text = '';
    tunnel = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => reject(new Error('TUNNEL_START_TIMEOUT')), 90_000);
    const receive = c => {
      void log.write(c); text = (text + c.toString()).slice(-20_000);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !reported) { reported = true; clearTimeout(timer); done(match[0]); }
    };
    tunnel.stdout.on('data', receive); tunnel.stderr.on('data', receive);
    tunnel.on('error', () => { clearTimeout(timer); reject(new Error('TUNNEL_UNAVAILABLE')); });
    tunnel.on('close', () => { void log.close(); if (!reported) { clearTimeout(timer); reject(new Error('TUNNEL_STOPPED')); } else if (state.phase !== 'stopped') { state.phase = 'tunnel_stopped'; state.offer = null; state.presentation = null; } });
  });
}
async function configure(issuer) {
  const hostname = new URL(issuer).hostname;
  if (!(/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(issuer) || (localOnly && issuer === backend))) fail('INVALID_PUBLIC_ORIGIN');
  const [properties, schema] = await Promise.all(['config/certify-default.properties', 'certify_init.sql'].map(p => bounded(files + p)));
  if (properties.status !== 200 || schema.status !== 200) fail('UPSTREAM_CONFIG_UNAVAILABLE');
  const first = schema.raw.indexOf('INSERT INTO certify.credential_config');
  const policies = schema.raw.indexOf('INSERT INTO certify.key_policy_def', first);
  if (first < 0 || policies < first) fail('UPSTREAM_SCHEMA_CHANGED');
  // Dedicated database only: retain upstream schema/policies, replace sample VC seed.
  const bootstrap = schema.raw.slice(0, first) + schema.raw.slice(policies);
  const template = Buffer.from(JSON.stringify({ given_name: '${given_name}', family_name: '${family_name}', iat: 'ISSUED_AT', exp: 'EXPIRES_AT' }).replace('"ISSUED_AT"', '$issuedAt').replace('"EXPIRES_AT"', '$expiresAt')).toString('base64');
  const display = JSON.stringify([{ name: 'Playground SD-JWT Identity', locale: 'en', background_color: '#252145', text_color: '#FFFFFF' }]);
  const claims = Object.fromEntries(['given_name', 'family_name', 'issuedAt', 'expiresAt'].map(name => [name, { mandatory: true, display: [{ name, locale: 'en' }] }]));
  const seed = `\nINSERT INTO certify.credential_config
    (credential_config_key_id, config_id, status, vc_template, sd_jwt_vct, credential_format, did_url, key_manager_app_id, key_manager_ref_id, signature_algo, display, display_order, scope, cryptographic_binding_methods_supported, credential_signing_alg_values_supported, proof_types_supported, sd_claim, sd_jwt_claims, cr_dtimes)
    VALUES (${sql(configId)}, 'a2-mobile-identity', 'active', ${sql(template)}, ${sql(configId)}, 'dc+sd-jwt', ${sql('did:web:' + hostname)}, 'CERTIFY_VC_SIGN_RSA', '', 'RS256', ${sql(display)}::jsonb, ARRAY['given_name','family_name'], 'playground_identity_sdjwt', ARRAY['did:jwk'], ARRAY['RS256'], '{"jwt":{"proof_signing_alg_values_supported":["EdDSA"]}}'::jsonb, '$.given_name,$.family_name', ${sql(JSON.stringify(claims))}::jsonb, NOW())
    ON CONFLICT (credential_config_key_id) DO UPDATE SET vc_template=EXCLUDED.vc_template, did_url=EXCLUDED.did_url, proof_types_supported=EXCLUDED.proof_types_supported, status=EXCLUDED.status, sd_jwt_claims=EXCLUDED.sd_jwt_claims;\n`;
  await save('database-init.sql', bootstrap + seed); await save('credential-seed.sql', seed);
  await save('synthetic-farmer.csv', 'id,fullName,farmerID,validFrom,validUntil\nSYNTHETIC-001,Ada Example,SYNTHETIC-001,2026-10-25T00:00:00Z,2027-10-25T00:00:00Z\n');
  const overrides = {
    'spring.cloud.config.enabled': 'false', 'spring.cloud.bootstrap.enabled': 'false',
    'server.port': '8090', 'mosip.certify.domain.url': issuer, 'mosip.certify.identifier': issuer,
    'spring.datasource.url': 'jdbc:postgresql://mobile-db:5432/inji_certify?currentSchema=certify',
    'spring.datasource.username': 'postgres', 'spring.datasource.password': settings.databasePassword,
    'mosip.certify.authorization.url': issuer, 'mosip.certify.authn.issuer-uri': issuer,
    'mosip.certify.authn.jwk-set-uri': 'http://127.0.0.1:8090/v1/certify/.well-known/jwks.json',
    'mosip.certify.authn.allowed-audiences': `{ '${issuer}/v1/certify/issuance/credential' }`,
    'mosip.certify.oauth.issuer': issuer, 'mosip.certify.oauth.access-token.audience': issuer + '/v1/certify/issuance/credential',
    'mosip.certify.oauth.token-endpoint': issuer + '/v1/certify/oauth/token',
    'mosip.certify.oauth.jwks-uri': issuer + '/v1/certify/.well-known/jwks.json',
    'mosip.certify.oauth.grant-types-supported': 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    'mosip.certify.authorization.default-server': issuer,
    'mosip.certify.integration.data-provider-plugin': 'PreAuthDataProviderPlugin',
    'mosip.certify.integration.audit-plugin': 'LoggerAuditService',
    'mosip.certify.integration.scan-base-package': 'io.mosip.certify.mock.integration',
    'mosip.certify.plugin-mode': 'DataProvider', 'mosip.certify.data-provider-plugin.did-url': 'did:web:' + hostname,
    'mosip.certify.data-provider-plugin.id-field-prefix-uri': '', 'mosip.certify.issuer.ledger-enabled': 'false',
    'mosip.kernel.keymanager.hsm.keystore-pass': settings.keystorePassword,
    'mosip.kernel.keymanager.certificate.default.common-name': hostname,
    'mosip.kernel.keymanager.softhsm.certificate.common-name': hostname,
    'mosip.certify.cache.secure.individual-id': 'false', 'mosip.certify.cache.store.individual-id': 'false',
    'mosip.certify.credential-config.issuer.display': "{{'name':'Playground Synthetic Certify','locale':'en'}}",
    'management.endpoints.web.exposure.include': 'health', 'management.endpoint.env.show-values': 'never',
    'logging.level.root': 'WARN', 'logging.level.io.mosip': 'WARN',
    'inji.keystore.file.path': 'file:/home/mosip/verifier.p12', 'inji.keystore.file.pass': settings.keystorePassword,
    'inji.verify.keystore.file.path': 'file:/home/mosip/verifier.p12', 'inji.verify.keystore.file.pass': settings.keystorePassword,
  };
  await save('certify-default.properties', properties.raw + '\n# Controlled mobile runtime overrides\n' + Object.entries(overrides).map(([k,v]) => `${k}=${v}`).join('\n') + '\n');
  let needsVerifierKey = settings.verifierKeyAlgorithm !== 'Ed25519';
  try { await readFile(join(runtime, 'verifier.p12')); } catch (error) { if (error.code !== 'ENOENT') throw error; needsVerifierKey = true; }
  if (needsVerifierKey) {
    // The embedded Verify library requires an EdDSA key entry, independently
    // of the RSA key generated by Certify for SD-JWT credential signatures.
    execFileSync('openssl', ['req', '-x509', '-newkey', 'ed25519', '-nodes', '-keyout', join(runtime, 'signing.key'), '-out', join(runtime, 'signing.crt'), '-days', '7', '-subj', '/CN=' + hostname], { stdio:'ignore' });
    execFileSync('openssl', ['pkcs12', '-export', '-in', join(runtime, 'signing.crt'), '-inkey', join(runtime, 'signing.key'), '-out', join(runtime, 'verifier.p12'), '-name', 'signing-key', '-passout', 'env:MOBILE_P12_PASSWORD'], { env:{...process.env,MOBILE_P12_PASSWORD:settings.keystorePassword}, stdio:'ignore' });
    for (const n of ['signing.key','signing.crt','verifier.p12']) await chmod(join(runtime,n),0o600);
    settings.verifierKeyAlgorithm = 'Ed25519'; await save('settings.json', settings);
  }
  await save('public-state.json', { schemaVersion:1, issuer, console:`http://127.0.0.1:${port}`, configurationId:configId, sourceCommit:source, image:'injistack/inji-certify-with-plugins:1.0.0-alpha.1', imageDigest:'sha256:1579b2449f1a7213fe25de1f6a1509b5636f1fedf0d7f5c4cfd07b9f0fc5b346', verifier:localOnly?'http://127.0.0.1:18081/v1/verify':verify, verifierVersion:localOnly?'0.18.2':'unreported', mobileAcceptance:'not_observed', localOnly });
}
async function waitReady() {
  for (let i=0; i<120; i++) {
    try { const r=await bounded(backend+'/v1/certify/.well-known/openid-credential-issuer'); if(r.status===200 && r.body?.credential_configurations_supported?.[configId]) return; } catch { /* startup */ }
    if (i % 5 === 4) {
      const status = execFileSync('docker', ['inspect', '--format', '{{.State.Status}}', composeProject + '-mobile-certify-1'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim();
      if (['exited','dead'].includes(status)) fail('CERTIFY_EXITED_DURING_STARTUP');
    }
    await pause(2000);
  }
  fail('CERTIFY_STARTUP_TIMEOUT');
}
async function createOffer() {
  if (state.phase!=='ready') fail('ISSUER_NOT_READY');
  const now=Math.floor(Date.now()/1000);
  const r=await bounded(backend+'/v1/certify/pre-authorized-data',post({credential_configuration_id:configId,claims:{given_name:'Ada',family_name:'Example',issuedAt:now,expiresAt:now+86400},expires_in:600}));
  if(r.status!==200 || typeof r.body?.credential_offer_uri!=='string') fail('OFFER_CREATION_FAILED_'+r.status);
  const uri=r.body.credential_offer_uri;
  if(uri.length>8192 || new URL(new URL(uri).searchParams.get('credential_offer_uri')).origin!==state.issuer) fail('OFFER_ORIGIN_INVALID');
  return { uri, createdAt:new Date().toISOString(), expiresAt:new Date(Date.now()+600_000).toISOString() };
}
async function createRequest() {
  const requestBody={clientId:'decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify',nonce:randomBytes(24).toString('base64url'),dcqlQuery:{credentials:[{id:'credential',format:'dc+sd-jwt',meta:{vct_values:[configId]}}]},responseCodeValidationRequired:false};
  const r=await bounded(verify+'/v2/vp-request',post(requestBody));
  if(![200,201].includes(r.status) || typeof r.body?.requestUri!=='string' || typeof r.body?.transactionId!=='string') fail('VERIFIER_REQUEST_FAILED');
  if(new URL(r.body.requestUri).origin!==new URL(verify).origin) fail('VERIFIER_ORIGIN_INVALID');
  const fetched=await bounded(r.body.requestUri,{headers:{accept:'application/oauth-authz-req+jwt'}});
  if(fetched.status!==200 || typeof fetched.body!=='string') fail('VERIFIER_REQUEST_INVALID');
  const claims=decodeJwt(fetched.body);
  if(new URL(claims.response_uri).origin!==new URL(verify).origin || claims.client_id!==requestBody.clientId || claims.nonce!==requestBody.nonce) fail('VERIFIER_BINDING_INVALID');
  return {uri:'openid4vp://authorize?'+new URLSearchParams({client_id:claims.client_id,request_uri:r.body.requestUri}),requestId:r.body.requestId,transactionId:r.body.transactionId,claims,createdAt:new Date().toISOString()};
}
async function readResult(request) {
  const r=await bounded(verify+'/v2/vp-results/'+encodeURIComponent(request.transactionId),post({includeClaims:false,skipStatusChecks:true}));
  if(r.status===404 || r.status===202) return {status:'pending',httpStatus:r.status};
  if(r.status!==200 || typeof r.body?.allChecksSuccessful!=='boolean') return {status:'error',httpStatus:r.status};
  const c=r.body.credentialResults?.[0];
  return {status:r.body.allChecksSuccessful?'valid':'invalid',httpStatus:r.status,credentialProofValid:typeof c?.schemaAndSignatureCheck?.valid==='boolean'?c.schemaAndSignatureCheck.valid:null,holderProofValid:typeof c?.holderProofCheck?.valid==='boolean'?c.holderProofCheck.valid:null};
}
async function control() {
  const offer=await createOffer();
  const offerUrl=new URL(offer.uri).searchParams.get('credential_offer_uri');
  const data=await bounded(offerUrl); const code=data.body?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
  if(data.status!==200 || typeof code!=='string') fail('CONTROL_OFFER_FAILED');
  const token=await bounded(state.issuer+'/v1/certify/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:pre-authorized_code','pre-authorized_code':code,client_id:'wallet'})});
  if(token.status!==200 || typeof token.body?.access_token!=='string') fail('CONTROL_TOKEN_FAILED_'+token.status);
  const nonce=await bounded(state.issuer+'/v1/certify/nonce',{method:'POST'});
  if(nonce.status!==200 || typeof nonce.body?.c_nonce!=='string') fail('CONTROL_NONCE_FAILED');
  const key=generateKeyPairSync('ed25519'),jwk=await exportJWK(key.publicKey),kid='did:jwk:'+Buffer.from(JSON.stringify(jwk)).toString('base64url')+'#0';
  const proof=await new SignJWT({aud:state.issuer,nonce:nonce.body.c_nonce}).setProtectedHeader({alg:'EdDSA',typ:'openid4vci-proof+jwt',kid}).setIssuedAt().setExpirationTime('5m').sign(key.privateKey);
  const issued=await bounded(state.issuer+'/v1/certify/issuance/credential',{...post({credential_configuration_id:configId,proofs:{jwt:[proof]}}),headers:{'content-type':'application/json',authorization:'Bearer '+token.body.access_token}});
  const credential=issued.body?.credential ?? issued.body?.credentials?.[0]?.credential ?? issued.body?.credentials?.[0];
  if(issued.status!==200 || typeof credential!=='string') fail('CONTROL_ISSUANCE_FAILED_'+issued.status);
  const jwt=credential.split('~')[0],header=decodeProtectedHeader(jwt);
  if(header.alg!=='RS256' || !Array.isArray(header.x5c) || !header.x5c.length) fail('CONTROL_ISSUER_HEADER_INVALID');
  const pem='-----BEGIN CERTIFICATE-----\n'+header.x5c[0].match(/.{1,64}/g).join('\n')+'\n-----END CERTIFICATE-----';
  const verified=await jwtVerify(jwt,await importX509(pem,'RS256'),{algorithms:['RS256'],issuer:state.issuer});
  if(verified.payload.vct!==configId || verified.payload.cnf?.kid!==kid) fail('CONTROL_HOLDER_BINDING_INVALID');
  const request=await createRequest();
  const prefix=credential.endsWith('~')?credential:credential+'~';
  const kb=await new SignJWT({aud:request.claims.client_id,nonce:request.claims.nonce,sd_hash:hash(prefix)}).setProtectedHeader({alg:'EdDSA',typ:'kb+jwt'}).setIssuedAt().sign(key.privateKey);
  const submitted=await bounded(request.claims.response_uri,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({state:request.claims.state,vp_token:JSON.stringify({credential:[prefix+kb]})})});
  if(submitted.status!==200) fail('CONTROL_SUBMISSION_FAILED_'+submitted.status);
  let result;
  for(let i=0;i<30;i++){ result=await readResult(request);if(result.status!=='pending')break;await pause(500); }
  if(result?.status!=='valid') fail('CONTROL_VERIFICATION_NOT_VALID');
  state.control={evidenceTier:'reference_wallet_control',issuer:'official_inji_certify',issuerVersion:'1.0.0-alpha.1',issuerSignatureValid:true,holderBindingObserved:true,certificateTrustChecked:false,verifier:verify,verifierVersion:'unreported',...result,timestamp:new Date().toISOString(),mobileAcceptance:'not_observed'};
  await save('control-summary.json',state.control);
  return state.control;
}
function localConsole(req) {
  return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && ['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host) && !req.headers['cf-connecting-ip'] && (!req.headers.origin || ['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin));
}
function page() {
  if (localOnly) return '<!doctype html><meta charset="utf-8"><title>Local Inji control</title><h1>Local Inji control</h1><p>Official Certify is running on loopback for the synthetic reference-holder smoke. Run <code>node scripts/local-inji-smoke.mjs</code> from the repository root. Phone and Collab actions are disabled in this mode.</p>';
  return `<!doctype html><meta charset="utf-8"><title>Inji mobile acceptance</title><style>body{font:18px system-ui;max-width:850px;margin:2rem auto;padding:1rem}button{padding:.8rem;margin:.4rem}svg{width:420px;max-width:100%;height:auto}pre{white-space:pre-wrap}aside{padding:1rem;background:#eef}</style><h1>Real Inji Wallet: SD-JWT attempt</h1><aside>Official local Inji Certify, synthetic identity. The automated control is a Reference Wallet check; mobile acceptance requires the actual phone.</aside><p>Leave this process and Mac running. The phone needs internet, not USB.</p><pre id="status"></pre><button onclick="action('offer')">1. Create fresh issuance QR</button><button onclick="action('request')">2. Create fresh presentation QR</button><button onclick="action('result')">3. Read Verify result</button><h2 id="title"></h2><div id="qr"></div><pre id="detail"></pre><script>
async function refresh(){document.getElementById('status').textContent=JSON.stringify(await(await fetch('/local/status')).json(),null,2)}
async function action(name){const r=await fetch('/local/'+name,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const x=await r.json();document.getElementById('detail').textContent=JSON.stringify(x.summary??x,null,2);document.getElementById('title').textContent=x.title??'';document.getElementById('qr').innerHTML=x.svg??'';await refresh()}
refresh();</script>`;
}
async function route(req,res) {
  res.setHeader('cache-control','no-store'); res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','no-referrer');
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(localConsole(req) && path==='/') {res.setHeader('content-type','text/html');res.end(page());return;}
    if(path.startsWith('/local/')) {
      if(!localConsole(req)) {res.writeHead(404).end();return;}
      res.setHeader('content-type','application/json');
      if(path==='/local/status' && req.method==='GET') {res.end(JSON.stringify({phase:state.phase,issuer:state.issuer,control:state.control,mobileAcceptance:'not_observed',result:state.result}));return;}
      if(req.method!=='POST' || req.headers['content-type']!=='application/json') {res.writeHead(415).end('{}');return;}
      let size=0;for await(const c of req){size+=c.length;if(size>1024)fail('REQUEST_LIMIT');}
      if(path==='/local/stop'){state.phase='stopping';await runDocker(['stop']);res.end(JSON.stringify({status:'stopped'}));setTimeout(()=>void shutdown(),100);return;}
      if(localOnly){res.writeHead(404).end('{}');return;}
      if(path==='/local/control'){res.end(JSON.stringify(await control()));return;}
      if(path==='/local/offer'){if(state.control?.status!=='valid')fail('CONTROL_NOT_PASSED');state.offer=await createOffer();res.end(JSON.stringify({title:'Scan using + → Scan & Download Card',svg:await QRCode.toString(state.offer.uri,{type:'svg',margin:4}),summary:{issuer:state.issuer,configurationId:configId,expiresAt:state.offer.expiresAt,instructions:'Trust only the displayed issuer. No identity/OTP is needed for this synthetic pre-authorized flow.'}}));return;}
      if(path==='/local/request'){state.presentation=await createRequest();res.end(JSON.stringify({title:'Scan using the wallet OpenID4VP sharing scanner',svg:await QRCode.toString(state.presentation.uri,{type:'svg',margin:4}),summary:{verifier:verify,createdAt:state.presentation.createdAt,instructions:'Select the credential just issued on this phone, review and approve.'}}));return;}
      if(path==='/local/result'){if(!state.presentation)fail('CREATE_PRESENTATION_REQUEST_FIRST');state.result=await readResult(state.presentation);res.end(JSON.stringify(state.result));return;}
      res.writeHead(404).end('{}');return;
    }
    const mapped=path.startsWith('/.well-known/')?'/v1/certify'+path:path;
    const allowed=(req.method==='GET' && /^\/v1\/certify\/(?:\.well-known\/(?:openid-credential-issuer|oauth-authorization-server|openid-configuration|jwks.json|did.json)|credential-offer-data\/[A-Za-z0-9_-]{1,200})$/.test(mapped)) || (req.method==='POST' && ['/v1/certify/oauth/token','/v1/certify/nonce','/v1/certify/issuance/credential'].includes(mapped));
    if(!allowed){res.writeHead(404).end();return;}
    if(!['ready','checking'].includes(state.phase)){res.writeHead(503).end();return;}
    let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>262144)fail('REQUEST_LIMIT');chunks.push(c);}
    const headers={};for(const key of ['content-type','authorization','accept'])if(req.headers[key])headers[key]=req.headers[key];
    const upstream=await fetch(backend+mapped,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{}),redirect:'error',signal:AbortSignal.timeout(30_000)});
    res.statusCode=upstream.status;res.setHeader('content-type',upstream.headers.get('content-type')??'application/json');
    let responseSize=0;for await(const c of upstream.body??[]){responseSize+=c.length;if(responseSize>2097152)fail('RESPONSE_LIMIT');res.write(c);}res.end();
  } catch(error) {if(!res.headersSent){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'MOBILE_REQUEST_FAILED'}));}else res.destroy();}
}
async function shutdown() {state.phase='stopped';tunnel?.kill('SIGTERM');for(const p of processes)p.kill('SIGTERM');server?.closeAllConnections();server?.close();}
async function main() {
  await prepare();
  if(process.argv[2]==='stop'){
    try {const r=await bounded(`http://127.0.0.1:${port}/local/stop`,post({}));if(r.status===200){console.log('Dedicated mobile services and tunnel stopped; keys/database preserved.');return;}} catch { /* launcher is already absent */ }
    await runDocker(['stop']);console.log('Dedicated mobile services stopped; keys/database preserved.');return;
  }
  if(process.argv[2] && process.argv[2]!=='start')fail('USAGE_MOBILE_INJI_START_OR_STOP');
  server=createServer((req,res)=>void route(req,res));server.requestTimeout=15_000;server.headersTimeout=10_000;
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',done);});
  process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
  console.log('Preparing official Certify mobile environment. Runtime files: '+runtime);
  state.issuer=localOnly?backend:await obtainTunnel();console.log((localOnly?'Loopback-only issuer: ':'Phone-reachable issuer: ')+state.issuer);
  await configure(state.issuer);state.phase='booting';
  await runDocker(['up','-d','--wait','mobile-db']);
  // Existing dedicated volumes keep their schema; refresh only our own credential row.
  await runDocker(['exec','-T','mobile-db','psql','-U','postgres','-d','inji_certify','-v','ON_ERROR_STOP=1'],false,await readFile(join(runtime,'credential-seed.sql'),'utf8'));
  await runDocker(['up','-d','--no-deps','--force-recreate','mobile-certify']);
  await waitReady();
  state.phase='ready';
  if (localOnly) console.log('Official Certify is ready for the separate local Inji Verify smoke. No Collab request or phone flow was run.');
  else {
    await control();
    console.log('Reference Wallet control: official Certify issued; Collab Verify returned valid. This does not close A2.');
    console.log('Open the local phone console: http://127.0.0.1:'+port);
  }
}
main().catch(async error=>{state.phase='failed';console.error('Mobile setup stopped: '+(/^[A-Z0-9_]+$/.test(error.message)?error.message:'SETUP_DEPENDENCY_FAILURE'));await save('failure-summary.json',{phase:state.phase,error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'SETUP_DEPENDENCY_FAILURE',mobileAcceptance:'not_observed'}).catch(()=>{});await shutdown();process.exitCode=1;});
