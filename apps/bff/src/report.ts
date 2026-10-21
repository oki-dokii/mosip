import type { RunRecord } from "./store.js";
import { evidenceLabels, evidenceTier, type EvidenceTier } from "@playground/shared";

export interface RunReport {
  run: RunRecord["run"];
  steps: RunRecord["steps"];
  exchanges: RunRecord["exchanges"];
  evidence: { tier: EvidenceTier; label: string };
}

export function buildReport(record: RunRecord): RunReport {
  const tier = evidenceTier(record.run);
  return { run: record.run, steps: record.steps, exchanges: record.exchanges, evidence: { tier, label: evidenceLabels[tier] } };
}

function fencedJson(value: unknown) {
  return JSON.stringify(value, null, 2).replaceAll("```", "``\u200b`");
}

export function renderMarkdown(report: RunReport) {
  const { run, steps, exchanges, evidence } = report;
  const lines = [
    `# Interoperability run ${run.id}`,
    "",
    `- Status: **${run.status}**`,
    `- Expected outcome: **${run.expectedOutcome}**`,
    `- Actual outcome: **${run.actualOutcome ?? "pending"}**`,
    `- Evidence: **${evidence.label}**`,
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
