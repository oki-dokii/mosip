// Present a synthetic credential from the real local Inji Web wallet to Verify.
// Request URI, state, VP token, wallet ID and claims are kept in memory only.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeJwt, decodeProtectedHeader } from 'jose';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const wallet = 'http://127.0.0.1:18093';
const verifier = 'http://127.0.0.1:18081/v1/verify';
let stage = 'create_request';
const routes = [];
const protocolErrorHints = [];

async function createRequest() {
  if (process.env.LOCAL_ASSISTED_RUN_ID) {
    const bff = process.env.LOCAL_ASSISTED_BFF_URL ?? 'http://127.0.0.1:4500';
    if (!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(bff) || !/^[a-f0-9-]{36}$/.test(process.env.LOCAL_ASSISTED_RUN_ID)) throw new Error('LOCAL_ASSISTED_POLICY');
    const status = await fetch(bff + '/api/v1/assisted/runs/' + process.env.LOCAL_ASSISTED_RUN_ID).then(r => r.json());
    const launch = new URL(status.actions?.presentationUrl);
    if (launch.origin !== wallet || launch.pathname !== '/user/authorize') throw new Error('LOCAL_ASSISTED_ACTION_INVALID');
    const signedRequest = launch.searchParams.get('request');
    if (!signedRequest) throw new Error('LOCAL_ASSISTED_REQUEST_MISSING');
    return { signedRequest, requestClaims: decodeJwt(signedRequest), managed: true };
  }
  const response = await fetch(verifier + '/vp-request', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      clientId: 'did:web:localhost%3A18081:v1:verify',
      nonce: randomBytes(24).toString('base64url'),
      presentationDefinition: { id: 'local-jsonld-farmer', input_descriptors: [{
        id: 'farmer', format: { 'vc+sd-jwt': { alg: ['RS256'] } },
        constraints: { fields: [{ path: ['$.vct'], filter: { type: 'string', const: 'MockVerifiableCredential_SD_JWT' } }] },
      }] },
      responseCodeValidationRequired: false,
    }), signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (response.status !== 201 || typeof result.requestUri !== 'string' ||
      (typeof result.requestUri === 'string' && new URL(result.requestUri).origin !== 'http://127.0.0.1:18081') || !result.transactionId) {
    console.error(JSON.stringify({ checkpoint: 'VERIFY_REQUEST_RESPONSE', status: response.status,
      responseKeys: Object.keys(result).slice(0, 12),
      errorCode: String(result.errorCode ?? result.error ?? 'none').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 45) }));
    throw new Error('LOCAL_VERIFY_REQUEST_FAILED');
  }
  const hostFetch = new URL(result.requestUri);
  hostFetch.protocol = 'http:';
  hostFetch.hostname = '127.0.0.1';
  hostFetch.port = '18081';
  const requestObjectResponse = await fetch(hostFetch, {
    headers: { accept: 'application/oauth-authz-req+jwt' }, signal: AbortSignal.timeout(10_000),
  });
  const requestObject = await requestObjectResponse.text();
  if (requestObjectResponse.status !== 200 || requestObject.length > 20_000 || requestObject.split('.').length !== 3)
    throw new Error('LOCAL_SIGNED_REQUEST_FAILED');
  result.requestClaims = decodeJwt(requestObject);
  const header = decodeProtectedHeader(requestObject);
  if (header.alg !== 'EdDSA' || result.requestClaims.response_mode !== 'direct_post' ||
      new URL(result.requestClaims.response_uri).origin !== 'http://127.0.0.1:18081')
    throw new Error('LOCAL_SIGNED_REQUEST_BINDING_CHANGED');
  result.signedRequest = requestObject;
  return result;
}

