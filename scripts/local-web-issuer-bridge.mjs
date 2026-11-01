import { capturedFetch } from "./local-server-capture.mjs";
// Synthetic, local-only IAR fixture for Inji Web 0.17/Mimoto 0.22.
// Certify signs the actual token; the fixture bypasses IAR's VP authorization.
// No token, code, key, identity value or VC is logged.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const certify = 'http://mobile-certify:8090';
const verify = 'http://verify-service:8080';
const issuer = 'http://127.0.0.1:18090';
const authorizationServer = 'http://127.0.0.1:18096';
const redirectUri = 'http://127.0.0.1:18093/redirect';
const clientId = 'local-jsonld-web';
const configurationId = 'PlaygroundIdentity_LDP_VC';
const legacyCertify = process.env.LOCAL_CERTIFY_VERSION === '0.14.0';
const pending = new Map();
let lastNonce = null;
let lastTokenClientMatches = null;
let lastTokenClientIsWallet = null;
let lastTokenClaimKeys = [];
function jwtPart(token, part) {
  try { return JSON.parse(Buffer.from(token.split('.')[part], 'base64url').toString('utf8')); }
  catch { return {}; }
}

function send(response, status, value, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}
async function body(request, max = 32_768) {
  const chunks = []; let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > max) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function validChallenge(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value); }
