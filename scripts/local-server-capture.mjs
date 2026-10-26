// Runs inside the canonical loopback/TLS forwarder. Raw bodies stay in memory.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function createServerCapture({ settings, project, fetchImpl = fetch }) {
  if (!settings || !/^http:\/\/(?:host\.docker\.internal|127\.0\.0\.1):[0-9]{2,5}$/.test(settings.bffOrigin) ||
      typeof settings.token !== 'string' || settings.token.length < 32) throw new Error('LOCAL_CAPTURE_SETTINGS_INVALID');
  const routes = { certify: /^\/v1\/certify\/(?:\.well-known\/openid-credential-issuer|oauth\/token|issuance\/credential)$/,
    verify: /^\/v1\/verify\/(?:vp-request\/[A-Za-z0-9_-]{1,200}|vp-submission\/direct-post)$/ };
  async function api(path, value) {
    const response = await fetchImpl(settings.bffOrigin + '/api/v1/capture/local/' + path, {
      method: value === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { 'x-capture-bridge-token': settings.token, 'content-type': 'application/json' },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }), signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      let result; try { result = await response.json(); } catch { /* no body exported */ }
      const known = new Set(['LOCAL_CAPTURE_INVALID', 'LOCAL_CAPTURE_ROUTE', 'LOCAL_CAPTURE_WINDOW', 'LOCAL_CAPTURE_LEASE_EXPIRED', 'LOCAL_CAPTURE_FORBIDDEN', 'CAPTURE_RATE_LIMITED']);
      throw new Error(known.has(result?.code) ? result.code : 'LOCAL_CAPTURE_PERSIST_FAILED');
    }
    return response.json();
  }
  return async function forward(url, options, service) {
    const path = new URL(url).pathname;
    if (!routes[service]?.test(path)) return fetchImpl(url, options);
    // Snapshot before forwarding. Never claim an old in-flight response for a new run.
    const { lease } = await api('session');
    const started = Date.now();
    const response = await fetchImpl(url, options);
    if (!lease) return response;
    const reader = response.clone().body?.getReader();
    const chunks = []; let size = 0;
    if (reader) try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_097_152) { void reader.cancel(); throw new Error('LOCAL_CAPTURE_RESPONSE_LIMIT'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    const requestBytes = options.body ? Buffer.from(options.body.toString()) : Buffer.alloc(0);
    let input = null, output = null;
    const type = new Headers(options.headers).get('content-type') ?? '';
    try { input = type.includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(requestBytes.toString('utf8'))) : JSON.parse(requestBytes.toString('utf8')); } catch { /* opaque */ }
    try { output = JSON.parse(bytes.toString('utf8')); } catch { /* signed request remains opaque */ }
    await api('observations', { ...lease, expiresAt: undefined, observationId: randomUUID(), service,
      method: options.method ?? 'GET', path, observedAt: new Date(started).toISOString(),
      durationMs: Math.min(120000, Date.now() - started), status: response.status,
      ...(service === 'verify' && path.endsWith('/direct-post') && typeof input?.state === 'string' ? { state: input.state } : {}),
      requestView: project(input), responseView: project(output) });
    return response; // Original protocol body/headers untouched; capture is a side effect.
  };
}
let forwarder;
export async function capturedFetch(url, options, service) {
  if (forwarder === undefined) {
    let settings;
    try { settings = JSON.parse(readFileSync('/app/capture/settings.json', 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') { forwarder = null; } else throw new Error('LOCAL_CAPTURE_SETTINGS_INVALID'); }
    if (settings) {
      const { serverHopPublicView } = await import(pathToFileURL('/app/capture/public-view.mjs').href);
      forwarder = createServerCapture({ settings, project: serverHopPublicView });
    }
  }
  return forwarder ? forwarder(url, options, service) : fetch(url, options);
}
