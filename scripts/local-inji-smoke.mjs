// Synthetic official Certify -> reference holder -> official local Verify control.
// Credential, access token, holder key and VP exist only in this process.
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decodeJwt, decodeProtectedHeader, exportJWK, importX509, jwtVerify, SignJWT } from 'jose';

const issuerBackend = 'http://127.0.0.1:18090';
const verifier = 'http://127.0.0.1:18081/v1/verify';
const configurationId = 'MockVerifiableCredential_SD_JWT';
const runtime = process.env.MOBILE_RUNTIME_DIR ?? join(tmpdir(), 'mosip-mobile-inji');
const startedAt = new Date().toISOString();

function assert(condition, code) { if (!condition) throw new Error(code); }
function json(body) { return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }; }
function sdHash(value) { return createHash('sha256').update(value).digest('base64url'); }
function damageIssuerSignature(credential) {
  const parts = credential.split('~');
  const jwt = parts[0].split('.');
  assert(jwt.length === 3 && jwt[2].length > 0, 'ISSUER_JWT_UNEXPECTED');
  jwt[2] = (jwt[2][0] === 'A' ? 'B' : 'A') + jwt[2].slice(1);
  parts[0] = jwt.join('.');
  return parts.join('~');
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const raw = await response.text();
  assert(raw.length < 2_097_152, 'RESPONSE_TOO_LARGE');
  let body;
  try { body = JSON.parse(raw); } catch { body = raw; }
  return { status: response.status, body };
}

export async function issueCredential(issuer, expired = false) {
  const now = Math.floor(Date.now() / 1000);
  const created = await request(issuerBackend + '/v1/certify/pre-authorized-data', json({
    credential_configuration_id: configurationId,
    claims: { given_name: 'Ada', family_name: 'Example', issuedAt: expired ? now - 86400 : now, expiresAt: expired ? now - 3600 : now + 86400 },
    expires_in: 600,
  }));
  assert(created.status === 200 && typeof created.body?.credential_offer_uri === 'string', 'OFFER_FAILED');
  const offerUrl = new URL(created.body.credential_offer_uri).searchParams.get('credential_offer_uri');
  assert(offerUrl && new URL(offerUrl).origin === issuer, 'OFFER_ORIGIN_INVALID');
  const offer = await request(offerUrl);
  const code = offer.body?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
  assert(offer.status === 200 && typeof code === 'string', 'OFFER_RESOLUTION_FAILED');

  const token = await request(issuer + '/v1/certify/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code', 'pre-authorized_code': code, client_id: 'wallet' }),
  });
  assert(token.status === 200 && typeof token.body?.access_token === 'string', 'TOKEN_FAILED');
  const nonce = await request(issuer + '/v1/certify/nonce', { method: 'POST' });
  assert(nonce.status === 200 && typeof nonce.body?.c_nonce === 'string', 'NONCE_FAILED');
  const holder = generateKeyPairSync('ed25519');
  const jwk = await exportJWK(holder.publicKey);
  const kid = 'did:jwk:' + Buffer.from(JSON.stringify(jwk)).toString('base64url') + '#0';
  const proof = await new SignJWT({ aud: issuer, nonce: nonce.body.c_nonce })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'openid4vci-proof+jwt', kid })
    .setIssuedAt().setExpirationTime('5m').sign(holder.privateKey);
  const issuance = await request(issuer + '/v1/certify/issuance/credential', {
    ...json({ credential_configuration_id: configurationId, proofs: { jwt: [proof] } }),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token.body.access_token },
  });
  const credential = issuance.body?.credential ?? issuance.body?.credentials?.[0]?.credential ?? issuance.body?.credentials?.[0];
  assert(issuance.status === 200 && typeof credential === 'string', 'ISSUANCE_FAILED');
  const issuerJwt = credential.split('~')[0];
  const header = decodeProtectedHeader(issuerJwt);
  assert(header.alg === 'RS256' && Array.isArray(header.x5c) && header.x5c.length > 0, 'ISSUER_KEY_UNEXPECTED');
  const pem = '-----BEGIN CERTIFICATE-----\n' + header.x5c[0].match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----';
  const verified = await jwtVerify(issuerJwt, await importX509(pem, 'RS256'), { algorithms: ['RS256'], issuer, ...(expired ? {currentDate:new Date((now-7200)*1000)} : {}) });
  if (expired) assert(verified.payload.exp < now, 'EXPIRY_NOT_SIGNED');
  assert(verified.payload.vct === configurationId && verified.payload.cnf?.kid === kid, 'ISSUER_OR_HOLDER_BINDING_INVALID');
  return { credential, holder };
}