function validVerifier(value) { return typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value); }
function equal(a, b) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function insertSyntheticSession(code, challenge) {
  const password = process.env.LOCAL_CERTIFY_DB_PASSWORD;
  if (typeof password !== 'string' || password.length < 16) throw new Error('LOCAL_DB_PASSWORD_MISSING');
  const db = new pg.Client({ host: 'mobile-db', port: 5432, database: 'inji_certify',
    user: 'postgres', password, connectionTimeoutMillis: 5000 });
  try {
    await db.connect();
    await db.query(`INSERT INTO certify.iar_session
      (auth_session, transaction_id, expires_at, client_id, scope,
       authorization_code, code_challenge, code_challenge_method,
       code_issued_at, identity_data)
      VALUES ($1, $2, NOW() + INTERVAL '5 minutes', $3, $4, $5, $6, 'S256', NOW(), $7)`,
    ['local_' + randomBytes(16).toString('hex'), randomBytes(16).toString('hex'),
      clientId, 'playground_farmer_ldp', code, challenge, 'SYNTHETIC-001']);
  } finally { await db.end().catch(() => {}); }
}
async function upstream(path, options = {}) {
  const response = await capturedFetch(certify + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15_000) }, 'certify');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 2_097_152) throw new Error('UPSTREAM_TOO_LARGE');
  return { status: response.status, body: JSON.parse(bytes.toString('utf8')) };
}
async function authorize(request, response, url) {
  const query = url.searchParams;
  if (!['GET', 'POST'].includes(request.method) || query.get('response_type') !== 'code' || query.get('client_id') !== clientId ||
      query.get('redirect_uri') !== redirectUri || query.get('scope') !== 'playground_farmer_ldp' ||
      query.get('code_challenge_method') !== 'S256' || !validChallenge(query.get('code_challenge')) ||
      !/^[A-Za-z0-9._~-]{16,256}$/.test(query.get('state') ?? '')) {
    return send(response, 400, { error: 'invalid_request' });
  }
  if (process.env.INTERACTIVE_SYNTHETIC_AUTH === 'true') {
    if (request.method === 'GET') {
      response.writeHead(200, {'content-type':'text/html;charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'});
      return response.end('<!doctype html><html lang="en"><title>Synthetic issuer sign-in</title><main><h1>Synthetic issuer sign-in</h1><p>Test UIN: SYNTHETIC-001. Test OTP: 246810.</p><form method="post"><label>Demo UIN <input name="uin" required></label><label>Demo OTP <input name="otp" required></label><button>Authorize issuance</button></form></main></html>');
    }
    if (request.headers.origin !== authorizationServer || !request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) return send(response,403,{error:'invalid_request'});
    const login=new URLSearchParams((await body(request,1024)).toString('utf8'));
    if(login.get('uin')!=='SYNTHETIC-001'||login.get('otp')!=='246810')return send(response,401,{error:'access_denied'});
  } else if (request.method !== 'GET') return send(response,405,{error:'invalid_request'});
  const code = 'iar_auth_' + randomBytes(24).toString('base64url');
  await insertSyntheticSession(code, query.get('code_challenge'));
  pending.set(code, { challenge: query.get('code_challenge'), expiresAt: Date.now() + 300_000 });
  for (const [key, item] of pending) if (item.expiresAt < Date.now()) pending.delete(key);
  const destination = new URL(redirectUri);
  destination.searchParams.set('code', code);
  destination.searchParams.set('state', query.get('state'));
  response.writeHead(302, { location: destination.href, 'cache-control': 'no-store' });
  response.end();
}
async function token(request, response) {
  if (request.method !== 'POST' || !(request.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded'))
    return send(response, 415, { error: 'unsupported_media_type' });
  const form = new URLSearchParams((await body(request)).toString('utf8'));
  const code = form.get('code');
  const item = pending.get(code);
  if (code) pending.delete(code);
  const verifier = form.get('code_verifier');
  if (form.get('grant_type') !== 'authorization_code' || form.get('client_id') !== clientId ||
      form.get('redirect_uri') !== redirectUri || !item || item.expiresAt < Date.now() || !validVerifier(verifier) ||
      !equal(createHash('sha256').update(verifier).digest('base64url'), item.challenge)) {
    return send(response, 400, { error: 'invalid_grant' });
  }
  const issued = await upstream('/v1/certify/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier }),
  });
  if (issued.status !== 200 || typeof issued.body?.access_token !== 'string') throw new Error('TOKEN_FAILED');
  if (!legacyCertify) {
    const nonce = await upstream('/v1/certify/nonce', { method: 'POST' });
    if (nonce.status !== 200 || typeof nonce.body?.c_nonce !== 'string') throw new Error('NONCE_FAILED');
    issued.body.c_nonce = nonce.body.c_nonce;
  }
  if (typeof issued.body.c_nonce !== 'string') throw new Error('NONCE_FAILED');
  lastNonce = issued.body.c_nonce;
  const tokenClaims = jwtPart(issued.body.access_token, 1);
  lastTokenClientMatches = tokenClaims.client_id === clientId;
  lastTokenClientIsWallet = tokenClaims.client_id === 'wallet';
  lastTokenClaimKeys = Object.keys(tokenClaims).filter(key => /^[A-Za-z0-9_]{1,35}$/.test(key)).slice(0,20);
  send(response, 200, issued.body);
}
async function authHandler(request, response) {
  try {
    const url = new URL(request.url, authorizationServer);
    if (url.pathname === '/health' && request.method === 'GET') return send(response, 200, { status: 'UP' });
    if (url.pathname === '/.well-known/oauth-authorization-server' && request.method === 'GET')
      return send(response, 200, { issuer: authorizationServer, authorization_endpoint: authorizationServer + '/authorize',
        token_endpoint: authorizationServer + '/token', grant_types_supported: ['authorization_code'],
        response_types_supported: ['code'], code_challenge_methods_supported: ['S256'] });
    if (url.pathname === '/authorize') return await authorize(request, response, url);
    if (url.pathname === '/token') return await token(request, response);
    send(response, 404, { error: 'not_found' });
  } catch (error) {
    // No upstream body or stack trace crosses this synthetic boundary.
    if (/^LOCAL_CAPTURE_[A-Z_]+$/.test(error?.message ?? '')) console.error(JSON.stringify({ checkpoint: 'LOCAL_CAPTURE_FAILURE', code: error.message }));
    send(response, error.message === 'BODY_TOO_LARGE' ? 413 : 502, { error: 'local_bridge_failure' });
  }
}
async function proxy(request, response, upstreamBase, service) {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const allowed = service === 'certify'
      ? /^(?:\/\.well-known\/openid-credential-issuer|\/v1\/certify\/(?:\.well-known\/[A-Za-z0-9._-]+|credential-offer-data\/[A-Za-z0-9_-]{1,200}|oauth\/token|nonce|issuance\/credential))$/
      : /^\/v1\/verify\/(?:v2\/vp-request(?:\/[A-Za-z0-9_-]+)?|vp-submission\/direct-post|v2\/vp-results\/[A-Za-z0-9_-]+|vp-request(?:\/[A-Za-z0-9_-]+)?|actuator\/health)$/;
    if (!allowed.test(url.pathname) || url.search) return send(response, 404, { error: 'not_found' });
    const expectedMethod = /(?:\/oauth\/token|\/nonce|\/issuance\/credential|\/direct-post|\/vp-results\/[A-Za-z0-9_-]+|\/vp-request)$/.test(url.pathname) ? 'POST' : 'GET';
    if (request.method !== expectedMethod) return send(response, 405, { error: 'method_not_allowed' });
    const path = url.pathname === '/.well-known/openid-credential-issuer'
      ? '/v1/certify/.well-known/openid-credential-issuer' : url.pathname;
    let bytes = ['POST', 'PUT'].includes(request.method) ? await body(request, 2_097_152) : undefined;
    let proofJwk = null;
    if (service === 'certify' && path === '/v1/certify/issuance/credential' && request.method === 'POST') {
      const legacy = JSON.parse(bytes.toString('utf8'));
      if (legacy.format !== 'ldp_vc' || legacy.proof?.proof_type !== 'jwt' ||
          typeof legacy.proof.jwt !== 'string' || legacy.proof.jwt.length > 8192) {
        return send(response, 400, { error: 'invalid_credential_request' });
      }
      const header = jwtPart(legacy.proof.jwt, 0);
      proofJwk = header.jwk ?? null;
      const claims = jwtPart(legacy.proof.jwt, 1);
      console.log(JSON.stringify({ checkpoint: 'SYNTHETIC_PROOF_SHAPE',
        algorithm: ['Ed25519', 'EdDSA', 'RS256', 'ES256', 'ES256K'].includes(header.alg) ? header.alg : 'other',
        hasPublicJwk: !!header.jwk, hasKid: !!header.kid,
        audienceMatches: claims.aud === issuer || (Array.isArray(claims.aud) && claims.aud.includes(issuer)),
        issuerMatchesClient: claims.iss === clientId,
        nonceMatches: claims.nonce === lastNonce,
        tokenClientMatches: lastTokenClientMatches, tokenClientIsWallet: lastTokenClientIsWallet,
        tokenClaimKeys: lastTokenClaimKeys }));
      // Translate the draft-era Mimoto request shape without touching the
      // signed holder proof or the credential returned by official Certify.
      if (!legacyCertify) bytes = Buffer.from(JSON.stringify({ credential_configuration_id: configurationId,
        proofs: { jwt: [legacy.proof.jwt] } }));
    }
    const upstreamResponse = await capturedFetch(upstreamBase + path, { method: request.method, redirect: 'error',
      headers: { ...(request.headers['content-type'] ? { 'content-type': request.headers['content-type'] } : {}),
        ...(request.headers.authorization ? { authorization: request.headers.authorization } : {}),
        ...(request.headers.accept ? { accept: request.headers.accept } : {}) },
      body: bytes, signal: AbortSignal.timeout(20_000) }, service);
    const result = Buffer.from(await upstreamResponse.arrayBuffer());
    if (result.length > 2_097_152) throw new Error('UPSTREAM_TOO_LARGE');
    let output = result;
    if (proofJwk && upstreamResponse.ok) {
      const issued = JSON.parse(result.toString('utf8'));
      const credential = issued.credential ?? issued.credentials?.[0]?.credential;
      const subjectId = credential?.credentialSubject?.id;
      let subjectJwk = null;
      if (typeof subjectId === 'string' && subjectId.startsWith('did:jwk:')) {
        try { subjectJwk = JSON.parse(Buffer.from(subjectId.slice(8).split('#')[0], 'base64url').toString('utf8')); }
        catch { /* report mismatch without logging key material */ }
      }
      const fields = proofJwk.kty === 'OKP' ? ['kty', 'crv', 'x'] :
        proofJwk.kty === 'RSA' ? ['kty', 'n', 'e'] : ['kty', 'crv', 'x', 'y'];
      console.log(JSON.stringify({ checkpoint: 'SYNTHETIC_CREDENTIAL_ISSUED',
        issuerVersion: legacyCertify ? '0.14.0' : '1.0.0-alpha.1',
        subjectKeyMatchesProof: !!subjectJwk && fields.every(field =>
          typeof proofJwk[field] === 'string' && proofJwk[field] === subjectJwk[field]),
        subjectUsesWalletKeyReference: typeof subjectId === 'string' && subjectId.endsWith('#0') }));
    }
    if (!legacyCertify && service === 'certify' && path === '/v1/certify/issuance/credential' && upstreamResponse.ok) {
      const current = JSON.parse(result.toString('utf8'));
      const credential = current.credentials?.[0]?.credential;
      if (current.credentials?.length !== 1 || !credential || typeof credential !== 'object')
        throw new Error('CREDENTIAL_SHAPE_CHANGED');
      // Draft translation only: preserve Certify's signed credential verbatim.
      output = Buffer.from(JSON.stringify({ format: 'ldp_vc', credential }));
    }
    if (service === 'certify' && path.endsWith('/openid-credential-issuer') && upstreamResponse.ok) {
      const metadata = JSON.parse(result.toString('utf8'));
      metadata.authorization_servers = [authorizationServer];
      metadata.credential_configurations_supported = {
        [configurationId]: metadata.credential_configurations_supported?.[configurationId],
      };
      if (!metadata.credential_configurations_supported[configurationId]) throw new Error('JSONLD_CONFIGURATION_MISSING');
      // Mimoto 0.22 still reads draft-era top-level display/order fields.
      // Certify alpha.1 advertises the newer credential_metadata.display shape.
      for (const entry of Object.values(metadata.credential_configurations_supported ?? {})) {
        if (!Array.isArray(entry.display) || entry.display.length === 0) {
          entry.display = (entry.credential_metadata?.display ?? []).map(display => ({
            name: display.name, locale: display.locale,
            logo: { url: 'http://127.0.0.1:18093/favicon.ico', alt_text: 'Synthetic test credential' },
            text_color: '#FFFFFF', background_color: '#252145',
          }));
        }
        if (!Array.isArray(entry.order)) entry.order = ['fullName', 'farmerID'];
        entry.display = (entry.display ?? []).map(display => ({ ...display,
          text_color: display.text_color || '#FFFFFF',
          background_color: display.background_color || '#252145',
          logo: display.logo?.url ? display.logo : {
            url: 'http://127.0.0.1:18093/favicon.ico', alt_text: 'Synthetic test credential',
          },
        }));
      }
      output = Buffer.from(JSON.stringify(metadata));
    }
    response.writeHead(upstreamResponse.status, { 'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store' });
    response.end(output);
  } catch (error) {
    if (/^LOCAL_CAPTURE_[A-Z_]+$/.test(error?.message ?? '')) console.error(JSON.stringify({ checkpoint: 'LOCAL_CAPTURE_FAILURE', code: error.message }));
    send(response, 502, { error: 'local_bridge_failure' });
  }
}

