// Check the public index without printing evidence bodies.
import { readFileSync, statSync } from 'node:fs';
const { findings } = JSON.parse(readFileSync('submission/gaps.json', 'utf8'));
const ids = findings.map(f => f.id);
const rows = readFileSync('docs/GAPS.md','utf8').split('\n').filter(l => /^\| G-\d+ \|/.test(l));
if (new Set(ids).size !== ids.length || rows.length !== ids.length) throw Error('Gap register counts or IDs differ');
for (const f of findings) {
  if (!f.cause?.trim()) throw Error(f.id+' needs a diagnosed cause or an explicit unknown');
  const row = rows.filter(l => l.startsWith('| '+f.id+' |'));
  if (row.length !== 1 || row[0].split('|').length !== 8) throw Error(f.id+' needs one six-column table row');
  if (!f.evidence.length || !f.evidence.every(p => statSync(p).isFile())) throw Error(f.id+' lacks evidence');
}
console.log(ids.length+' indexed findings with evidence');
