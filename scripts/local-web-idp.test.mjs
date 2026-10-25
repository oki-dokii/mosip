import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./local-web-idp.mjs', import.meta.url));
const redirectUri = 'http://127.0.0.1:18093/v1/mimoto/oauth2/callback/google';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  server.close();
  await once(server, 'close');
  return port;
}

test('synthetic IdP binds one-time codes to its fixed client and redirect', async () => {
  const port = await freePort();
  const secret = randomBytes(24).toString('base64url');
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, LOCAL_IDP_PORT: String(port), LOCAL_IDP_CLIENT_SECRET: secret },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { ready = (await fetch(base + '/health')).ok; } catch { /* startup pending */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(ready, true);
    const bad = new URL(base + '/authorize');
    bad.search = new URLSearchParams({ client_id: 'local-synthetic', redirect_uri: 'http://wrong.invalid/', response_type: 'code', state: 'test-state' }).toString();
    assert.equal((await fetch(bad)).status, 400);
    const authorize = new URL(base + '/authorize');
    authorize.search = new URLSearchParams({ client_id: 'local-synthetic', redirect_uri: redirectUri, response_type: 'code', state: 'test-state' }).toString();
    const accepted = await fetch(authorize, { redirect: 'manual' });
    assert.equal(accepted.status, 302);
    const target = new URL(accepted.headers.get('location'));
    assert.equal(target.origin + target.pathname, redirectUri);
    assert.equal(target.searchParams.get('state'), 'test-state');
    const code = target.searchParams.get('code');
    const body = new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: redirectUri, code });
    const wrongSecret = await fetch(base + '/token', { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from('local-synthetic:wrong').toString('base64') }, body });
    assert.equal(wrongSecret.status, 401);
    const auth = { authorization: 'Basic ' + Buffer.from('local-synthetic:' + secret).toString('base64') };
    const tokenResponse = await fetch(base + '/token', { method: 'POST', headers: auth, body });
    assert.equal(tokenResponse.status, 200);
    const issued = await tokenResponse.json();
    assert.equal(typeof issued.access_token, 'string');
    assert.equal((await fetch(base + '/token', { method: 'POST', headers: auth, body })).status, 400);
    const userinfo = await fetch(base + '/userinfo', { headers: { authorization: 'Bearer ' + issued.access_token } });
    assert.equal(userinfo.status, 200);
    assert.equal((await userinfo.json()).sub, 'synthetic-local-user-with-avatar');
    assert.equal((await fetch(base + '/userinfo')).status, 401);
  } finally {
    child.kill();
    await once(child, 'exit');
  }
});
