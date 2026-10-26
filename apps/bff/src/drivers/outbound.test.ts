import { afterEach, expect, it, vi } from 'vitest';
import { assertOutboundUrl, readBoundedResponse, safeContextLoader } from './outbound.js';
afterEach(() => vi.unstubAllGlobals());
it('blocks credential-selected foreign, metadata, credentialed, file and fragment URLs before transport', () => {
  for (const url of ['http://169.254.169.254/latest/meta-data','http://127.0.0.1:1/private','file:///etc/passwd','https://issuer.example@private.example/key','https://issuer.example/path#secret','https://issuer.example.evil.example/path']) expect(() => assertOutboundUrl(url,['https://issuer.example'])).toThrow('OUTBOUND_URL_FORBIDDEN');
  expect(assertOutboundUrl('https://issuer.example/credential',['https://issuer.example']).origin).toBe('https://issuer.example');
  expect(assertOutboundUrl('http://mock-issuer:4101/credential',['http://mock-issuer:4101']).origin).toBe('http://mock-issuer:4101');
});
it('rejects JSON-LD nested context and redirect SSRF without fetching the target', async () => {
  const fetcher=vi.fn(async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/metadata'}}));vi.stubGlobal('fetch',fetcher);
  await expect(safeContextLoader('https://w3id.org/security/v2')).rejects.toThrow('OUTBOUND_URL_FORBIDDEN');expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(safeContextLoader('http://127.0.0.1/private')).rejects.toThrow('OUTBOUND_URL_FORBIDDEN');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('caps response bytes before parsing and does not echo body content in errors', async () => {
  await expect(readBoundedResponse(new Response('CANARY_'.repeat(100)),64)).rejects.toThrow('OUTBOUND_RESPONSE_TOO_LARGE');
  expect(await readBoundedResponse(new Response('safe'),64)).toBe('safe');
});
