import { writeFile } from 'node:fs/promises';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import jsigs from 'jsonld-signatures';
import { createBaseCredential,buildDocumentLoader } from '../spikes/jsonld-interop-probes.mjs';

const url='http://127.0.0.1:18081/v1/verify/v2/vc-verification';
const key=await Ed25519VerificationKey2020.generate();
key.controller='did:key:'+key.fingerprint();
key.id=key.controller+'#'+key.fingerprint();
const documentLoader=buildDocumentLoader(key,key);
const signed=async (overrides={})=>jsigs.sign(await createBaseCredential({issuer:key.controller,...overrides}),{
  suite:new Ed25519Signature2020({key}),purpose:new jsigs.purposes.AssertionProofPurpose(),documentLoader
});
async function verify(body) {
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body,signal:AbortSignal.timeout(30000)});
  const result=await response.json().catch(()=>null);
  return {http:response.status,valid:result?.allChecksSuccessful??null};
}
const encode=credential=>JSON.stringify({verifiableCredential:JSON.stringify(credential),includeClaims:false,skipStatusChecks:true});
const rows=[];
for(const scenario of ['signed_expired','missing_proof','changed_subject','malformed_body','oversized_body']){
  const valid=await signed();
  const control=await verify(encode(valid));
  if(control.valid!==true){rows.push({scenario,control,status:'blocked_at_control'});break;}
  let body;
  if(scenario==='signed_expired')body=encode(await signed({issuanceDate:'2020-01-01T00:00:00Z',expirationDate:'2020-01-02T00:00:00Z'}));
  if(scenario==='missing_proof'){delete valid.proof;body=encode(valid);}
  if(scenario==='changed_subject'){valid.credentialSubject.fullName='Synthetic Change';body=encode(valid);}
  if(scenario==='malformed_body')body='{';
  if(scenario==='oversized_body')body=JSON.stringify({padding:'a'.repeat(2*1024*1024),...JSON.parse(encode(valid))});
  rows.push({scenario,control,actual:await verify(body),expected:scenario.endsWith('_body')?'4xx':'invalid'});
}
await writeFile(process.argv[2],JSON.stringify({observedAt:new Date().toISOString(),format:'JSON-LD',verifier:'Verify 0.18.2',issuer:'synthetic did:key',rows},null,2)+'\n',{flag:'wx',mode:0o600});