export async function present(credential, holder, scenario, replayToken) {
  const definitionId = 'playground-local-sdjwt-' + randomUUID();
  const clientId = 'did:web:localhost%3A18081:v1:verify';
  const vpRequest = await request(verifier + '/vp-request', json({
    clientId, nonce: randomBytes(24).toString('base64url'),
    presentationDefinition: {
      id: definitionId,
      input_descriptors: [{ id: 'credential', format: { 'vc+sd-jwt': { alg: ['RS256'] } }, constraints: { fields: [{ path: ['$.vct'], filter: { type: 'string', const: scenario === 'wrong_type' ? 'OtherCredential' : configurationId } }] } }],
    },
    responseCodeValidationRequired: false,
  }));
  assert(vpRequest.status === 201 && typeof vpRequest.body?.requestUri === 'string', 'VP_REQUEST_FAILED');
  assert(new URL(vpRequest.body.requestUri).origin === 'http://127.0.0.1:18081', 'VP_REQUEST_ORIGIN_INVALID');
  const signedRequest = await request(vpRequest.body.requestUri, { headers: { accept: 'application/oauth-authz-req+jwt' } });
  assert(signedRequest.status === 200 && typeof signedRequest.body === 'string', 'SIGNED_REQUEST_FAILED');
  const claims = decodeJwt(signedRequest.body);
  assert(claims.client_id === clientId && claims.response_uri === verifier + '/vp-submission/direct-post', 'REQUEST_BINDING_INVALID');

  if (scenario === 'unreferenced_disclosure' || scenario === 'altered_disclosure') {
    const segments = credential.split('~');
    assert(segments[1], 'MISSING_CONTROL_DISCLOSURE');
    const disclosure = JSON.parse(Buffer.from(segments[1],'base64url'));
    disclosure[2] = 'SyntheticChanged';
    const replacement = Buffer.from(JSON.stringify(disclosure)).toString('base64url');
    if (scenario === 'altered_disclosure') segments[1] = replacement;
    else segments.splice(1, 0, replacement);
    credential = segments.join('~');
  }
  const presentedCredential = scenario === 'bad_issuer_signature' ? damageIssuerSignature(credential) : credential;
  const prefix = presentedCredential.endsWith('~') ? presentedCredential : presentedCredential + '~';
  const presentationNonce = scenario === 'wrong_nonce' ? randomBytes(24).toString('base64url') : claims.nonce;
  const presentationAudience = scenario === 'wrong_audience' ? 'did:web:unrelated.example' : claims.client_id;
  const kb = await new SignJWT({ aud: presentationAudience, nonce: presentationNonce, sd_hash: sdHash(prefix) })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'kb+jwt' }).setIssuedAt().sign(holder.privateKey);
  const vpToken = replayToken ?? prefix + kb;
  const activeKb = vpToken.split('~').at(-1);
  const checkedKb = await jwtVerify(activeKb, holder.publicKey, { algorithms: ['EdDSA'] });
  assert(typeof checkedKb.payload.nonce === 'string' && typeof checkedKb.payload.aud === 'string', 'HOLDER_PROOF_INVALID');
  const submission = {
    id: randomUUID(), definition_id: definitionId,
    descriptor_map: [{ id: 'credential', format: 'vc+sd-jwt', path: scenario === 'wrong_descriptor_path' ? '$[99]' : '$[0]' }],
  };
  const submittedState = scenario === 'wrong_state' ? randomBytes(24).toString('base64url') : claims.state;
  const submitted = await request(claims.response_uri, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ state: submittedState, vp_token: JSON.stringify([vpToken]), presentation_submission: JSON.stringify(submission) }),
  });
  const result = await request(verifier + '/v2/vp-results/' + encodeURIComponent(vpRequest.body.transactionId), json({ includeClaims: false, skipStatusChecks: true }));
  const first = result.body?.credentialResults?.[0];
  return { vpToken, summary: {
    scenario,
    nonceMatched: checkedKb.payload.nonce === claims.nonce,
    audienceMatched: checkedKb.payload.aud === claims.client_id,
    stateMatched: submittedState === claims.state,
    descriptorPathMatched: submission.descriptor_map[0].path === '$[0]',
    transactionId: vpRequest.body.transactionId, requestId: vpRequest.body.requestId,
    directPostHttpStatus: submitted.status,
    verifierHttpStatus: result.status, verifierValid: result.body?.allChecksSuccessful ?? null,
    credentialProofValid: first?.schemaAndSignatureCheck?.valid ?? null,
    holderProofValid: first?.holderProofCheck?.valid ?? null,
    resultCode: first?.schemaAndSignatureCheck?.error?.errorCode ?? null,
  } };
}

