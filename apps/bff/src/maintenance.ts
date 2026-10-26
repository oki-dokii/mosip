import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { resolve, dirname, basename, sep } from 'node:path';
import type { RunRepository } from './store.js';
import { ARCHIVED_A1_RUN_ID } from './archivedA1.js';
export function retentionCutoff(value: string) {
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(date.getTime()) || date.getTime() > Date.now()) throw new Error('RETENTION_CUTOFF_INVALID');
  return date;
}
export async function backupRuns(repository: RunRepository, path: string, workspaceRoot: string) {
  const target = resolve(path), parent = await realpath(dirname(target)), root = await realpath(workspaceRoot);
  if (parent === root || parent.startsWith(root + sep)) throw new Error('BACKUP_MUST_BE_OUTSIDE_REPOSITORY');
  const runs = await repository.list();
  if (runs.length > 5000) throw new Error('BACKUP_TOO_MANY_RUNS');
  const records = [];
  for (const run of runs) { const record = await repository.get(run.id); if (record) records.push(record); }
  const text = JSON.stringify({ schemaVersion:1, source:'sanitized_playground_repository', snapshot:'best_effort_stop_writes_for_consistent_backup', storage:repository.storage, records },null,2)+'\n';
  if (Buffer.byteLength(text) > 52_428_800) throw new Error('BACKUP_TOO_LARGE');
  // Refuse overwrites and symlink destinations. No credential/runtime/keystore backup.
  const file = await open(resolve(parent, basename(target)), 'wx', 0o600);
  try { await file.writeFile(text); } finally { await file.close(); }
  return { runs:records.length, sha256:createHash('sha256').update(text).digest('hex') };
}
export async function pruneRuns(repository: RunRepository, before: string, apply = false) {
  const cutoff = retentionCutoff(before);
  const terminal = ['passed','failed','errored','cancelled'];
  const candidates = (await repository.list()).filter(run => run.id !== ARCHIVED_A1_RUN_ID && run.recordKind !== 'archived_evidence' && terminal.includes(run.status) && run.finishedAt && Date.parse(run.finishedAt) < cutoff.getTime());
  if (!apply) return { candidates:candidates.length, deleted:0, dryRun:true };
  if (!repository.pruneCompletedBefore) throw new Error('RETENTION_UNSUPPORTED');
  return { candidates:candidates.length, deleted:await repository.pruneCompletedBefore(cutoff, [ARCHIVED_A1_RUN_ID]), dryRun:false };
}
