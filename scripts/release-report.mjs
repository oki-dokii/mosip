// Render the current public index. Historical run IDs are kept separate from probe cells.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {relative, dirname, resolve} from 'node:path';
import {buildAggregate} from './build-aggregate-report.mjs';
const path='submission/AGGREGATE_REPORT.md';
const {matrix}=await buildAggregate();
const {rows}=JSON.parse(readFileSync('submission/protocol-matrix.json','utf8'));
const gaps=JSON.parse(readFileSync('submission/gaps.json','utf8')).findings;
function link(source){if(!existsSync(source))throw Error('Missing '+source);return relative(dirname(path),source);}
const report=['# Interoperability evidence · 2 November 2026','',
  'The [claims table](CLAIMS_AND_EVIDENCE.md) and [protocol matrix](protocol-matrix.json) cover '+rows.length+' observations. The following '+matrix.records.length+' historical run records overlap with those observations. They are not an additional pass count.','',
  '| Run or observation | Environment | Recorded outcome |','|---|---|---|',
  ...matrix.records.map(r=>'| ['+r.recordId+']('+link(r.source)+') | '+r.deployment+' | '+r.actual+' |'),'',
  '## Protocol evidence by source','','| Source file | Indexed rows |','|---|---:|',
  ...[...new Set(rows.map(r=>r.source))].map(p=>'| ['+p.split('/').pop()+']('+link(p)+') | '+rows.filter(r=>r.source===p).length+' |'),'',
  'The [finding register](../docs/GAPS.md) tracks '+gaps.length+' entries. Two historical reference-holder cells stopped at the configured token endpoint. Both reruns obtained a credential using issuer discovery. Inji Verify returned an invalid verdict; the walt.id verifier run stopped at request retrieval (HTTP 406). The 2 MiB padding request is a size observation without a required verdict.',''].join('\n');
writeFileSync(path,report);
for(const doc of [path,'submission/CLAIMS_AND_EVIDENCE.md','README.md','docs/GAPS.md']){
 const content=readFileSync(doc,'utf8');
 for(const [,url] of content.matchAll(/\]\(([^\s)]+)\)/g)){
  if (/^[a-z]+:|^#/i.test(url))continue;
  if(!existsSync(resolve(dirname(doc),decodeURIComponent(url.split('#')[0]))))throw Error(doc+' has missing link '+url);
 }
}
