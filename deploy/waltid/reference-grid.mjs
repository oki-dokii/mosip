// Run with the ordinary transparent loopback profile. Output contains checkpoints only.
import {readFile,writeFile} from 'node:fs/promises';
import {alphaPresent} from '../../scripts/alpha-presentation.mjs';
import {issueCredential,present} from '../../scripts/local-inji-smoke.mjs';
import {execFileSync} from 'node:child_process';
import { createPrivateKey, X509Certificate, generateKeyPairSync } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader, exportJWK, SignJWT } from 'jose';
const out=process.argv[2], records=[];
const wildcard=process.argv[3]==='--accept-any';
const dcFormat=process.argv[3]==='--dc-format';
const withChain=process.argv[3]==='--native-x5c';
const diagnose=withChain || process.argv[3]==='--diagnose-credential';
let chain,certificatePem;
if(withChain){
 const profile=await (await fetch('http://127.0.0.1:7005/issuer2/profiles/identityCredentialSdJwt',{redirect:'error'})).json();
 const key=createPrivateKey({key:profile.issuerKey.jwk,format:'jwk'});
 const pem=execFileSync('openssl',['req','-new','-x509','-key','/dev/stdin','-days','1','-subj','/CN=Local synthetic walt issuer'],{input:key.export({type:'pkcs8',format:'pem'}),stdio:['pipe','pipe','ignore']});
 certificatePem=pem.toString();
 chain=new X509Certificate(pem).raw.toString('base64');
}
if(process.argv[3] && !wildcard && !dcFormat && !diagnose) throw Error('Unknown grid variant');
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
    const create=await fetch('http://127.0.0.1:7005/issuer2/credential-offers',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({authMethod:'PRE_AUTHORIZED',valueMode:'BY_REFERENCE',credentials:[{profileId:'identityCredentialSdJwt',...(withChain?{runtimeOverrides:{x5Chain:[certificatePem]}}:{})}]})});
    checkpoints.push(['offer created',create.status]);if(!create.ok)continue;
    const deep=new URL((await create.json()).credentialOffer);
    const offer=await fetch(mapIssuer(deep.searchParams.get('credential_offer_uri')),{redirect:'error'});
    checkpoints.push(['offer retrieved',offer.status]);if(!offer.ok)continue;
    const code=(await offer.json()).grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
    if(!code)continue;
    const metadata=await (await fetch(mapIssuer('http://host.docker.internal:7005/.well-known/openid-credential-issuer/openid4vci'))).json();
    const auth=await (await fetch(mapIssuer('http://host.docker.internal:7005/.well-known/oauth-authorization-server/openid4vci'))).json();
    const token=await fetch(mapIssuer(auth.token_endpoint),{method:'POST',redirect:'error',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:pre-authorized_code','pre-authorized_code':code,client_id:'wallet'})});
    checkpoints.push(['advertised token endpoint',token.status]);if(!token.ok)continue;
    const grant=await token.json();
    const nonce=await fetch(mapIssuer(metadata.nonce_endpoint),{method:'POST',redirect:'error'});
    checkpoints.push(['issuer nonce',nonce.status]);if(!nonce.ok)continue;
    const holder=generateKeyPairSync('ed25519');
    const key=await exportJWK(holder.publicKey);
    const proof=await new SignJWT({nonce:(await nonce.json()).c_nonce}).setAudience(metadata.credential_issuer).setIssuedAt()
      .setProtectedHeader({typ:'openid4vci-proof+jwt',alg:'EdDSA',jwk:key}).sign(holder.privateKey);
    const identifier=grant.authorization_details?.[0]?.credential_identifiers?.[0];
    const selector=identifier?{credential_identifier:identifier}:{credential_configuration_id:'identity_credential'};
    const response=await fetch(mapIssuer(metadata.credential_endpoint),{method:'POST',redirect:'error',headers:{authorization:'Bearer '+grant.access_token,'content-type':'application/json'},body:JSON.stringify({...selector,proofs:{jwt:[proof]}})});
    checkpoints.push(['credential response',response.status]);if(!response.ok)continue;
    const credential=(await response.json()).credentials?.[0]?.credential;
    if(typeof credential!=='string')throw Error('Credential unavailable');
    issued={credential,holder};
   }
   if(verifier==='Inji Verify'){
    const r=await present(issued.credential,issued.holder,'valid',undefined,{format:dcFormat?'dc+sd-jwt':'vc+sd-jwt',vct:decodeJwt(issued.credential.split('~')[0]).vct,alg:decodeProtectedHeader(issued.credential.split('~')[0]).alg});checkpoints.push(['independent verdict',r.summary.verifierValid]);if(r.summary.verifierValid===true)row.status='valid';
    if(diagnose){
      const [jwt,...parts]=issued.credential.split('~');
      const header=decodeProtectedHeader(jwt), claims=decodeJwt(jwt);
      if(withChain && issuer==='walt.id')row.requestedChainPresent=header.x5c?.[0]===chain;
      row.credentialProfile={alg:header.alg,typ:header.typ,x5cCount:header.x5c?.length??0,hasKid:!!header.kid,hasJwk:!!header.jwk,
        issuerScheme:String(claims.iss).split(':').slice(0,String(claims.iss).startsWith('did:')?2:1).join(':'),
        holderBinding:claims.cnf?.jwk?'jwk':claims.cnf?.kid?'kid':'other',vct:claims.vct,
        hasExpiry:typeof claims.exp==='number',disclosureCount:parts.filter(Boolean).length};
      const {credentialProofValid,holderProofValid,resultCode,verifierHttpStatus}=r.summary;
      row.verification={credentialProofValid,holderProofValid,resultCode,verifierHttpStatus};
      row.alphaVerification=(await alphaPresent(issued.credential,issued.holder)).summary;
    }
   }else{
    const create=await fetch('http://127.0.0.1:7004/verification-session/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({flow_type:'cross_device',core_flow:{dcql_query:{credentials:[{id:'identity',format:'dc+sd-jwt',meta:{vct_values:[decodeJwt(issued.credential.split('~')[0]).vct]}}]}}})});
    checkpoints.push(['walt verification session',create.status]);
    const bootstrap=new URL((await create.json()).bootstrapAuthorizationRequestUrl);
    const target=new URL(bootstrap.searchParams.get('request_uri'));
    if(target.origin!=='http://host.docker.internal:7004')throw Error('Unexpected verifier origin');
    target.hostname='127.0.0.1';
    const request=await fetch(target,{headers:{accept:wildcard?'*/*':'application/oauth-authz-req+jwt'},redirect:'error'});
    checkpoints.push(['signed request retrieval',request.status]);
    if(request.ok){
     const body=await request.text();
     const media=(request.headers.get('content-type')??'').split(';')[0];
     checkpoints.push(['JSON media type',media==='application/json']);
     const compact=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(body.trim());
     checkpoints.push(['compact signed request',compact]);
     if(!compact)continue;
     const claims=decodeJwt(body.trim());
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
await writeFile(out,JSON.stringify({format:'SD-JWT',observedAt:new Date().toISOString(),presentationFormat:dcFormat?'dc+sd-jwt':'vc+sd-jwt',requestRetrievalAccept:wildcard?'*/*':'application/oauth-authz-req+jwt',scope:'Reference holder uses the walt.id advertised token endpoint. Shared issuance failures block both verifier choices.',records},null,2)+'\n',{flag:'wx'});
