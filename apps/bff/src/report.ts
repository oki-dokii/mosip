import { relatedWalletEvidence, renderWalletEvidenceMarkdown, type WalletEvidence } from "./walletEvidence.js";
import type { RunRecord } from "./store.js";
import { evidenceLabels, evidenceTier, type EvidenceTier } from "@playground/shared";
import { protocolMetadata } from "./protocol.js";

export interface RunReport {
  run: RunRecord["run"];
  steps: RunRecord["steps"];
  exchanges: RunRecord["exchanges"];
  relatedWalletEvidence: readonly WalletEvidence[];
  evidence: { tier: EvidenceTier; label: string };
}

export function buildReport(record: RunRecord, manual: readonly WalletEvidence[] = []): RunReport {
  const tier = evidenceTier(record.run);
  return { relatedWalletEvidence: relatedWalletEvidence(record.run, manual), run: { ...record.run, ...protocolMetadata(record.steps) }, steps: record.steps, exchanges: record.exchanges, evidence: { tier, label: evidenceLabels[tier] } };
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
    `- Reason evaluation: **${run.evaluation?.verdict ?? "not_recorded"}**`,
    `- Protocol profile: \`${run.protocolProfile ?? "unreported"}\``,
    `- Issuer representation: \`${run.issuerRepresentation ?? "unreported"}\``,
    `- Scenario: \`${run.config.scenarioId ?? "custom"}\``,
    ...(run.evaluation ? [
      `- Expected rejection: \`${run.evaluation.expected.code ?? "none"}\` at \`${run.evaluation.expected.step}\``,
      `- Observed rejection: \`${run.evaluation.observed.code ?? "unknown"}\` at \`${run.evaluation.observed.step ?? "unknown"}\``,
    ] : []),
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
  if (report.relatedWalletEvidence.length) lines.push("## Related manual wallet observations", "", "These observations are not evidence for this run or its outcome; credential/profile matching has not been established.", "", renderWalletEvidenceMarkdown(report.relatedWalletEvidence));
  return `${lines.join("\n")}\n`;
}
