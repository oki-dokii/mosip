import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MemoryRunRepository, PrismaRunRepository, type RunRecord, type RunRepository } from './store.js';
import { withArchivedA1, ARCHIVED_A1_RUN_ID } from './archivedA1.js';
import { backupRuns, pruneRuns } from './maintenance.js';
import { createSteps } from './orchestrator.js';
const record=(status='passed',id=randomUUID()):RunRecord=>({run:{id,parentRunId:null,config:{issuer:'mock_issuer',wallet:'reference_wallet',verifier:'mock_verifier',format:'vc_sd_jwt',flow:'cross_device',tamper:null,scenarioId:null},status:status as any,expectedOutcome:'valid',actualOutcome:status==='passed'?'valid':null,proofType:'kb+jwt',algorithm:'EdDSA',createdAt:'2020-01-01T00:00:00.000Z',startedAt:null,finishedAt:status==='running'?null:'2020-01-02T00:00:00.000Z'},steps:createSteps(id),exchanges:[]});
async function exercise(repository:RunRepository){
 const old=record(),active=record('running'),recent=record();recent.run.finishedAt='2099-01-01T00:00:00.000Z';
 for(const value of [old,active,recent]) { await repository.create(value); await repository.updateRun(value.run); }
 const overlay=withArchivedA1(repository);
 expect((await pruneRuns(overlay,'2021-01-01T00:00:00.000Z')).deleted).toBe(0);
 expect(await repository.get(old.run.id)).toBeDefined();
 expect((await pruneRuns(overlay,'2021-01-01T00:00:00.000Z',true)).deleted).toBe(1);
 expect(await repository.get(old.run.id)).toBeUndefined();
 expect(await repository.get(active.run.id)).toBeDefined();expect(await repository.get(recent.run.id)).toBeDefined();
 expect((await overlay.get(ARCHIVED_A1_RUN_ID))?.run.recordKind).toBe('archived_evidence');
 await expect(pruneRuns(overlay,'2999-01-01T00:00:00Z',true)).rejects.toThrow('CUTOFF_INVALID');
 return old.run.id;
}
it('retention defaults to dry run and preserves active, recent and immutable archived records',async()=>exercise(new MemoryRunRepository()));
it('backups refuse overwrites, symlinks and in-repo outputs and use owner-only mode',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mosip-backup-test-'));const workspace=join(directory,'repo');await mkdir(workspace);
 const repository=new MemoryRunRepository();const saved=record();await repository.create(saved);
 try{
  const file=join(directory,'backup.json');const result=await backupRuns(repository,file,workspace);expect(result.runs).toBe(1);expect((await stat(file)).mode&0o777).toBe(0o600);
  expect(JSON.parse(await readFile(file,'utf8')).records[0].run.id).toBe(saved.run.id);
  await expect(backupRuns(repository,file,workspace)).rejects.toThrow();
  await expect(backupRuns(repository,join(workspace,'leak.json'),workspace)).rejects.toThrow('OUTSIDE_REPOSITORY');
  await symlink(file,join(directory,'link.json'));await expect(backupRuns(repository,join(directory,'link.json'),workspace)).rejects.toThrow();
 }finally{await rm(directory,{recursive:true,force:true});}
});
it.skipIf(!process.env.RETENTION_POSTGRES_TEST_URL)('retention applies terminal-only deletion with cascading rows in a disposable PostgreSQL database',async()=>{
 const prisma=new PrismaClient({datasources:{db:{url:process.env.RETENTION_POSTGRES_TEST_URL!}}});const repository=new PrismaRunRepository(prisma);
 try{const removed=await exercise(repository);expect(await prisma.runStep.count({where:{runId:removed}})).toBe(0);}finally{await repository.disconnect();}
});
