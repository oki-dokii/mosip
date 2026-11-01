import ts from 'typescript';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const original=readFileSync(new URL('../apps/bff/src/redaction.ts',import.meta.url),'utf8');
const canary='SyntheticCanaryValue';
const corpus=[{authorization:canary},{key:{kty:'RSA',p:canary}},{errors:{code:canary}},{'tоken':canary}];
async function check(source) {
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {redact}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  return corpus.every(sample=>!JSON.stringify(redact(sample).value).includes(canary));
}
assert(await check(original),'Baseline leaked a canary');
for (const guard of ['COMPACT_SECRET_FIELDS.has(compactKey)','jwk && PRIVATE_JWK.has(compactKey)','|| secretCode','/[^\\x20-\\x7E]/.test(rawKey)']) {
  assert(original.includes(guard),'Mutation target changed');
  const mutant=original.replace(guard,guard.startsWith('||')?'|| false':'false');
  assert.equal(await check(mutant),false,'Survived mutation: '+guard);
  console.log('Killed mutation removing',guard);
}
