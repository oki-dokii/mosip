import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {decodeJwt,SignJWT} from 'jose';
const alpha='http://127.0.0.1:18082';
const post=(body)=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'error'});
export async function alphaPresent(credential,holder,scenario='valid',previous){
  const vct=decodeJwt(credential.split('~')[0]).vct;
  const clientId='decentralized_identifier:did:web:localhost%3A18082:v1:verify',nonce=randomUUID();
  const create=await fetch(alpha+'/v2/vp-request',post({clientId,nonce,dcqlQuery:{credentials:[{id:'credential',format:'dc+sd-jwt',meta:{vct_values:[vct]}}]},responseCodeValidationRequired:false}));
  assert.equal(create.status,201);const ids=await create.json();
  const req=await fetch(alpha+'/v2/vp-request/'+encodeURIComponent(ids.requestId),{headers:{accept:'application/oauth-authz-req+jwt'},redirect:'error'});assert.equal(req.status,200);
  const claims=decodeJwt(await req.text());assert.equal(claims.nonce,nonce);
  const route=new URL(claims.response_uri);assert.equal(route.origin,alpha);assert(['/v1/verify/v2/vp-submission/direct-post','/v2/vp-submission/direct-post'].includes(route.pathname));
  const prefix=credential.endsWith('~')?credential:credential+'~';
  const kb=await new SignJWT({aud:scenario==='wrong_audience'?'did:example:other':claims.client_id,nonce:scenario==='wrong_nonce'?randomUUID():nonce,sd_hash:createHash('sha256').update(prefix).digest('base64url')}).setProtectedHeader({alg:'EdDSA',typ:'kb+jwt'}).setIssuedAt().sign(holder.privateKey);
  const token=previous??(scenario==='missing_key_binding'?prefix:prefix+kb);
  const submit=await fetch(alpha+'/v2/vp-submission/direct-post',{method:'POST',body:new URLSearchParams({state:claims.state,vp_token:JSON.stringify({[scenario==='wrong_query_id'?'unrequested':'credential']:[token]})}),redirect:'error'});
  if(!submit.ok)return {token,summary:{post:submit.status,stage:'transport rejection',http:null,valid:null,signature:null,code:null}};
  const result=await fetch(alpha+'/v2/vp-results/'+encodeURIComponent(ids.transactionId),post({includeClaims:false,skipStatusChecks:true}));
  const body=await result.json(),check=body.credentialResults?.[0]?.schemaAndSignatureCheck;
  return {token,summary:{post:submit.status,http:result.status,valid:body.allChecksSuccessful??null,signature:check?.valid??null,code:check?.error?.errorCode??null}};
}
