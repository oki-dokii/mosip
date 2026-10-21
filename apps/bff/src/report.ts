import type { RunRecord } from "./store.js";

export interface RunReport {
  run: RunRecord["run"];
  steps: RunRecord["steps"];
  exchanges: RunRecord["exchanges"];
}

export function buildReport(record: RunRecord): RunReport {
  return { run: record.run, steps: record.steps, exchanges: record.exchanges };
}

function fencedJson(value: unknown) {
  return JSON.stringify(value, null, 2).replaceAll("```", "``\u200b`");
}

export function renderMarkdown(report: RunReport) {
  const { run, steps, exchanges } = report;
  const lines = [
    `# Interoperability run ${run.id}`,
    "",
    `- Status: **${run.status}**`,
    `- Expected outcome: **${run.expectedOutcome}**`,
    `- Actual outcome: **${run.actualOutcome ?? "pending"}**`,
    `- Issuer: \`${run.config.issuer}\``,
    `- Wallet: \`${run.config.wallet}\``,
    `- Verifier: \`${run.config.verifier}\``,
    `- Format: \`${run.config.format}\``,
    `- Tamper: \`${run.config.tamper ?? "none"}\``,
    `- Issuer version: \`${run.serviceVersions?.issuer ?? "unreported"}\``,
    `- Wallet version: \`${run.serviceVersions?.wallet ?? "unreported"}\``,
    `- Verifier version: \`${run.serviceVersions?.verifier ?? "unreported"}\``,
    ...(run.parentRunId ? [`- Parent run: \`${run.parentRunId}\``] : []),
    "",
    "## Steps",
    "",
    "| # | Step | Status |",
    "|---:|---|---|",
    ...steps.map((step) => `| ${step.seq} | ${step.title.replaceAll("|", "\\|")} | ${step.status} |`),
    "",
    "## Sanitized exchanges",
    "",
  ];
  for (const item of exchanges) {
    lines.push(
      `### ${item.seq}. ${item.method} ${item.url}`,
      "",
      `**${item.actorFrom} → ${item.actorTo} · HTTP ${item.status} · ${item.durationMs} ms**`,
      "",
      "Request:",
      "```json",
      fencedJson(item.request),
      "```",
      "",
      "Response:",
      "```json",
      fencedJson(item.response),
      "```",
      "",
      `Redactions: ${item.redactions.length ? item.redactions.map((path) => `\`${path}\``).join(", ") : "none"}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}
