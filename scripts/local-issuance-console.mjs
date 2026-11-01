// Local operator UI for both pinned Inji deployments. Offers and QR payloads
// stay in memory, with no browser storage or HTTP access log.
import {createServer} from 'node:http';
import QRCode from 'qrcode';
const origin='http://localhost:18102';
const wallet='http://127.0.0.1:18093/';
const page=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Local issuance lab</title><style>body{max-width:58rem;margin:2rem auto;font:1.1rem system-ui}section{display:flex;flex-wrap:wrap;gap:2rem}svg{width:19rem}</style><main><h1>Local issuance lab</h1><label>Grant <select id="grant"><option value="pre">Pre-authorized SD-JWT</option><option value="auth">Authorization code with PKCE · JSON-LD</option></select></label> <button id="prepare">Prepare QR</button><section><div id="qr"></div><div><h2>Synthetic test data</h2><p id="help">Select a grant and prepare its QR.</p><a id="open"></a></div></section></main><script type="module">
const find=id=>document.getElementById(id);find('prepare').onclick=async()=>{find('qr').replaceChildren();find('open').removeAttribute('href');find('open').textContent='';const type=find('grant').value;try{const r=await fetch('/'+type,{method:'POST'});if(!r.ok)throw Error();const data=await r.json();find('qr').innerHTML=data.svg;find('help').textContent=data.instructions;find('open').href=data.url;find('open').textContent='Open on this device'}catch{find('help').textContent='Start the matching local profile and try again.'}};
</script></html>`;
createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.headers.host!=='localhost:18102'){res.writeHead(403).end();return}
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html'}).end(page);return}
 if(req.method!=='POST'||req.headers.origin!==origin){res.writeHead(403).end();return}
 try{
  let url,instructions;
  if(req.url==='/auth'){
   const r=await fetch('http://127.0.0.1:18096/.well-known/oauth-authorization-server',{signal:AbortSignal.timeout(4000)});
   if(!(await r.json()).grant_types_supported?.includes('authorization_code'))throw Error();
   url=wallet;instructions='Wallet launch QR. Select Playground Synthetic Farmer. Demo UIN: SYNTHETIC-001. Demo OTP: 246810 when the interactive fixture is enabled.';
  }else if(req.url==='/pre'){
   const now=Math.floor(Date.now()/1000);
   const r=await fetch('http://127.0.0.1:18090/v1/certify/pre-authorized-data',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'content-type':'application/json'},body:JSON.stringify({credential_configuration_id:'MockVerifiableCredential_SD_JWT',claims:{given_name:'Ada',family_name:'Example',issuedAt:now,expiresAt:now+600},expires_in:600})});
   const data=await r.json();url=data.credential_offer_uri;
   if(!r.ok||typeof url!=='string'||new URL(new URL(url).searchParams.get('credential_offer_uri')).origin!=='http://127.0.0.1:18090')throw Error();
   instructions='Fresh credential offer for Ada Example. This grant requires neither UIN nor OTP.';
  }else{res.writeHead(404).end();return}
  res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({url,instructions,svg:await QRCode.toString(url,{type:'svg'})}));
 }catch{res.writeHead(503).end()}
}).listen(18102,'127.0.0.1',()=>console.log('Open http://localhost:18102'));
