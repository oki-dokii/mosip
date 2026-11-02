// Disposable HTTP relay inside the wallet network namespace. Never log URLs or bodies.
import http from 'node:http';
const asAlias = process.env.WALT_EXPERIMENT === 'as-alias';
const sdOnly = asAlias || process.env.WALT_EXPERIMENT === 'sd-only';
const adapt = process.env.WALT_EXPERIMENT === 'adapt' || sdOnly;
for (const port of [18081,18090]) http.createServer((req,res)=>{
  let path=req.url;
  const headers={...req.headers};
  const object=port===18081 && req.method==='GET' && /^\/v1\/verify\/(?:v2\/)?vp-request\/[^/?]+$/.test(path);
  const discovery=port===18090 && req.method==='GET' && path==='/.well-known/openid-credential-issuer';
  const authDiscovery=port===18090 && req.method==='GET' && ['/.well-known/oauth-authorization-server','/.well-known/openid-configuration'].includes(path);
  if(authDiscovery && asAlias && path==='/.well-known/oauth-authorization-server') path='/v1/certify'+path;
  const incoming=headers.accept;
  if(object && adapt) headers.accept='application/oauth-authz-req+jwt';
  if(discovery && adapt) path='/v1/certify'+path;
  const peer=http.request({hostname:'host.docker.internal',port,path,method:req.method,headers},r=>{
    if(authDiscovery) console.log(JSON.stringify({checkpoint:'authorization-server discovery',requested:'http://127.0.0.1:18090'+req.url,forwarded:path,status:r.statusCode}));
    if(object || discovery) console.log(JSON.stringify({checkpoint:object?'request-object':'issuer-discovery',adapter:adapt,status:r.statusCode,...(object?{accept:incoming===undefined?null:incoming.length<=256 && incoming.split(',').every(t=>/^\s*(?:application\/(?:json|jwt|oauth-authz-req\+jwt|x-www-form-urlencoded)|text\/(?:plain|html)|\*\/\*)(?:\s*;\s*q=[01](?:\.[0-9]{1,3})?)?\s*$/i.test(t))?incoming:'unclassified'}:{})}));
    if (sdOnly && discovery && r.statusCode === 200) {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', chunk => { body += chunk; if (body.length > 262144) r.destroy(); });
      r.on('error', () => res.destroy());
      r.on('end', () => {
        try {
          const metadata = JSON.parse(body);
          const id = 'MockVerifiableCredential_SD_JWT';
          const selected = metadata.credential_configurations_supported[id];
          if (selected?.format !== 'dc+sd-jwt') throw Error();
          metadata.credential_configurations_supported = { [id]: selected };
          res.writeHead(200, {'content-type':'application/json'});
          res.end(JSON.stringify(metadata));
        } catch { res.writeHead(502); res.end(); }
      });
      return;
    }
    res.writeHead(r.statusCode,r.headers);r.pipe(res);
  });
  peer.on('error',()=>{res.writeHead(502);res.end();});
  req.on('aborted',()=>peer.destroy());req.pipe(peer);
}).listen(port,'127.0.0.1');