createServer(authHandler).listen(18096, '0.0.0.0');
createServer((req, res) => proxy(req, res, certify, 'certify')).listen(18090, '127.0.0.1');
createServer((req, res) => proxy(req, res, verify, 'verify')).listen(18081, '127.0.0.1');
createSecureServer({ key: readFileSync('/app/tls/localhost.key'), cert: readFileSync('/app/tls/localhost.crt') },
  async (request, response) => {
    if (/^\/v1\/verify\/(?:vp-request\/[A-Za-z0-9_-]+|vp-submission\/direct-post)$/.test(request.url ?? ''))
      return proxy(request, response, verify, 'verify');
    if (request.method !== 'GET' || !['/.well-known/did.json', '/verify/did.json'].includes(request.url))
      return send(response, 404, { error: 'not_found' });
    try {
      if (request.url === '/verify/did.json') {
        const verifyResponse = await fetch(verify + '/v1/verify/did.json',
          { redirect: 'error', signal: AbortSignal.timeout(5000) });
        const document = await verifyResponse.json();
        if (verifyResponse.status !== 200 || document.id !== 'did:web:local.test:verify' ||
            document.verificationMethod?.[0]?.id !== 'did:web:local.test:verify#key-0')
          throw new Error('LOCAL_VERIFY_DID_MISMATCH');
        return send(response, 200, document);
      }
      const upstreamDocument = await upstream('/v1/certify/.well-known/did.json');
      if (upstreamDocument.status !== 200 || upstreamDocument.body?.id !== 'did:web:local.test')
        throw new Error('LOCAL_DID_MISMATCH');
      const document = upstreamDocument.body;
      // Certify alpha.1 advertises its DID instead of the signing key in
      // assertionMethod. Point it at the unchanged public verification method.
      document.assertionMethod = (document.verificationMethod ?? [])
        .filter(method => method.type === 'Ed25519VerificationKey2020')
        .map(method => method.id);
      if (document.assertionMethod.length !== 1) throw new Error('LOCAL_DID_KEY_MISSING');
      send(response, 200, document);
    } catch { send(response, 502, { error: 'local_did_unavailable' }); }
  }).listen(443, '0.0.0.0');
