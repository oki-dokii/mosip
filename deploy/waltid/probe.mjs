// Only fixed checkpoint labels/statuses leave the process. Synthetic account and credentials
// stay inside this isolated demo wallet. Do not point this runner at production.
import { randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const W='http://127.0.0.1:7006', I='http://127.0.0.1:7005', V='http://127.0.0.1:7004';
const C='http://127.0.0.1:18090/v1/certify', IV='http://127.0.0.1:18081/v1/verify';
const rows=[]; let row, bearer, wallet, keyId, vct, stored=false;
const mark=(label,status)=>row.checkpoints.push({label,status});
async function http(label,url,body) {
 let r;
 try { r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000),method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(url.startsWith(W+'/')&&bearer?{Authorization:'Bearer '+bearer}:{})},body:body===undefined?undefined:JSON.stringify(body)}); }
 catch {mark(label,'unreachable');throw Error();}
 mark(label,r.status); if(!r.ok)throw Error(); return r.json().catch(()=>null);
}
async function cell(id,test) {
 row={id,checkpoints:[],result:'not_completed'};rows.push(row);
 try {await test();row.result='passed';}catch {/* Failure boundary already recorded. */}
}
const expect=(label,test)=>{mark(label,Boolean(test));if(!test)throw Error();};
await cell('walt-issuer-to-walt-wallet',async()=>{
 const metadata=await http("read issuer metadata",I+"/.well-known/openid-credential-issuer/openid4vci");
 vct=metadata?.credential_configurations_supported?.identity_credential?.vct; expect("SD-JWT type advertised",typeof vct==="string"&&vct.length);
 const auth={email:'synthetic-'+randomUUID()+'@example.invalid',password:randomBytes(24).toString('hex')};
 await http('create synthetic account',W+'/auth/register',auth);
 bearer=(await http('authenticate',W+'/auth/emailpass',auth))?.token;expect('session established',bearer);
 wallet=(await http('create wallet',W+'/wallet',{}))?.walletId;expect('wallet created',wallet);
 keyId=(await http('generate holder key',W+'/wallet/'+wallet+'/keys/generate',{backend:'jwk'}))?.keyId;expect('holder key available',keyId);
 const offer=(await http('create SD-JWT offer',I+'/issuer2/credential-offers',{authMethod:'PRE_AUTHORIZED',valueMode:'BY_REFERENCE',credentials:[{profileId:'identityCredentialSdJwt'}]}))?.credentialOffer;expect('offer returned',offer);
 await http('wallet receive',W+'/wallet/'+wallet+'/credentials/receive',{offerUrl:offer,keyId});
 const list=await http('wallet inventory',W+'/wallet/'+wallet+'/credentials');stored=Array.isArray(list)&&list.length>0;expect('credential stored',stored);
});
async function presentAtWalt(requestedType, expectedStatus) {
 expect('walt issuance control',stored);
 const req=await http('create DCQL request',V+'/verification-session/create',{flow_type:'cross_device',core_flow:{dcql_query:{credentials:[{id:'identity',format:'dc+sd-jwt',meta:{vct_values:[requestedType]}}]}}});
 await http('present credential',W+'/wallet/'+wallet+'/credentials/present',{requestUrl:req.bootstrapAuthorizationRequestUrl,keyId});
 const verdict=await http('independent verifier result',V+'/verification-session/'+encodeURIComponent(req.sessionId)+'/info');
 mark('session status', ['SUCCESSFUL','FAILED','CREATED','PENDING'].includes(verdict?.status) ? verdict.status : 'other');
 if (expectedStatus==='SUCCESSFUL') expect('verifier accepted credential',verdict?.status==='SUCCESSFUL'&&Object.values(verdict.presented_credentials??{}).some(v=>Array.isArray(v)&&v.length));
 else expect('verifier recorded failed session',verdict?.status===expectedStatus);
}
await cell('walt-wallet-to-walt-verifier',()=>presentAtWalt(vct,'SUCCESSFUL'));
if (process.argv.includes('--example-control')) await cell('walt-swagger-example-vct',async()=>{
 const api=await http('read verifier OpenAPI',V+'/api.json');
 const example=api.paths['/verification-session/create'].post.requestBody.content['application/json'].examples['[openid4vp-http][sd-jwt pid]'];
 const demoType=example.value.core_flow.dcql_query.credentials[0].meta.vct_values[0];
 expect('example type differs from installed issuer metadata',demoType!==vct);
 await presentAtWalt(demoType,'FAILED');
});
await cell('certify-offer-to-walt-wallet',async()=>{
 expect('authenticated wallet available',bearer&&wallet&&keyId);
 const now=Math.floor(Date.now()/1000);
 const offer=await http('create Certify offer',C+'/pre-authorized-data',{credential_configuration_id:'MockVerifiableCredential_SD_JWT',claims:{given_name:'Synthetic',family_name:'Example',issuedAt:now,expiresAt:now+86400},expires_in:600});
 expect('Certify offer returned',offer?.credential_offer_uri);
 if (process.argv.includes('--diagnose')) {
   const ref=new URL(offer.credential_offer_uri).searchParams.get('credential_offer_uri');
   expect('offer reference on local Certify origin',ref && new URL(ref).origin===new URL(C).origin);
   const resolvedOffer=await http('fetch offer by reference',ref);
   expect('offer advertises origin-only credential issuer',resolvedOffer?.credential_issuer===new URL(C).origin);
   const discovery=await fetch(resolvedOffer.credential_issuer+'/.well-known/openid-credential-issuer',{redirect:'error',signal:AbortSignal.timeout(10000)});
   mark('metadata at offer-advertised issuer',discovery.status);
   await discovery.body?.cancel();
   await http('read Certify issuer metadata',C+'/.well-known/openid-credential-issuer');
   await http('wallet resolve Certify offer',W+'/wallet/'+wallet+'/credentials/receive/resolve-offer',{offerUrl:offer.credential_offer_uri});
 }
 const before=await http('wallet inventory before',W+'/wallet/'+wallet+'/credentials');
 await http('wallet receive Certify offer',W+'/wallet/'+wallet+'/credentials/receive',{offerUrl:offer.credential_offer_uri,keyId});
 const after=await http('wallet inventory after',W+'/wallet/'+wallet+'/credentials');expect('new card stored',Array.isArray(after)&&after.length===before.length+1);
});
await cell('walt-credential-to-inji-verify',async()=>{
 expect('walt credential present',stored);
 const clientId='did:web:localhost%3A18081:v1:verify';
 const req=await http('create Inji Verify request',IV+'/vp-request',{clientId,nonce:randomBytes(24).toString('base64url'),responseCodeValidationRequired:false,presentationDefinition:{id:randomUUID(),input_descriptors:[{id:'credential',format:{'vc+sd-jwt':{alg:['ES256']}},constraints:{fields:[{path:['$.vct'],filter:{type:'string',const:vct}}]}}]}});
 const requestUrl='openid4vp://?'+new URLSearchParams({client_id:clientId,request_uri:req.requestUri});
 if (process.argv.includes('--diagnose')) {
   expect('request on local Verify origin',new URL(req.requestUri).origin===new URL(IV).origin);
   for(const accept of ['application/json','*/*']) {
     const alternate=await fetch(req.requestUri,{headers:{accept},redirect:'error',signal:AbortSignal.timeout(10000)});
     mark('request object with Accept '+accept,alternate.status); await alternate.body?.cancel();
   }
   const signed=await fetch(req.requestUri,{headers:{accept:'application/oauth-authz-req+jwt'},redirect:'error',signal:AbortSignal.timeout(10000)});
   mark('retrieve Inji request object',signed.status);
   const parts=(await signed.text()).split('.');
   expect('compact signed request returned',signed.ok && parts.length===3);
   const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   mark('signed client_id equals configured DID',claims.client_id===clientId);
   mark('signed aud present',Object.hasOwn(claims,'aud'));
   mark('signed aud contains static discovery audience',[claims.aud].flat().includes('https://self-issued.me/v2'));
   await http('wallet resolve Inji request',W+'/wallet/'+wallet+'/credentials/present/resolve-request',{requestUrl});
 }
 await http('wallet present to Inji Verify',W+'/wallet/'+wallet+'/credentials/present',{keyId,requestUrl});
 const verdict=await http('independent Verify verdict',IV+'/v2/vp-results/'+encodeURIComponent(req.transactionId),{includeClaims:false,skipStatusChecks:true});
 expect('Verify accepted credential',verdict?.allChecksSuccessful===true);
});
const report={observedAt:new Date().toISOString(),versions:{walt:'1.2.0',certify:'1.0.0-alpha.1',injiVerify:'0.18.2'},scope:'Local synthetic fixtures. An HTTP failure is an observed checkpoint, not a verifier decision.',rows};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows));process.exitCode=rows.every(x=>x.result==='passed')?0:1;
