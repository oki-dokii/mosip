import { fileURLToPath } from 'node:url';
import { createRunRepository } from './store.js';
import { backupRuns, pruneRuns, retentionCutoff } from './maintenance.js';
const args=process.argv.slice(2), command=args[0];
const option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const repository=createRunRepository();
try {
  if (!process.env.DATABASE_URL) throw new Error('MAINTENANCE_PERSISTENT_DATABASE_REQUIRED');
  const path=option('--backup');
  if (command==='backup' && path) console.log(JSON.stringify({operation:'backup',...await backupRuns(repository,path,fileURLToPath(new URL('../../../',import.meta.url)))}));
  else if (command==='prune' && option('--before')) {
    retentionCutoff(option('--before')!);
    if(args.includes('--apply')&&!path)throw new Error('PRUNE_BACKUP_REQUIRED');
    if(path)console.log(JSON.stringify({operation:'backup',...await backupRuns(repository,path,fileURLToPath(new URL('../../../',import.meta.url)))}));
    console.log(JSON.stringify({operation:'retention',...await pruneRuns(repository,option('--before')!,args.includes('--apply'))}));
  } else throw new Error('USAGE_BACKUP_OR_PRUNE_WITH_BEFORE');
} catch(error) {console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message)?error.message:'MAINTENANCE_FAILED');process.exitCode=1;}
finally {await repository.disconnect();}
