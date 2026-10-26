import { readFileSync } from "node:fs";
import type { Exchange, RunStep, RunSummary } from "@playground/shared";
import type { RunRecord, RunRepository } from "./store.js";

export const ARCHIVED_A1_RUN_ID = "3dc6895d-ff87-45a2-a10b-46844198d83e";

/** The committed export is historical evidence, never a newly executed run. */
export function loadArchivedA1(): RunRecord {
  const url = new URL("../../../submission/evidence/person2-managed-a1-2026-10-25/run-report.json", import.meta.url);
  const source = JSON.parse(readFileSync(url, "utf8")) as { run?: RunSummary; steps?: RunStep[]; exchanges?: Exchange[] };
  const { run, steps, exchanges } = source;
  const issue = steps?.find(step => step.stepKey === "ISSUE_CREDENTIAL");
  const present = steps?.find(step => step.stepKey === "PRESENT_SUBMIT");
  const result = steps?.find(step => step.stepKey === "PRESENT_RESULT");
  const issued = exchanges?.find(exchange => exchange.id === issue?.summary?.exchangeId);
  const submitted = exchanges?.find(exchange => exchange.id === present?.summary?.exchangeId);
  const requestTag = (submitted?.request as { capture?: { requestUriTag?: unknown } } | undefined)?.capture?.requestUriTag;
  if (run?.id !== ARCHIVED_A1_RUN_ID || run.config?.wallet !== "inji_web_assisted" || run.config?.format !== "ldp_vc" ||
    run.status !== "passed" || run.actualOutcome !== "valid" || run.evaluation?.verdict !== "correct_acceptance" ||
    steps?.length !== 10 || exchanges?.length !== 7 || !steps.every(step => step.runId === run.id && step.status === "succeeded") ||
    !exchanges.every(exchange => exchange.runId === run.id && steps.some(step => step.id === exchange.stepId)) ||
    (issued?.request as { capture?: { ruleId?: unknown } } | undefined)?.capture?.ruleId !== "mimoto-wallet-credential" ||
    (submitted?.request as { capture?: { ruleId?: unknown } } | undefined)?.capture?.ruleId !== "mimoto-wallet-presentation" ||
    typeof requestTag !== "string" || !/^\[REDACTED hmac:[a-f0-9]{16}\]$/.test(requestTag) ||
    result?.summary?.outcome !== "valid" || !exchanges.some(exchange => (exchange.response as { allChecksSuccessful?: unknown } | null)?.allChecksSuccessful === true)) {
    throw new Error("Committed A1 archive failed integrity checks");
  }
  // The original export misidentified Inji Web as the Reference Wallet. Keep the
  // immutable source on disk and correct only the API projection's version label.
  return { run: { ...run, ...(run.serviceVersions ? { serviceVersions: { ...run.serviceVersions, wallet: "unreported" } } : {}), recordKind: "archived_evidence" }, steps, exchanges };
}

/** Read-only overlay: ordinary runs still use the configured memory/PostgreSQL store. */
export function withArchivedA1(delegate: RunRepository, archived = loadArchivedA1()): RunRepository {
  const id = archived.run.id;
  const rejectArchive = (target: string) => {
    if (target === id) throw new Error("ARCHIVED_EVIDENCE_READ_ONLY");
  };
  return {
    storage: delegate.storage,
    async create(record) { rejectArchive(record.run.id); return delegate.create(record); },
    async get(runId) { return runId === id ? structuredClone(archived) : delegate.get(runId); },
    async list() { return [structuredClone(archived.run), ...(await delegate.list()).filter(run => run.id !== id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    async updateRun(run) { rejectArchive(run.id); return delegate.updateRun(run); },
    async updateStep(step) { rejectArchive(step.runId); return delegate.updateStep(step); },
    async addExchange(exchange) { rejectArchive(exchange.runId); return delegate.addExchange(exchange); },
    async addExchanges(exchanges) { for (const exchange of exchanges) rejectArchive(exchange.runId); return delegate.addExchanges(exchanges); },
    async pruneCompletedBefore(cutoff, excludedIds = []) {
      if (!delegate.pruneCompletedBefore) throw new Error("RETENTION_UNSUPPORTED");
      return delegate.pruneCompletedBefore(cutoff, [...excludedIds, id]);
    },
    async clear() { return delegate.clear(); },
    async disconnect() { return delegate.disconnect(); },
  };
}
