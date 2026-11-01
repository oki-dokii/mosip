// Two-stage local demo preserves user activation for the browser wallet prompt.
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
const origin='http://localhost:18101';
const endpoint='http://127.0.0.1:7004/verification-session';
const sessions=new Map();
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Local wallet presentation</title><main><h1>Present a synthetic credential</h1><p>Use the walt.id identity SD-JWT issued by the local interoperability profile.</p><button id="prepare">Prepare Digital Credentials request</button> <button id="present" disabled>Choose a wallet</button><p><a id="native">Prepare same-device wallet link</a></p><button id="link">Create same-device request</button><p id="status" role="status"></p></main><script type="module">
let pending;const el=id=>document.getElementById(id);const post=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error();return r.json()};
el('prepare').onclick=async()=>{try{pending=await post('/prepare',{});el('present').disabled=false;el('status').textContent='Verifier request ready.'}catch{el('status').textContent='Local verifier unavailable.'}};
el('present').onclick=async()=>{el('present').disabled=true;try{const response=await navigator.credentials.get({digital:{requests:[{protocol:'openid4vp-v1-unsigned',data:pending.request}]}});const result=await post('/finish',{handle:pending.handle,data:response.data});el('status').textContent='Verifier status: '+result.status}catch(e){el('status').textContent='Wallet response unavailable ('+e.name+'). Prepare a fresh request to try again.'}};
el('link').onclick=async()=>{try{const r=await post('/native',{});el('native').href=r.link;el('native').textContent='Open wallet on this device'}catch{el('status').textContent='Could not prepare wallet link.'}};
</script></html>`;
async function upstream(path,body){
 const res=await fetch(endpoint+path,{signal:AbortSignal.timeout(10000),redirect:'error',method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!res.ok) throw Error();return res.json();
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data))};
 if(req.headers.host!=='localhost:18101')return json(403,{error:'invalid_host'});
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end(html)}
 if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json')return json(403,{error:'invalid_request'});
 try{
  if(req.url==='/prepare'||req.url==='/native'){
   const dc=req.url==='/prepare';
   const meta=await(await fetch('http://127.0.0.1:7005/.well-known/openid-credential-issuer/openid4vci',{signal:AbortSignal.timeout(5000)})).json();
   const query={credentials:[{id:'identity',format:'dc+sd-jwt',meta:{vct_values:[meta.credential_configurations_supported.identity_credential.vct]}}]};
   const session=await upstream('/create',dc?{flow_type:'dc_api_openid4vp',openid:{},expectedOrigins:[origin],core_flow:{signed_request:false,encrypted_response:false,dcql_query:query}}:{flow_type:'cross_device',core_flow:{dcql_query:query}});
   if(!dc){const link=new URL(session.bootstrapAuthorizationRequestUrl);if(link.protocol!=='openid4vp:')throw Error();return json(200,{link:link.href})}
   const info=await upstream('/'+encodeURIComponent(session.sessionId)+'/info');
   if(info.authorizationRequest?.response_mode!=='dc_api')throw Error();
   for(const [key,value] of sessions)if(value.until<Date.now())sessions.delete(key);
   if(sessions.size>=128)return json(429,{error:'too_many_sessions'});
   const handle=randomUUID();sessions.set(handle,{id:session.sessionId,until:Date.now()+120000});
   return json(200,{handle,request:info.authorizationRequest});
  }
  if(req.url==='/finish'){
   let bytes=0;const parts=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>131072)return json(413,{error:'size'});parts.push(chunk)}
   const {handle,data}=JSON.parse(Buffer.concat(parts));const active=sessions.get(handle);sessions.delete(handle);
   if(!active||active.until<Date.now()||!data||typeof data!=='object')return json(400,{error:'expired_or_invalid'});
   const session='/'+encodeURIComponent(active.id);
   await upstream(session+'/response',data);
   const info=await upstream(session+'/info');
   return json(200,{status:['SUCCESSFUL','FAILED'].includes(info.status)?info.status:'pending'});
  }
  json(404,{error:'unknown_route'});
 }catch{json(502,{error:'request_failed'})}
});
server.listen(18101,'127.0.0.1',()=>console.log('Open http://localhost:18101'));
