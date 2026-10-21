import type { RunSummary } from "@playground/shared";

function combinationKey(run: RunSummary) {
  const { issuer, wallet, verifier, format, flow, tamper } = run.config;
  return [issuer, wallet, verifier, format, flow, tamper ?? "none"].join("|");
}

export function latestMatrix(runs: RunSummary[]) {
  const latest = new Map<string, RunSummary>();
  for (const run of runs) {
    const key = combinationKey(run);
    const current = latest.get(key);
    if (!current || run.createdAt > current.createdAt) latest.set(key, run);
  }
  return [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function renderMatrixCsv(runs: RunSummary[]) {
  const rows = [["run_id", "issuer", "wallet", "verifier", "format", "flow", "tamper", "status", "expected", "actual", "created_at"]];
  for (const run of latestMatrix(runs)) {
    rows.push([run.id, run.config.issuer, run.config.wallet, run.config.verifier, run.config.format, run.config.flow, run.config.tamper ?? "none", run.status, run.expectedOutcome, run.actualOutcome ?? "", run.createdAt]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function renderMatrixMarkdown(runs: RunSummary[]) {
  const header = "| Issuer | Wallet | Verifier | Format | Fault | Status | Expected | Actual | Run |";
  const separator = "|---|---|---|---|---|---|---|---|---|";
  const rows = latestMatrix(runs).map((run) => `| ${run.config.issuer} | ${run.config.wallet} | ${run.config.verifier} | ${run.config.format} | ${run.config.tamper ?? "none"} | ${run.status} | ${run.expectedOutcome} | ${run.actualOutcome ?? "—"} | \`${run.id}\` |`);
  return ["# Interoperability matrix", "", header, separator, ...rows, ""].join("\n");
}
