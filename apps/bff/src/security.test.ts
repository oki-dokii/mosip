import { afterEach, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { Server as SocketServer } from 'socket.io';
import { Server } from 'socket.io';
import { buildApp } from './app.js';
import { MemoryRunRepository } from './store.js';
import { authorized, assertAccessConfiguration, socketAllowed } from './security.js';
const previous = { ...process.env };
afterEach(() => { process.env = { ...previous }; });
it('requires a strong configured token in public mode and rejects malformed credentials', () => {
  process.env.PLAYGROUND_PUBLIC_MODE = 'true'; delete process.env.PLAYGROUND_ACCESS_TOKEN;
  expect(assertAccessConfiguration).toThrow('ACCESS_TOKEN_MINIMUM_32_REQUIRED');
  process.env.PLAYGROUND_ACCESS_TOKEN = 'CANARY_ACCESS_'.repeat(4);
  expect(assertAccessConfiguration).not.toThrow();
  expect(authorized('Bearer ' + process.env.PLAYGROUND_ACCESS_TOKEN)).toBe(true);
  expect(authorized('Basic ' + Buffer.from('playground:' + process.env.PLAYGROUND_ACCESS_TOKEN).toString('base64'))).toBe(true);
  for (const header of [undefined, 'Bearer wrong', 'Basic !!!', 'Basic ' + Buffer.from('wrong:' + process.env.PLAYGROUND_ACCESS_TOKEN).toString('base64')]) expect(authorized(header)).toBe(false);
});
it('protects reports, writes and Engine.IO; keeps health readable and refuses foreign write origins', async () => {
  process.env.PLAYGROUND_ACCESS_TOKEN = 'CANARY_ACCESS_'.repeat(4);
  process.env.CAPTURE_BRIDGE_TOKEN = 'CANARY_BRIDGE_'.repeat(4);
  process.env.ASSISTED_LOCAL_PROFILE = 'jsonld-0.14';
  let io: SocketServer;
  const server = createServer(buildApp(() => io, new MemoryRunRepository()));
  io = new Server(server, { allowRequest: (request, done) => done(null, socketAllowed(request)) });
  server.listen(0,'127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + (server.address() as { port:number }).port;
  const auth = { authorization: 'Bearer ' + process.env.PLAYGROUND_ACCESS_TOKEN };
  try {
    expect((await fetch(base + '/api/v1/health')).status).toBe(200);
    const denied = await fetch(base + '/api/v1/runs'); expect(denied.status).toBe(401); expect(await denied.text()).not.toContain('CANARY_');
    const ok = await fetch(base + '/api/v1/runs', { headers: auth }); expect(ok.status).toBe(200);
    expect(ok.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(ok.headers.get('x-powered-by')).toBeNull();
    const bridge = { 'x-capture-bridge-token': process.env.CAPTURE_BRIDGE_TOKEN! };
    expect((await fetch(base + '/api/v1/capture/local/session', { headers:bridge })).status).toBe(200);
    expect((await fetch(base + '/api/v1/runs', { headers:bridge })).status).toBe(401);
    expect((await fetch(base + '/api/v1/capture/local/session', { headers:{ 'x-capture-bridge-token':'wrong' } })).status).toBe(401);
    expect((await fetch(base + '/api/v1/runs', { method:'POST', headers:{ ...auth, origin:'https://foreign.example', 'content-type':'application/json' }, body:'{}' })).status).toBe(403);
    expect((await fetch(base + '/socket.io/?EIO=4&transport=polling')).status).toBe(403);
    const allowed = await fetch(base + '/socket.io/?EIO=4&transport=polling', { headers:auth }); expect(allowed.status).toBe(200); await allowed.text();
  } finally { await new Promise<void>(resolve => io.close(() => resolve())); }
});
