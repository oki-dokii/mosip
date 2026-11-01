// Exports only projected observations. Never copy request bodies or credentials.
import { readFileSync, writeFileSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const [sd='submission/evidence/2026-11-01-protocol/sd.json',ld='submission/evidence/2026-11-01-protocol/ld.json',out='submission/protocol-matrix.json'] = process.argv.slice(2);
const rows = [];
const jwt='https://www.rfc-editor.org/rfc/rfc7519.html', jws='https://www.rfc-editor.org/rfc/rfc7515.html#section-5.2', sdjwt='https://www.rfc-editor.org/rfc/rfc9901.html', vp='https://openid.net/specs/openid-4-verifiable-presentations-1_0.html', vc='https://www.w3.org/TR/vc-data-model/', suite='https://www.w3.org/TR/vc-data-integrity/';
function spec(id) {
 if (id.startsWith('j1')) return /credential|control/.test(id) ? vc : suite;
 if (id.endsWith('expired')) return jwt+'#section-4.1.4';
 if (/not_yet_valid/.test(id)) return jwt+'#section-4.1.5';
 if (/signature/.test(id)) return jws;
 if (/disclosure/.test(id)) return sdjwt+'#section-7.1';
 if (/binding|holder|nonce|audience|replay/.test(id) && !/state/.test(id)) return sdjwt+'#section-7.3';
 if (/structure/.test(id)) return sdjwt+'#section-5';
 return vp;
}
for (const [path,cat] of [[sd,'wallet'],[ld,'jsonld']]) {
 const doc=read(path),catalog=read('spikes/'+cat+'-interop-cases.json');
 for (const c of catalog.cases) {
  const r=doc.results.find(x=>x.caseId===c.id);
  if (!r || doc.profile!==catalog.profile) throw Error('Missing or incompatible probe: '+c.id);
  rows.push({id:c.id,environment:'local mock',format:cat==='wallet'?'SD-JWT':'JSON-LD',variable:r.singleVariableMutated??c.fault,control:r.control?.caseId??null,controlPassed:r.control?.passed??(r.control?.verdict==="correct_acceptance"),expected:c.expected.outcome,observed:r.observed.outcome,verdict:r.verdict,spec:spec(c.id),source:path,observedAt:doc.timestamp});
 }
}
const local='submission/evidence/2026-10-25-local-inji-extended-matrix.json', l=read(local);
for(const c of l.cases) {
 const expected=c.scenario==='valid'?'valid':'invalid';
 const observed=c.verifierValid===null?'transport HTTP '+c.directPostHttpStatus:c.verifierValid?'valid':'invalid';
 rows.push({id:'inji.'+c.scenario,environment:'local Inji '+l.verifierVersion,format:'SD-JWT',variable:c.scenario,control:'inji.valid',controlPassed:l.cases.find(c=>c.scenario==='valid')?.verifierValid===true,expected,observed,verdict:observed.startsWith('transport')?'rejected at transport':observed===expected?'matched':'unexpected acceptance',spec:spec(c.scenario),source:local,observedAt:l.observedAt});
}
const hosted='spikes/fixtures/wallet-interop-live-2026-10-22.json', h=read(hosted);
for(const {label,report:{run}} of h.runs) rows.push({id:'collab.'+label,environment:'Collab (build unreported)',format:'SD-JWT',variable:label,control:'collab.x509_control',controlPassed:h.runs.find(x=>x.label==='x509_control')?.report.run.actualOutcome==='valid',expected:run.expectedOutcome,observed:run.actualOutcome,verdict:run.evaluation.verdict,spec:spec(label),source:hosted,observedAt:run.finishedAt});
if(new Set(rows.map(r=>r.id)).size!==rows.length) throw Error('Duplicate matrix ID');
const hostedLd='spikes/fixtures/collab-reference-wallet-jsonld-2026-10-20.json';
const hv=read(hostedLd).verification;
writeFileSync(out, JSON.stringify({additionalControls:[{format:'JSON-LD',environment:'Collab (build unreported)',date:'2026-10-20',source:hostedLd,passed:hv.allChecksSuccessful===true&&hv.credentialProofValid===true&&hv.holderProofValid===true}],scope:'Environment-specific cells, not unique faults. Specification links provide context; type, trust, disclosure selection and transport policy depend on the named profile. Local Inji and Collab observations are archived.',rows},null,2)+'\n');
console.log(rows.length+' evidence-linked cells');
