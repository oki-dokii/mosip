import type { Exchange, RunStep, RunSummary } from "@playground/shared";

export interface RunRecord {
  run: RunSummary;
  steps: RunStep[];
  exchanges: Exchange[];
}

const runs = new Map<string, RunRecord>();

export const runStore = {
  create(record: RunRecord) {
    runs.set(record.run.id, record);
    return record;
  },
  get(id: string) {
    return runs.get(id);
  },
  list() {
    return [...runs.values()]
      .map(({ run }) => run)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  clear() {
    runs.clear();
  },
};
