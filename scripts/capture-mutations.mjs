// Exercise real capture tests with one source substitution in Vite's in-memory transform.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const scratch=mkdtempSync(join(tmpdir(),'capture-mutants-'));
const cases=[
  ['public-view','!subjectNames.has(name)','false'],
  ['filter','entries.length > 20_000','false'],
];
try {
  for(const [module,before,after] of cases){
    for(const mutate of [false,true]){
      const path=join(scratch,'vitest.config.mjs');
      writeFileSync(path,'export default '+`{plugins:[{name:"capture-mutation",enforce:"pre",transform(source,id){
        if(!id.endsWith(${JSON.stringify('/capture/'+module+'.ts')}))return;
        if(!source.includes(${JSON.stringify(before)}))throw Error("Mutation target missing");
        return {code:source.replace(${JSON.stringify(before)},${JSON.stringify(mutate?after:before)}),map:null};
      }}]}`);
      const r=spawnSync('pnpm',['exec','vitest','run','--config',path,'--reporter=json','src/capture/'+module+'.test.ts'],{cwd:resolve('apps/bff'),encoding:'utf8'});
      const report=JSON.parse(r.stdout);
      assert(report.numPassedTests>0 && report.numTotalTestSuites>0,'No working test suite');
      if(mutate)assert(r.status===1 && report.testResults.some(s=>s.assertionResults.some(a=>a.status==='failed'&&a.failureMessages.some(m=>/AssertionError/.test(m)))),'Mutant survived or failed outside an assertion: '+module);
      else assert.equal(r.status,0,'Baseline failed: '+module);
    }
    console.log('Killed capture mutation:',module,before);
  }
} finally {rmSync(scratch,{recursive:true,force:true});}
