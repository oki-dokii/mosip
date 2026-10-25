import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmoke, leakFree } from './smoke-local-full.mjs';

const healthy = async url => {
  let body = {};
  if (url.includes('actuator')) body = { status: 'UP' };
  else if (url.includes('openid-credential-issuer')) body = { credential_issuer: 'http://localhost', credential_endpoint: 'http://localhost/credential' };
  else if (url.endsWith('/issuers')) body = { issuers: ['LocalFarmer'] };
  else if (url.endsWith('/configuration')) body = { response: { credentials_supported: { Farmer: {} } } };
  else if (url.endsWith('/jwks')) body = { keys: [] };
  else if (url.endsWith('oauth-authorization-server')) body = { grant_types_supported: ['authorization_code'] };
  return { status: 200, text: async () => JSON.stringify(body) };
};
test('readiness accepts current metadata and intentional empty synthetic JWKS', async () => {
  const results = await runSmoke({ fetchImpl: healthy });
  assert.equal(results.length, 8);
  assert.ok(results.every(row => row.passed));
});
test('unavailable service fails without echoing exception details', async () => {
  const results = await runSmoke({ fetchImpl: async () => { throw Error('PRIVATE_CANARY'); } });
  assert.ok(results.every(row => !row.passed));
  assert.ok(!JSON.stringify(results).includes('PRIVATE_CANARY'));
});
test('non-200 and invalid configuration cannot pass', async () => {
  for (const status of [400, 503]) {
    const results = await runSmoke({ fetchImpl: async () => ({ status, text: async () => '{"private":"CANARY"}' }) });
    assert.ok(results.every(row => !row.passed));
    assert.ok(!JSON.stringify(results).includes('CANARY'));
  }
});
test('private response material fails readiness and stays out of results', async () => {
  const results = await runSmoke({ fetchImpl: async () => ({ status: 200, text: async () => '{"access_token":"CANARY_PRIVATE"}' }) });
  assert.ok(results.every(row => !row.passed && row.code === 'LEAK_DETECTED'));
  assert.ok(!JSON.stringify(results).includes('CANARY_PRIVATE'));
  assert.equal(leakFree('{"keys":[]}'), true);
});
