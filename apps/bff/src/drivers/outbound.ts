// Credential-selected endpoints may only use trusted, administrator-configured origins.
export function assertOutboundUrl(value: string, roots: readonly string[]) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('OUTBOUND_URL_FORBIDDEN'); }
  const origins = roots.filter(Boolean).map(root => new URL(root).origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || !origins.includes(url.origin)) throw new Error('OUTBOUND_URL_FORBIDDEN');
  return url;
}
export async function readBoundedResponse(response: Response, max = 2_097_152) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Buffer[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { void reader.cancel(); throw new Error('OUTBOUND_RESPONSE_TOO_LARGE'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
const contextOrigins = ['https://www.w3.org', 'https://w3id.org', 'https://w3c.github.io', 'https://w3c-ccg.github.io', 'https://digitalbazaar.github.io', 'https://inji.github.io', 'https://mosip.github.io'];
export async function safeContextLoader(value: string) {
  let url = value;
  for (let redirects = 0; redirects < 4; redirects++) {
    assertOutboundUrl(url, contextOrigins);
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { accept: 'application/ld+json, application/json' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('CONTEXT_REDIRECT_INVALID');
      url = new URL(location, url).href;
      void response.body?.cancel(); continue;
    }
    if (!response.ok) throw new Error('CONTEXT_UNAVAILABLE');
    const document = JSON.parse(await readBoundedResponse(response, 262144));
    return { contextUrl: null, documentUrl: url, document };
  }
  throw new Error('CONTEXT_REDIRECT_LIMIT');
}