async function main() {
  const request = await createRequest();
  const pin = (await readFile(join(runtime, 'synthetic-wallet-passcode'), 'utf8')).trim();
  if (!/^\d{6}$/.test(pin)) throw new Error('LOCAL_PIN_MISSING');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on('response', async response => {
      const url = new URL(response.url());
      if (url.origin === wallet && response.status() >= 400 && url.pathname.endsWith('/presentations')) {
        try {
          const text = await response.text();
          protocolErrorHints.push(Object.fromEntries(['expired', 'invalid', 'algorithm', 'http', 'uri', 'nonce', 'client', 'definition', 'pattern', 'signature', 'did', 'credential', 'missing', 'required', 'blank', 'audience'].map(term => [term, text.toLowerCase().includes(term)])));
        } catch { /* no response body is exported */ }
      }
      if (url.origin === wallet && url.pathname.startsWith('/v1/mimoto/'))
        routes.push({ method: response.request().method(),
          path: url.pathname.replace(/\/wallets\/[^/]+/g, '/wallets/{id}')
            .replace(/\/presentations\/[^/]+/g, '/presentations/{id}'), status: response.status() });
    });
    stage = 'wallet_login';
    await page.goto(wallet, { waitUntil: 'domcontentloaded' });
    stage='choose_identity_provider';
    await page.getByText('Continue With Google').click();
    stage='wallet_unlock';
    await page.getByText('Enter Your Passcode to Continue').waitFor({ timeout: 20_000 });
    for (let index = 0; index < 6; index++) await page.locator('input[type=password]').nth(index).fill(pin[index]);
    const unlocked = page.waitForResponse(r => r.url().startsWith(wallet+'/v1/mimoto/wallets/') && r.url().endsWith('/unlock') && r.status() === 200);
    await page.getByRole('button', { name: 'Submit' }).click();
    await unlocked;
    stage = 'wallet_authorize';
    const claims = request.requestClaims;
    const parameters = new URLSearchParams();
    for (const name of ['client_id', 'client_id_scheme', 'response_type', 'response_mode',
      'nonce', 'state', 'response_uri', 'redirect_uri', 'scope']) {
      if (typeof claims[name] === 'string') parameters.set(name, claims[name]);
    }
    if (claims.presentation_definition && typeof claims.presentation_definition === 'object')
      parameters.set('presentation_definition', JSON.stringify(claims.presentation_definition));
    parameters.set('request', request.signedRequest);
    if (!parameters.has('client_id') || !parameters.has('presentation_definition') || !parameters.has('response_uri'))
      throw new Error('LOCAL_REQUEST_CLAIMS_INCOMPLETE');
    await page.goto(wallet + '/user/authorize?' + parameters.toString(),
      { waitUntil: 'domcontentloaded' });
    const trust = page.getByTestId('modal-trust-verifier');
    const credentialModal = page.getByTestId('card-credential-request-modal');
    await Promise.race([
      trust.waitFor({ timeout: 20_000 }).catch(() => {}),
      credentialModal.waitFor({ timeout: 20_000 }).catch(() => {}),
      page.getByTestId('modal-error-card').waitFor({ timeout: 20_000 }).catch(() => {}),
    ]);
    if (await trust.isVisible().catch(() => false)) {
      stage = 'trust_verifier';
      await page.getByTestId('btn-trust-verifier').click();
    }
    const error = page.getByTestId('modal-error-card');
    await Promise.race([error.waitFor(),credentialModal.waitFor()]).catch(()=>{});
    const text = (await page.locator('body').innerText()).toLowerCase();
    const messages = ['no matching credentials','no matching credential','no credentials','unsupported','invalid request','something went wrong','unable to'].filter(t=>text.includes(t));
    console.log(JSON.stringify({observedAt:new Date().toISOString(), wallet:'Inji Web 0.17 / Mimoto 0.22',requestFormat:'vc+sd-jwt',loggedIn:true,walletHasSyntheticJsonLdCard:"not_checked",sdJwtCardProvisioned:false,errorCardVisible:await error.isVisible(),selectionVisible:await credentialModal.isVisible(),offeredCards:await page.locator('[data-testid^="item-"]').count(),messages,routes,stage}));
  } finally { await browser.close(); }
}
main().catch(()=>{console.log(JSON.stringify({observedAt:new Date().toISOString(),wallet:'Inji Web 0.17 / Mimoto 0.22',requestFormat:'vc+sd-jwt',stoppedAt:stage,routes,verdict:null}));process.exitCode=1;});
