// Synthetic loopback comparison. Only statuses and public verifier codes leave this process.
import assert from 'node:assert/strict';
import {createPrivateKey,createPublicKey,generateKeyPairSync,X509Certificate} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeJwt,exportJWK,jwtVerify,SignJWT} from 'jose';
import {issueCredential as mockIssue,configurationId} from '../apps/mock-issuer/dist/credential.js';
import {present} from './local-inji-smoke.mjs';
import {alphaPresent} from './alpha-presentation.mjs';
const [output,privateOutput]=process.argv.slice(2);
const dir=mkdtempSync(join(tmpdir(),'issuer-profile-')),holder=generateKeyPairSync('ed25519'),rows=[],scenarios=[];
try{
  for(const alg of ['RS256','ES256']){
    const keyPath=join(dir,'key'),certPath=join(dir,'cert');
    execFileSync('openssl',['req','-x509','-newkey',...(alg==='RS256'?['rsa:2048']:['ec','-pkeyopt','ec_paramgen_curve:prime256v1']),'-nodes','-days','1','-subj','/CN=synthetic','-keyout',keyPath,'-out',certPath],{stdio:'ignore'});
    const privateKey=createPrivateKey(readFileSync(keyPath)),publicKey=createPublicKey(privateKey),cert=new X509Certificate(readFileSync(certPath));
    const issuer='did:jwk:'+Buffer.from(JSON.stringify(await exportJWK(publicKey))).toString('base64url');
    const header={alg,typ:'dc+sd-jwt',kid:issuer+'#0'};
    const options={signer:{issuer,header,privateKey},holderPublicJwk:await exportJWK(holder.publicKey),variant:'valid',now:Math.floor(Date.now()/1000)};
    const original=await mockIssue(options);
    const [jwt,...disclosures]=original.split('~');
    for(const x5c of [true,false]){
      const signed=await new SignJWT(decodeJwt(jwt)).setProtectedHeader({...header,...(x5c?{x5c:[cert.raw.toString('base64')]}:{})}).sign(privateKey);
      await jwtVerify(signed,publicKey,{issuer,algorithms:[alg]});
      const credential=[signed,...disclosures].join('~');
      const old=(await present(credential,holder,'valid',undefined,{alg,vct:configurationId})).summary;
      const newer=await alphaPresent(credential,holder);
      rows.push({alg,x5c,issuerSignatureChecked:true,stable:{http:old.verifierHttpStatus,valid:old.verifierValid,signature:old.credentialProofValid,code:old.resultCode},alpha:newer.summary});
      if(alg==='RS256' && x5c && newer.summary.valid===true && privateOutput){
        for(const scenario of ['expired','wrong_audience','wrong_nonce','missing_key_binding','wrong_query_id','replay']){
          const control=await alphaPresent(credential,holder);assert.equal(control.summary.valid,true);
          const sample=scenario==='expired'?await mockIssue({...options,variant:'expired',signer:{...options.signer,header:{...header,x5c:[cert.raw.toString('base64')]}}}):credential;
          const changed=await alphaPresent(sample,holder,scenario,scenario==='replay'?control.token:undefined);
          scenarios.push({scenario,control:control.summary,changed:changed.summary});
        }
      }
    }
  }
  writeFileSync(output,JSON.stringify({observedAt:new Date().toISOString(),stable:'0.18.2 PEX',alpha:'1.0.0-alpha.1 DCQL, local route adapter',issuer:'synthetic did:jwk',holder:'same Ed25519 key, cnf.jwk',rows},null,2)+'\n',{flag:'wx'});
  if(privateOutput)writeFileSync(privateOutput,JSON.stringify(scenarios,null,2),{flag:'wx',mode:0o600});
}finally{rmSync(dir,{recursive:true,force:true});}
