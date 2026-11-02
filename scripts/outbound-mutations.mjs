import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../apps/bff/src/drivers/outbound.ts',import.meta.url),'utf8');
const origin = 'https://issuer.example';
async function accepts(input, url) {
  const js = ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {assertOutboundUrl} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  try { assertOutboundUrl(url,[origin]); return true; } catch { return false; }
}
assert(await accepts(source, origin+'/metadata'));
for(const [guard,url] of [['url.username','https://user'+'@'+'issuer.example'],['url.hash',origin+'/#secret'],['!origins.includes(url.origin)','https://other.example']]){
  assert(source.includes(guard));
  assert.equal(await accepts(source,url),false);
  assert.equal(await accepts(source.replace(guard,'false'),url),true);
  console.log('Killed outbound guard mutation',guard);
}
