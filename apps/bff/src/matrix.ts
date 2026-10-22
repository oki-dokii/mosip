import { evidenceTier, type RunSummary } from "@playground/shared";

function combinationKey(run: RunSummary) {
  const { issuer, wallet, verifier, format, flow, tamper } = run.config;
  return [issuer, wallet, verifier, format, flow, tamper ?? "none", evidenceTier(run)].join("|");
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
  const rows = [["run_id", "issuer", "wallet", "verifier", "format", "flow", "tamper", "status", "expected", "actual", "evidence_tier", "created_at"]];
  for (const run of latestMatrix(runs)) {
    rows.push([run.id, run.config.issuer, run.config.wallet, run.config.verifier, run.config.format, run.config.flow, run.config.tamper ?? "none", run.status, run.expectedOutcome, run.actualOutcome ?? "", evidenceTier(run), run.createdAt]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function renderMatrixMarkdown(runs: RunSummary[]) {
  const header = "| Issuer | Wallet | Verifier | Format | Fault | Status | Expected | Actual | Evidence | Run |";
  const separator = `| ${Array(10).fill("---").join(" | ")} |`;
  const rows = latestMatrix(runs).map((run) => `| ${run.config.issuer} | ${run.config.wallet} | ${run.config.verifier} | ${run.config.format} | ${run.config.tamper ?? "none"} | ${run.status} | ${run.expectedOutcome} | ${run.actualOutcome ?? "—"} | ${evidenceTier(run)} | \`${run.id}\` |`);
  return ["# Interoperability matrix", "", header, separator, ...rows, ""].join("\n");
}

// Explicit supported positive-control grid; the browser never invents absent cells.
export function matrixCells(runs: RunSummary[]) {
  const supported = [
    ...(["inji_certify", "mock_issuer"] as const).flatMap(issuer => (["inji_verify", "mock_verifier"] as const).flatMap(verifier => (["ldp_vc", "vc_sd_jwt"] as const).filter(format => format === "vc_sd_jwt" || (issuer === "inji_certify" && verifier === "inji_verify")).map(format => ({ issuer, verifier, wallet: "reference_wallet" as const, format })))),
    { issuer: "inji_certify" as const, verifier: "inji_verify" as const, wallet: "inji_web_assisted" as const, format: "ldp_vc" as const },
  ];
  return supported.map(config => {
    const run = runs.filter(run => !run.config.tamper && ["passed", "failed", "errored"].includes(run.status) && Object.entries(config).every(([key, value]) => run.config[key as keyof typeof config] === value)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { config, status: run?.status ?? "not_tested", testedAt: run?.finishedAt ?? null, evidence: run ? evidenceTier(run) : "unverified", runId: run?.id ?? null };
  });
}
