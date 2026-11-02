import { validBridgeToken } from "./capture/live-bridge.js";
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { IncomingMessage } from 'node:http';
export function accessConfigured() { return (process.env.PLAYGROUND_ACCESS_TOKEN?.length ?? 0) >= 32; }
export function assertAccessConfiguration() {
  if ((process.env.PLAYGROUND_ACCESS_TOKEN && !accessConfigured()) || (process.env.PLAYGROUND_PUBLIC_MODE === 'true' && !accessConfigured())) throw new Error('ACCESS_TOKEN_MINIMUM_32_REQUIRED');
}
export function authorized(header: unknown): boolean {
  const expected = process.env.PLAYGROUND_ACCESS_TOKEN;
  if (!expected) return true;
  if (!accessConfigured() || typeof header !== 'string') return false;
  let candidate = '';
  if (header.startsWith('Bearer ')) candidate = header.slice(7);
  else if (/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header)) {
    const basic = Buffer.from(header.slice(6), 'base64').toString('utf8');
    if (!basic.startsWith('playground:')) return false;
    candidate = basic.slice(11);
  }
  const a = Buffer.from(candidate), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
  res.removeHeader('X-Powered-By'); next();
};
export const accessGate: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' && (req.path === '/api/v1/health' || req.path === '/')) return next();
  const bridgeRoute = req.path.startsWith('/api/v1/capture/local/') || /^\/api\/v1\/assisted\/runs\/[^/]+\/capture\/observation$/.test(req.path);
  if (bridgeRoute && validBridgeToken(req.get('x-capture-bridge-token'))) return next();
  if (!authorized(req.get('authorization'))) {
    res.set('WWW-Authenticate', 'Basic realm="Synthetic playground", charset="UTF-8"');
    res.set('Cache-Control', 'no-store'); return void res.status(401).json({ code: 'ACCESS_REQUIRED' });
  }
  if (accessConfigured() && !['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== (process.env.WEB_ORIGIN ?? 'http://localhost:5173')) return void res.status(403).json({ code: 'ORIGIN_FORBIDDEN' });
  next();
};
export function socketAllowed(req: IncomingMessage) {
  if (!authorized(req.headers.authorization)) return false;
  return !accessConfigured() || !req.headers.origin || req.headers.origin === (process.env.WEB_ORIGIN ?? 'http://localhost:5173');
}
