// Project public observations only. Matched controls and companion runs stay in their
// source records so they do not inflate the number of independently varied cases.
import { readFileSync } from 'node:fs';
const folder = 'submission/evidence/2026-11-02-wallet-profile/';
function load(file) {
  const source = folder + file + '.json';
  const data = JSON.parse(readFileSync(source, 'utf8'));
  return { data, base: { source, observedAt: data.observedAt } };
}
export function novemberRows() {
  const rows = [];
  for (const [file,format] of [['public-negative-pairs','SD-JWT'],['jsonld-pairs','JSON-LD']]) {
    const {data,base} = load(file);
    for (const pair of data.rows) {
      const status = pair.actual?.http ?? pair.outcome.verifierHttpStatus;
      const valid = pair.actual ? pair.actual.valid : pair.outcome.verifierValid;
      const size = pair.scenario === 'oversized_body';
      const passed = (pair.control.valid ?? pair.control.verifierValid) === true;
      const match = pair.expected === '4xx' ? status >= 400 && status < 500 : valid === false;
      rows.push({...base,id:'nov2.'+file+'.'+pair.scenario,group:'paired check',environment:'local Inji Verify 0.18.2',format,variable:pair.scenario,
        control:pair.scenario+' paired valid credential',controlPassed:passed,expected:size?null:pair.expected,
        observed:(size?'2 MiB padding, ':'')+'HTTP '+status+(valid===null?'':valid?', valid':', invalid'),
        verdict:size?'observation':!passed?'inconclusive':match?'matched':'unexpected result'});
    }
  }
  const grid = load('sd-grid');
  for (const r of grid.data.records) {
    const [step,status] = Array.isArray(r.checkpoints.at(-1)) ? r.checkpoints.at(-1) : [r.checkpoints.at(-1).label,r.checkpoints.at(-1).status];
    const harness = r.issuer==='walt.id' && r.wallet==='reference' && step==='configured reference token endpoint' && status===404;
    rows.push({...grid.base,id:'grid.'+[r.issuer,r.wallet,r.verifier].join('/'),group:'role grid',environment:'local Inji / walt.id',format:'SD-JWT',
      variable:[r.issuer,r.wallet,r.verifier].join(' → '),expected:null,observed:step+' = '+status,
      verdict:harness?'harness-limited':r.sharedIssuanceFailure?'blocked at shared issuance':r.status,
      ...(r.source?{upstreamRecord:r.source}:{})});
  }
  for (const [file,indices] of [['control',[2,3]],['sd-only',[2]],['public-url',[3]]]) {
    const {data,base} = load(file);
    for (const index of indices) {
      const r=data.rows[index], checkpoint=r.checkpoints.at(-1);
      rows.push({...base,id:r.id,group:'adapter experiment',environment:'local Inji / walt.id 1.2.0',format:'SD-JWT',variable:file,
        control:data.rows.slice(0,2).map(c=>c.id).join(', '),controlPassed:data.rows.slice(0,2).every(c=>c.result==='passed'),
        expected:null,observed:checkpoint.label+' HTTP '+checkpoint.status,verdict:r.result==='passed'?'adapter completed':'stopped before verifier verdict'});
    }
  }
  const hosted=load('collab-refresh');
  for (const r of hosted.data.runs) rows.push({...hosted.base,id:'nov2.collab.'+r.label,group:'Collab refresh',format:'SD-JWT',
    environment:'Collab (build unreported)',variable:r.label,expected:null,observed:r.actual,verdict:r.evaluation,runId:r.runId});
  for (const r of hosted.data.preauthorized) rows.push({...hosted.base,id:'nov2.collab.'+r.configurationId,group:'Collab refresh',
    environment:'Collab (build unreported)',format:r.configurationId.endsWith('SD_JWT')?'SD-JWT':'JSON-LD',variable:r.configurationId,
    expected:null,observed:'credential HTTP '+r.checkpoints.credential,verdict:r.conclusion});
  const source='submission/evidence/2026-11-02-release/grid.json';
  const rerun=JSON.parse(readFileSync(source,'utf8'));
  const control=rerun.records.find(r=>r.issuer==='Certify' && r.wallet==='reference' && r.verifier==='Inji Verify');
  for(const r of rerun.records.filter(r=>r.issuer==='walt.id' && r.wallet==='reference')){
    const [step,value]=r.checkpoints.at(-1);
    rows.push({source,observedAt:rerun.observedAt,id:'grid.discovery.'+r.verifier,group:'issuer discovery rerun',
      environment:'local walt.id 1.2.0 / Inji Verify 0.18.2',format:'SD-JWT',variable:'reference holder follows advertised endpoints → '+r.verifier,
      control:'Certify → reference → Inji Verify (same run)',controlPassed:control?.status==='valid',expected:null,
      observed:step+' = '+value,verdict:step==='independent verdict' && value===false?'invalid':'stopped before verifier verdict'});
  }
  const shapeSource='submission/evidence/2026-11-02-release/accept-any-shape.json';
  const shape=JSON.parse(readFileSync(shapeSource,'utf8'));
  for(const r of shape.records.filter(r=>r.wallet==='reference' && r.verifier==='walt.id')){
    const cp=Object.fromEntries(r.checkpoints);
    const strict=rerun.records.find(c=>c.wallet===r.wallet && c.issuer===r.issuer && c.verifier===r.verifier);
    rows.push({id:'grid.accept-any.'+r.issuer,source:shapeSource,observedAt:shape.observedAt,
      group:'media type variant',environment:'local walt.id 1.2.0 verifier',format:'SD-JWT',variable:r.issuer+' → reference → walt.id; Accept: */*',
      control:source,controlPassed:Object.fromEntries(strict.checkpoints)['signed request retrieval']===406,
      expected:null,observed:'HTTP '+cp['signed request retrieval']+'; JSON media type = '+cp['JSON media type']+'; compact signed request = '+cp['compact signed request'],
      verdict:'stopped before verifier verdict'});
  }
  const librarySource='submission/evidence/2026-11-02-release/openwallet.json';
  const library=JSON.parse(readFileSync(librarySource,'utf8'));
  rows.push({id:'openwallet.credential.damaged_signature',source:librarySource,observedAt:library.observedAt,group:'credential library',
    environment:library.issuer+' / '+library.verifier,format:library.format,variable:'damaged issuer signature',control:'fresh unmodified credential',
    controlPassed:library.accepted,expected:'rejected',observed:library.damagedAccepted?'accepted':'rejected',
    verdict:library.accepted&&!library.damagedAccepted?'matched':'inconclusive',scope:library.scope});
  return rows;
}
