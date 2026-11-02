// A credential-library check, not an OpenID4VP endpoint or holder-binding verdict.
import assert from 'node:assert/strict';
import {createHash,verify,X509Certificate} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {decodeProtectedHeader} from 'jose';
import {SDJwtInstance} from '@sd-jwt/core';
import {issueCredential} from '../../scripts/local-inji-smoke.mjs';
const issuer='http://127.0.0.1:18090';
const pin=await issueCredential(issuer);
const key=new X509Certificate(Buffer.from(decodeProtectedHeader(pin.credential.split('~')[0]).x5c[0],'base64')).publicKey;
const instance=new SDJwtInstance({
  hasher:(data,alg)=>{assert.equal(alg,'sha-256');return createHash('sha256').update(Buffer.from(data)).digest();},
  verifier:(data,sig)=>verify('RSA-SHA256',Buffer.from(data),key,Buffer.from(sig,'base64url'))
});
const {credential}=await issueCredential(issuer);
async function check(encoded){try{const {payload}=await instance.verify(encoded);return payload.iss===issuer && payload.vct==='MockVerifiableCredential_SD_JWT';}catch{return false;}}
const accepted=await check(credential);assert(accepted,'Positive control failed');
const [jwt,...disclosures]=credential.split('~'),parts=jwt.split('.');
parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
const damagedAccepted=await check([parts.join('.'),...disclosures].join('~'));
assert(!damagedAccepted,'Damaged signature accepted');
await writeFile(process.argv[2],JSON.stringify({observedAt:new Date().toISOString(),issuer:'local Certify 1.0.0-alpha.1',verifier:'@sd-jwt/core 0.24.1 + Node RSA verifier callback',format:'SD-JWT',scope:'Credential and disclosures only; issuer key pinned from a separate trusted loopback control. No wallet presentation, PKI trust-chain or OpenID4VP verdict.',accepted,damagedAccepted},null,2)+'\n',{flag:'wx'});
