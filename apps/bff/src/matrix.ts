import { evidenceTier, type RunSummary } from "@playground/shared";

function combinationKey(run: RunSummary) {
  const { issuer, wallet, verifier, format, flow, tamper } = run.config;
  return JSON.stringify([issuer, wallet, verifier, format, flow, tamper ?? "none", evidenceTier(run), run.config.scenarioId ?? "custom", run.protocolProfile ?? "historical-unreported", run.issuerRepresentation ?? "unreported"]);
}

export function latestMatrix(runs: RunSummary[]) {
  const latest = new Map<string, RunSummary>();
  for (const run of runs) {
    const key = combinationKey(run);
    const current = latest.get(key);
    if (!current || run.createdAt > current.createdAt) latest.set(key, run);
  }
  return [...latest.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((run) => ({ ...run, evidenceTier: evidenceTier(run) }));
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function renderMatrixCsv(runs: RunSummary[]) {
  const rows = [["run_id", "issuer", "wallet", "verifier", "format", "flow", "tamper", "status", "expected", "actual", "evidence_tier", "created_at", "scenario_id", "protocol_profile", "issuer_representation", "evaluation", "expected_code", "observed_code"]];
  for (const run of latestMatrix(runs)) {
    rows.push([run.id, run.config.issuer, run.config.wallet, run.config.verifier, run.config.format, run.config.flow, run.config.tamper ?? "none", run.status, run.expectedOutcome, run.actualOutcome ?? "", evidenceTier(run), run.createdAt, run.config.scenarioId ?? "custom", run.protocolProfile ?? "unreported", run.issuerRepresentation ?? "unreported", run.evaluation?.verdict ?? "not_recorded", run.evaluation?.expected.code ?? "", run.evaluation?.observed.code ?? ""]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function renderMatrixMarkdown(runs: RunSummary[]) {
  const header = "| Issuer | Wallet | Verifier | Format | Fault | Status | Expected | Actual | Evidence | Run | Scenario | Profile | Issuer method | Evaluation | Expected code | Observed code |";
  const separator = `| ${Array(16).fill("---").join(" | ")} |`;
  const rows = latestMatrix(runs).map((run) => `| ${run.config.issuer} | ${run.config.wallet} | ${run.config.verifier} | ${run.config.format} | ${run.config.tamper ?? "none"} | ${run.status} | ${run.expectedOutcome} | ${run.actualOutcome ?? "—"} | ${evidenceTier(run)} | \`${run.id}\` | ${run.config.scenarioId ?? "custom"} | ${run.protocolProfile ?? "unreported"} | ${run.issuerRepresentation ?? "unreported"} | ${run.evaluation?.verdict ?? "not_recorded"} | ${run.evaluation?.expected.code ?? ""} | ${run.evaluation?.observed.code ?? ""} |`);
  return ["# Interoperability matrix", "", header, separator, ...rows, ""].join("\n");
}
