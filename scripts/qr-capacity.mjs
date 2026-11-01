// Synthetic wire shapes only. No wallet input, signing keys or QR payload is exported.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const qr = require('qrcode');
const pixel = require('@mosip/pixelpass');
const opaque = (seed, n) => Buffer.concat(Array.from({length:Math.ceil(n/32)}, (_,i) =>
  createHash('sha256').update(seed + ':' + i).digest())).subarray(0,n).toString('base64url');
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const rows = [];
for (const count of [4, 32, 96]) {
  const claims = Array.from({length:count}, (_,i) => ['field'+i, opaque('sample'+i,16)]);
  const disclosures = claims.map(([k,v]) => b64([opaque('salt'+k,16),k,v]));
  const samples = {
    'JSON-LD':JSON.stringify({'@context':['https://www.w3.org/2018/credentials/v1'],type:['VerifiableCredential'],issuer:'did:example:issuer',credentialSubject:Object.fromEntries(claims),proof:{type:'Ed25519Signature2020',proofValue:opaque('proof',64)}}),
    'SD-JWT':[b64({alg:'ES256',typ:'dc+sd-jwt'})+'.'+b64({iss:'https://issuer.example',vct:'urn:example:test',_sd_alg:'sha-256',_sd:disclosures.map(d=>createHash('sha256').update(d).digest('base64url'))})+'.'+opaque('signature',64), ...disclosures,''].join('~')
  };
  for (const [format,input] of Object.entries(samples)) {
    const packed = pixel.generateQRData(input);
    if (pixel.decode(packed)!==input) throw Error('PixelPass round trip failed');
    const measure = data => {
      try { return qr.create(data,{errorCorrectionLevel:'M'}).version; }
      catch (e) { if (/too big/i.test(e.message)) return null; throw e; }
    };
    rows.push({format, claims:count, bytes:Buffer.byteLength(input), packedBytes:Buffer.byteLength(packed), rawVersion:measure(input), packedVersion:measure(packed)});
  }
}
writeFileSync(new URL('../apps/web/src/data/qr.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
