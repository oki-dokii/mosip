#!/usr/bin/env node
// Readiness only: no credential/token requests, body dumps or evidence-tier promotion.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const catalogUrl = new URL('../deploy/endpoints.json', import.meta.url);
export function leakFree(text) {
  return ![/\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
    /"(?:d|p|q|dp|dq|qi|access_token|pre-authorized_code)"\s*:\s*"[^"\s]+"/,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/].some(pattern => pattern.test(text));
}
export async function runSmoke({ catalog, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  catalog ??= JSON.parse(await readFile(catalogUrl, 'utf8'));
  const web = catalog.stacks.inji_web_mimoto.services;
  const verify = catalog.stacks.official_certify_verify.services.inji_verify;
  const certify = catalog.stacks.official_certify_verify.services.inji_certify;
  const checks = [
    ['verify.health', `${verify.publicBrowserOrigin}/v1/verify/actuator/health`, body => body?.status === 'UP'],
    ['certify.metadata', certify.issuerMetadataUrl, body =>
      typeof (body?.credential_issuer ?? body?.issuer) === 'string' &&
      typeof body?.credential_endpoint === 'string'],
    ['web.health', `${web.inji_web.publicBrowserOrigin}/`, () => true],
    ['mimoto.catalog', web.mimoto.issuerCatalogUrl, body => JSON.stringify(body).includes('LocalFarmer')],
    ['mimoto.configuration', `${web.inji_web.publicBrowserOrigin}/v1/mimoto/issuers/LocalFarmer/configuration`, body =>
      (body?.errors?.length ?? 0) === 0 && Object.keys(body?.response?.credentials_supported ?? {}).length > 0],
    ['idp.health', `${web.synthetic_idp.publicBrowserOrigin}/health`, () => true],
    // The synthetic IdP issues HS256 tokens; an empty public JWKS is intentional.
    ['idp.jwks', `${web.synthetic_idp.publicBrowserOrigin}/jwks`, body => Array.isArray(body?.keys)],
    ['bridge.discovery', `${catalog.connectedJsonld.bridgeOrigin}/.well-known/oauth-authorization-server`, body =>
      body?.grant_types_supported?.includes('authorization_code')],
  ];
  const results = [];
  for (const [id, url, predicate] of checks) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); } catch { body = null; }
      results.push({ id, passed: response.status === 200 && leakFree(text) && Boolean(predicate(body)),
        code: response.status === 200 ? (leakFree(text) ? 'READINESS_CHECK' : 'LEAK_DETECTED') : 'HTTP_FAILURE' });
    } catch {
      // Never echo server errors, URLs with unexpected values, or response bodies.
      results.push({ id, passed: false, code: 'UNREACHABLE_OR_TIMEOUT' });
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = await runSmoke();
    for (const row of results) console.log(`${row.passed ? 'PASS' : 'FAIL'} ${row.id} ${row.code}`);
    const failed = results.filter(row => !row.passed).length;
    console.log(`LOCAL READINESS: ${results.length - failed}/${results.length} passed`);
    console.log('Readiness does not prove issuance, presentation, login, or a BFF-managed run.');
    console.log('Wallet validation: pnpm demo:web-jsonld; adapters/limits: deploy/INJI_WEB_LOCAL.md');
    process.exitCode = failed ? 1 : 0;
  } catch {
    console.error('LOCAL_SMOKE_CONFIGURATION_FAILED');
    process.exitCode = 1;
  }
}
