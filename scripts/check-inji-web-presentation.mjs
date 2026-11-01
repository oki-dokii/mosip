// Present a synthetic credential from the real local Inji Web wallet to Verify.
// Request URI, state, VP token, wallet ID and claims are kept in memory only.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
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
      clientId: 'did:web:local.test:verify',
      nonce: randomBytes(24).toString('base64url'),
      presentationDefinition: { id: 'local-jsonld-farmer', input_descriptors: [{
        id: 'farmer', format: { ldp_vc: { proof_type: ['Ed25519Signature2020'] } },
        constraints: { fields: [{ path: ['$.type[*]'], filter: { type: 'string', pattern: 'FarmerCredential' } }] },
      }] },
      responseCodeValidationRequired: false,
    }), signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (response.status !== 201 || typeof result.requestUri !== 'string' ||
      (typeof result.requestUri === 'string' && new URL(result.requestUri).origin !== 'https://local.test') || !result.transactionId) {
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
      new URL(result.requestClaims.response_uri).origin !== 'https://local.test')
    throw new Error('LOCAL_SIGNED_REQUEST_BINDING_CHANGED');
  result.signedRequest = requestObject;
  return result;
}

async function main() {
  const issued = JSON.parse(await readFile(join(runtime, 'last-jsonld-issued.json'), 'utf8'));
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(issued.credentialId ?? '') ||
      !/^[A-Za-z0-9_-]{10,100}$/.test(issued.walletId ?? '')) throw new Error('FRESH_ISSUANCE_RECORD_REQUIRED');
  const request = await createRequest();
  const pin = (await readFile(join(runtime, 'synthetic-wallet-passcode'), 'utf8')).trim();
  if (!/^\d{6}$/.test(pin)) throw new Error('LOCAL_PIN_MISSING');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let walletMatchesIssuance = false;
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
      if (url.origin === wallet && response.request().method() === 'POST' && url.pathname.endsWith('/presentations'))
        walletMatchesIssuance = url.pathname.match(/\/wallets\/([^/]+)\/presentations$/)?.[1] === issued.walletId;
    });
    stage = 'wallet_login';
    await page.goto(wallet, { waitUntil: 'domcontentloaded' });
    await page.getByText('Continue With Google').click();
    await page.getByText('Enter Your Passcode to Continue').waitFor({ timeout: 20_000 });
    for (let index = 0; index < 6; index++) await page.locator('input[type=password]').nth(index).fill(pin[index]);
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByText('Playground Synthetic Farmer').first().waitFor({ timeout: 25_000 });
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
    stage = 'select_credential';
    await credentialModal.waitFor({ timeout: 20_000 });
    const item = page.getByTestId('item-' + issued.credentialId);
    await item.waitFor({ timeout: 20_000 });
    await item.locator('input[type="checkbox"]').click();
    stage = 'submit_presentation';
    const submitted = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === wallet && /\/v1\/mimoto\/wallets\/[^/]+\/presentations\/[^/]+$/.test(url.pathname) &&
        response.request().method() === 'PATCH';
    }, { timeout: 35_000 }).catch(() => null);
    await page.locator('[data-testid="btn-consent-share"]:visible').click();
    const submission = await submitted;
    stage = 'verify_result';
    let verdict = null;
    let verifierStatus = null;
    let verifierDetails = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (request.managed) {
        const status = await fetch((process.env.LOCAL_ASSISTED_BFF_URL ?? 'http://127.0.0.1:4500') + '/api/v1/assisted/runs/' + process.env.LOCAL_ASSISTED_RUN_ID).then(r => r.json());
        const summary = status.steps?.find(step => step.stepKey === 'PRESENT_RESULT')?.summary;
        if (summary?.outcome === 'valid' || summary?.outcome === 'invalid') {
          verdict = summary.outcome === 'valid'; verifierStatus = 200;
          verifierDetails = { credentialProofValid: summary.credentialProofValid, holderProofValid: summary.holderProofValid,
            resultSource: summary.resultSource }; break;
        }
        if (['errored', 'failed', 'cancelled'].includes(status.run?.status)) throw new Error('LOCAL_ASSISTED_RUN_FAILED');
        await new Promise(resolve => setTimeout(resolve, 1000)); continue;
      }
      const response = await fetch(verifier + '/v2/vp-results/' + encodeURIComponent(request.transactionId), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ includeClaims: false, skipStatusChecks: true }),
        signal: AbortSignal.timeout(60_000),
      });
      verifierStatus = response.status;
      const raw = await response.text();
      let body; try { body = JSON.parse(raw); } catch { body = {}; }
      if (typeof body.allChecksSuccessful === 'boolean') {
        verdict = body.allChecksSuccessful;
        const first = body.credentialResults?.[0];
        verifierDetails = { resultKeys: Object.keys(body).slice(0, 20),
          credentialResults: body.credentialResults?.length ?? null,
          credentialProofValid: first?.schemaAndSignatureCheck?.valid ?? null,
          holderProofValid: first?.holderProofCheck?.valid ?? null,
          holderErrorCode: String(first?.holderProofCheck?.error?.errorCode ?? 'none')
            .replace(/[^A-Za-z0-9_]/g, '_').slice(0, 55),
          credentialErrorCode: String(first?.schemaAndSignatureCheck?.error?.errorCode ?? 'none')
            .replace(/[^A-Za-z0-9_]/g, '_').slice(0, 55) };
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const result = { observedAt: new Date().toISOString(), issuerVersion: issued.issuerVersion,
      walletVersion: '0.17.0', mimotoVersion: '0.22.0', verifierVersion: '0.18.2',
      result: submission?.status() === 200 && verdict === true && walletMatchesIssuance
      ? 'LOCAL_WEB_JSONLD_VERIFY_VALID' : 'LOCAL_WEB_JSONLD_VERIFY_NOT_VALID',
      routeStatuses: routes.filter(route => /presentations|credentials|trusted-verifiers/.test(route.path)).slice(-15),
      submissionStatus: submission?.status() ?? null,
      verifierStatus, verifierValid: verdict, verifierDetails,
      walletMatchesIssuance, selectedCredentialMatchesIssuance: true,
      signedRequestAccepted: routes.some(route => route.method === 'POST' &&
        route.path.endsWith('/presentations') && route.status === 200),
      requestEnvelope: 'signed_jwt_by_value_with_client_id',
      errorModalVisible: await page.getByTestId('modal-error-card').isVisible().catch(() => false) };
    if (result.result === 'LOCAL_WEB_JSONLD_VERIFY_VALID')
      await page.screenshot({ path: join(runtime, 'jsonld-presented.png') });
    await writeFile(join(runtime, 'jsonld-presentation-result.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(result));
    if (result.result !== 'LOCAL_WEB_JSONLD_VERIFY_VALID') process.exitCode = 1;
  } finally { await browser.close(); }
}

main().catch(error => {
  console.error(JSON.stringify({ result: 'LOCAL_PRESENTATION_FAILED', stage,
    errorType: error?.name ?? 'unknown', protocolErrorHints,
    routeStatuses: routes.filter(route => /presentations|trusted-verifiers/.test(route.path)).slice(-12),
    code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_PRESENTATION_CHECK_FAILED' }));
  process.exitCode = 1;
});
