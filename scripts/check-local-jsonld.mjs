// Isolated pre-authorized JSON-LD issuance control against official local Certify.
// All codes, tokens, keys and credentials remain in memory.
import { generateKeyPairSync } from 'node:crypto';
import { exportJWK, SignJWT } from 'jose';

const base = 'http://127.0.0.1:18090';
const configurationId = 'PlaygroundIdentity_LDP_VC';
let stage = 'metadata';
function assert(ok, code) { if (!ok) throw new Error(code); }
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const raw = await response.text();
  assert(raw.length < 2_097_152, 'RESPONSE_TOO_LARGE');
  let body; try { body = JSON.parse(raw); } catch { body = raw; }
  return { status: response.status, body };
}
function post(body) { return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }; }

async function main() {
  const metadata = await request(base + '/v1/certify/.well-known/openid-credential-issuer');
  assert(metadata.status === 200 && metadata.body?.credential_configurations_supported?.[configurationId]?.format === 'ldp_vc', 'JSONLD_METADATA_MISSING');
  stage = 'offer';
  const now = new Date();
  const offer = await request(base + '/v1/certify/pre-authorized-data', post({
    credential_configuration_id: configurationId,
    claims: {
      fullName: 'Ada Example', farmerID: 'SYNTHETIC-001',
      validFrom: now.toISOString(), validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
    }, expires_in: 600,
  }));
  assert(offer.status === 200 && typeof offer.body?.credential_offer_uri === 'string', 'JSONLD_OFFER_FAILED');
  const offerUrl = new URL(offer.body.credential_offer_uri).searchParams.get('credential_offer_uri');
  assert(offerUrl && new URL(offerUrl).origin === base, 'JSONLD_OFFER_ORIGIN_INVALID');
  const offerData = await request(offerUrl);
  const code = offerData.body?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
  assert(offerData.status === 200 && typeof code === 'string', 'JSONLD_OFFER_DATA_FAILED');
  stage = 'token';
  const token = await request(base + '/v1/certify/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', 'pre-authorized_code': code, client_id: 'local-jsonld-control' }),
  });
  assert(token.status === 200 && typeof token.body?.access_token === 'string', 'JSONLD_TOKEN_FAILED');
  stage = 'credential';
  const nonce = await request(base + '/v1/certify/nonce', { method: 'POST' });
  assert(nonce.status === 200 && typeof nonce.body?.c_nonce === 'string', 'JSONLD_NONCE_FAILED');
  const holder = generateKeyPairSync('ed25519');
  const jwk = await exportJWK(holder.publicKey);
  const kid = 'did:jwk:' + Buffer.from(JSON.stringify(jwk)).toString('base64url') + '#0';
  const proof = await new SignJWT({ aud: base, nonce: nonce.body.c_nonce })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'openid4vci-proof+jwt', kid })
    .setIssuedAt().setExpirationTime('5m').sign(holder.privateKey);
  const issued = await request(base + '/v1/certify/issuance/credential', {
    ...post({ credential_configuration_id: configurationId, proofs: { jwt: [proof] } }),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token.body.access_token },
  });
  const credential = issued.body?.credential ?? issued.body?.credentials?.[0]?.credential;
  if (!(issued.status === 200 && credential && typeof credential === 'object')) {
    const upstreamCode = String(issued.body?.errors?.[0]?.errorCode ?? issued.body?.errorCode ?? issued.body?.error ?? 'none').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 50);
    console.error(JSON.stringify({ responseShape: typeof issued.body === 'object' ? Object.keys(issued.body) : typeof issued.body }));
    throw new Error(`JSONLD_CREDENTIAL_FAILED_${issued.status}_${upstreamCode}`.toUpperCase());
  }
  assert(Array.isArray(credential.type) && credential.type.includes('FarmerCredential') && credential.proof, 'JSONLD_CREDENTIAL_SHAPE_INVALID');
  console.log(JSON.stringify({ result: 'LOCAL_CERTIFY_JSONLD_ISSUED', issuer: base, format: 'ldp_vc',
    configurationId, credentialType: 'FarmerCredential', proofType: credential.proof.type ?? 'unreported',
    wallet: 'non_inji_reference', verifier: 'not_tested' }));
}

main().catch(error => {
  const code = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_JSONLD_CHECK_FAILED';
  console.error(JSON.stringify({ result: 'failed', stage, code }));
  process.exitCode = 1;
});
