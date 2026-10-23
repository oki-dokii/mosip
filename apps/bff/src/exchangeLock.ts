// Serialize sequence allocation across orchestration, assisted observations and capture imports.
// Weak repository ownership prevents tests/apps sharing unrelated run IDs from blocking each other.
const queues = new WeakMap<object, Map<string, Promise<void>>>();
export async function withExchangeLock<T>(repository: object, runId: string, operation: () => Promise<T>): Promise<T> {
  let runs = queues.get(repository);
  if (!runs) { runs = new Map(); queues.set(repository, runs); }
  const previous = runs.get(runId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  runs.set(runId, current);
  await previous;
  try { return await operation(); }
  finally { release(); if (runs.get(runId) === current) runs.delete(runId); }
}
