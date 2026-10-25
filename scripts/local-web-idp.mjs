// Synthetic OAuth2 identity for the opt-in local Inji Web/Mimoto profile only.
// Authorization is automatic for a single fixed fake account. Never expose publicly.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const clientId = 'local-synthetic';
const clientSecret = process.env.LOCAL_IDP_CLIENT_SECRET;
const redirectUri = 'http://127.0.0.1:18093/v1/mimoto/oauth2/callback/google';
const port = Number(process.env.LOCAL_IDP_PORT ?? 8080);
const codes = new Map();
const accessTokens = new Map();

function token() { return randomBytes(32).toString('base64url'); }
function equal(a, b) {
  const left = Buffer.from(a ?? '');
  const right = Buffer.from(b ?? '');
  return left.length === right.length && timingSafeEqual(left, right);
}
function send(response, status, body, type = 'application/json') {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function form(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 8192) request.destroy();
    });
    request.on('end', () => resolve(new URLSearchParams(body)));
    request.on('error', reject);
  });
}

if (!clientSecret || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LOCAL_IDP_CONFIG_INVALID');

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { status: 'UP' });
    if (request.method === 'GET' && url.pathname === '/authorize') {
      if (url.searchParams.get('client_id') !== clientId || url.searchParams.get('redirect_uri') !== redirectUri ||
          url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('state')) return send(response, 400, { error: 'invalid_request' });
      const code = token();
      codes.set(code, { expires: Date.now() + 60_000 });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      target.searchParams.set('state', url.searchParams.get('state'));
      response.writeHead(302, { location: target.toString(), 'cache-control': 'no-store' });
      return response.end();
    }
    if (request.method === 'POST' && url.pathname === '/token') {
      const params = await form(request);
      const basic = request.headers.authorization?.startsWith('Basic ')
        ? Buffer.from(request.headers.authorization.slice(6), 'base64').toString('utf8').split(':') : [];
      const suppliedId = basic[0] ?? params.get('client_id');
      const suppliedSecret = basic[1] ?? params.get('client_secret');
      if (suppliedId !== clientId || !equal(suppliedSecret, clientSecret)) return send(response, 401, { error: 'invalid_client' });
      const code = params.get('code');
      const record = codes.get(code);
      codes.delete(code);
      if (params.get('grant_type') !== 'authorization_code' || params.get('redirect_uri') !== redirectUri ||
          !record || record.expires < Date.now()) return send(response, 400, { error: 'invalid_grant' });
      const accessToken = token();
      accessTokens.set(accessToken, Date.now() + 300_000);
      return send(response, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: 300, scope: 'profile email' });
    }
    if (request.method === 'GET' && url.pathname === '/userinfo') {
      const supplied = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : '';
      const expiry = accessTokens.get(supplied);
      if (!expiry || expiry < Date.now()) return send(response, 401, { error: 'invalid_token' });
      return send(response, 200, {
        sub: 'synthetic-local-user-with-avatar', name: 'Synthetic Local User', email: ['wallet', 'example.invalid'].join('@'),
        email_verified: true, picture: 'http://127.0.0.1:18093/favicon.ico', phone_number: '',
      });
    }
    if (request.method === 'GET' && url.pathname === '/jwks') return send(response, 200, { keys: [] });
    return send(response, 404, { error: 'not_found' });
  } catch {
    return send(response, 400, { error: 'invalid_request' });
  }
}).listen(port, '0.0.0.0');
