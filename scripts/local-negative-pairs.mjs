import { writeFile } from 'node:fs/promises';
import { issueCredential, present } from './local-inji-smoke.mjs';
const issuer = 'http://127.0.0.1:18090';
const rows = [];
for (const scenario of ['expired','wrong_type','altered_disclosure','unreferenced_disclosure','bad_issuer_signature']) {
  const normal = await issueCredential(issuer);
  const control = (await present(normal.credential, normal.holder,'valid')).summary;
  if (control.verifierValid !== true) throw Error('Positive control failed');
  const sample = scenario === 'expired' ? await issueCredential(issuer,true) : normal;
  const result = (await present(sample.credential,sample.holder,scenario)).summary;
  rows.push({scenario,control,outcome:result,expected:'rejected'});
}
await writeFile(process.argv[2], JSON.stringify({observedAt:new Date().toISOString(), issuer:'Certify 1.0.0-alpha.1',verifier:'Verify 0.18.2',format:'dc+sd-jwt',rows},null,2)+'\n',{flag:'wx',mode:0o600});