async function main() {
  const state = JSON.parse(await readFile(join(runtime, 'public-state.json'), 'utf8'));
  const issuer = state.issuer;
  assert(issuer === issuerBackend, 'ISSUER_RUNTIME_MUST_BE_LOOPBACK_ONLY');
  assert((await request(issuerBackend + '/v1/certify/.well-known/openid-credential-issuer')).status === 200, 'CERTIFY_NOT_READY');
  assert((await request(verifier + '/actuator/health')).body?.status === 'UP', 'VERIFY_NOT_READY');
  const { credential, holder } = await issueCredential(issuer);
  const publicMatrix = process.argv.includes('--public-matrix');
  const matrix = publicMatrix || process.argv.includes('--matrix');
  const scenarios = publicMatrix ? ['valid', 'bad_issuer_signature', 'wrong_state'] : matrix ? ['valid', 'wrong_nonce', 'wrong_audience', 'replayed_presentation', 'bad_issuer_signature', 'wrong_state', 'wrong_descriptor_path'] : ['valid'];
  const results = [];
  let validVpToken;
  for (const scenario of scenarios) {
    const observed = await present(credential, holder, scenario, scenario === 'replayed_presentation' ? validVpToken : undefined);
    if (scenario === 'valid') validVpToken = observed.vpToken;
    results.push(observed.summary);
  }
  const summary = {
    observedAt: startedAt, issuer: 'official_inji_certify', issuerVersion: '1.0.0-alpha.1',
    verifier: 'official_inji_verify', verifierVersion: '0.18.2', holder: 'non_inji_reference',
    deployment: 'local_services_loopback_only', issuerFormat: 'dc+sd-jwt',
    presentationDefinitionFormat: 'vc+sd-jwt', protocol: 'OpenID4VP Presentation Exchange',
    issuerSignatureChecked: true, holderBindingChecked: true,
    evidenceTier: 'local_official_services_reference_holder',
    ...(matrix ? { results } : results[0]),
  };
  console.log(JSON.stringify(summary, null, 2));
  assert(results[0].directPostHttpStatus === 200 && results[0].verifierHttpStatus === 200 && results[0].verifierValid, 'LOCAL_VERIFY_INVALID');
  if (matrix) {
    for (const negative of results.slice(1)) {
      assert(negative.verifierValid === false || (negative.directPostHttpStatus >= 400 && negative.directPostHttpStatus < 500),
        'LOCAL_NEGATIVE_ACCEPTED_' + negative.scenario.toUpperCase());
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  // Never serialize upstream response bodies, JWTs, credentials or request URLs.
  const code = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_INJI_SMOKE_FAILED';
  console.error(code);
  process.exitCode = 1;
});
