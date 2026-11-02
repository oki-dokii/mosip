// Run with the ordinary transparent loopback profile. Output contains checkpoints only.
import {readFile,writeFile} from 'node:fs/promises';
import {issueCredential,present} from '../../scripts/local-inji-smoke.mjs';
const out=process.argv[2], records=[];
const local='http://127.0.0.1:18090';
function mapIssuer(url) {
 const value=new URL(url);
 if(value.origin!=='http://host.docker.internal:7005') throw Error('Unexpected issuer origin');
 value.hostname='127.0.0.1'; return value;
}
for(const issuer of ['Certify','walt.id']){
 for(const verifier of ['Inji Verify','walt.id']){
  const checkpoints=[];
  const row={issuer,wallet:'reference',verifier,checkpoints,status:'stopped'};
  records.push(row);
  try {
   let issued;
   if(issuer==='Certify'){
    issued=await issueCredential(local);checkpoints.push(['issued and independently checked',true]);
   }else{
    const create=await fetch('http://127.0.0.1:7005/issuer2/credential-offers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authMethod:'PRE_AUTHORIZED',valueMode:'BY_REFERENCE',credentials:[{profileId:'identityCredentialSdJwt'}]})});
    checkpoints.push(['offer created',create.status]);if(!create.ok)continue;
    const deep=new URL((await create.json()).credentialOffer);
    const offer=await fetch(mapIssuer(deep.searchParams.get('credential_offer_uri')),{redirect:'error'});
    checkpoints.push(['offer retrieved',offer.status]);if(!offer.ok)continue;
    const code=(await offer.json()).grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
    if(!code)continue;
    // The existing Certify reference-holder profile posts to this path in issueCredential.
    const token=await fetch('http://127.0.0.1:7005/v1/certify/oauth/token',{method:'POST',redirect:'error',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:pre-authorized_code','pre-authorized_code':code,client_id:'wallet'})});
    checkpoints.push(['configured reference token endpoint',token.status]);
    if(token.ok)throw Error('Reference issuer profile needs further implementation');
    continue;
   }
   if(verifier==='Inji Verify'){
    const r=await present(issued.credential,issued.holder,'valid');checkpoints.push(['independent verdict',r.summary.verifierValid]);if(r.summary.verifierValid===true)row.status='valid';
   }else{
    const create=await fetch('http://127.0.0.1:7004/verification-session/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({flow_type:'cross_device',core_flow:{dcql_query:{credentials:[{id:'identity',format:'dc+sd-jwt',meta:{vct_values:['MockVerifiableCredential_SD_JWT']}}]}}})});
    checkpoints.push(['walt verification session',create.status]);
    const bootstrap=new URL((await create.json()).bootstrapAuthorizationRequestUrl);
    const target=new URL(bootstrap.searchParams.get('request_uri'));
    if(target.origin!=='http://host.docker.internal:7004')throw Error('Unexpected verifier origin');
    target.hostname='127.0.0.1';
    const request=await fetch(target,{headers:{accept:'application/oauth-authz-req+jwt'},redirect:'error'});
    checkpoints.push(['signed request retrieval',request.status]);
    if(request.ok){
     const claims=JSON.parse(Buffer.from((await request.text()).split('.')[1],'base64url'));
     checkpoints.push(['presentation_definition available to reference holder',Boolean(claims.presentation_definition)],['DCQL present',Boolean(claims.dcql_query)]);
    }
   }
  }catch{row.status='incomplete';}
 }
}
const baseline=JSON.parse(await readFile(new URL('../../submission/evidence/2026-11-02-walt-adapters/observe.json',import.meta.url)));
for(const issuer of ['Certify','walt.id'])for(const verifier of ['Inji Verify','walt.id']){
 const cell=baseline.rows[issuer==='Certify'?2:verifier==='Inji Verify'?3:1];
 records.push({issuer,wallet:'walt.id',verifier,status:cell.result==='passed'?'valid':'stopped',source:'2026-11-02-walt-adapters/observe.json#'+cell.id,verifierReached:issuer!=='Certify' && verifier==='walt.id',checkpoints:cell.checkpoints.slice(-2),sharedIssuanceFailure:issuer==='Certify'});
}
await writeFile(out,JSON.stringify({format:'SD-JWT',observedAt:new Date().toISOString(),scope:'Reference holder uses its existing Certify token and Presentation Exchange profiles. Shared issuance failures block both verifier choices.',records},null,2)+'\n',{flag:'wx'});
