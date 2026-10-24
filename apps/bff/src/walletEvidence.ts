import type { RunSummary } from "@playground/shared";

export interface WalletEvidence {
  id: string;
  recordKind: "manual_wallet_observation";
  wallet: "inji_web" | "inji_mobile";
  walletLabel: string;
  issuer: "inji_certify";
  verifier: "inji_verify";
  format: "ldp_vc" | "vc_sd_jwt";
  credential: string;
  observedDate: string;
  deployment: string;
  versions: { issuer: string; wallet: string; verifier: string };
  outcome: "valid";
  outcomeSource: "verifier_ui" | "correlated_verifier_response";
  managedRunId: null;
  managedValidation: "pending";
  reviewStatus: "pending_integrator_review" | "recorded_manual_acceptance";
  checkpoints: { name: string; evidence: "observed" | "user_confirmed"; detail: string }[];
  limitations: string[];
  artifacts: { label: string; url: string }[];
}
const source = (commit: string, path: string) => `https://github.com/oki-dokii/mosip/blob/${commit}/${path}`;
// Curated public facts only. No upload/import endpoint and no fabricated RunSummary.
export const walletEvidence: readonly WalletEvidence[] = [
  {
    id: "a1-web-land-registry-2026-10-23", recordKind: "manual_wallet_observation", wallet: "inji_web", walletLabel: "Inji Web (real wallet)", issuer: "inji_certify", verifier: "inji_verify", format: "ldp_vc", credential: "Land Registry Registration Receipt", observedDate: "2026-10-23", deployment: "Hosted Collab Inji Web/Mimoto and Verify; exact Land Registry issuer endpoint unreported", versions: { issuer: "unreported", wallet: "unreported", verifier: "unreported" }, outcome: "valid", outcomeSource: "verifier_ui", managedRunId: null, managedValidation: "pending", reviewStatus: "pending_integrator_review",
    checkpoints: [
      { name: "Issuance", evidence: "observed", detail: "Credential appeared in the dedicated signed-in wallet." },
      { name: "Persistent storage", evidence: "observed", detail: "Registration Receipt remained in Stored Cards after a full page refresh." },
      { name: "Presentation", evidence: "observed", detail: "The same wallet matched the Land Registry request, obtained consent and reported Credentials Shared." },
      { name: "Verifier acceptance", evidence: "observed", detail: "Inji Verify displayed Registration Receipt Credential — Valid." },
    ],
    limitations: ["Manual browser journey; no playground run or correlated Exchange chain.", "Exact issuer configuration, deployment versions and protocol profile remain unreported.", "A1 integrator sign-off and managed live validation remain pending; no general JSON-LD conformance claim."],
    artifacts: [
      { label: "A1 evidence and checklist", url: source("1537c55287ccbbf9ed9edd113ce2c46fc05c6681", "submission/A1_WEB_EVIDENCE.md") },
      { label: "Stored cards after refresh", url: source("1537c55287ccbbf9ed9edd113ce2c46fc05c6681", "submission/evidence/person2/live-stored-cards-after-refresh.png") },
      { label: "Verify Valid screenshot", url: source("1537c55287ccbbf9ed9edd113ce2c46fc05c6681", "submission/evidence/person2/live-verify-valid.png") },
      { label: "Observed hosted route limits", url: source("fab1288306bd52c3b7942468f1dc6f45f2e82987", "submission/PERSON2_HOSTED_ROUTE_HANDOFF.md") },
    ],
  },
  {
    id: "a2-android-sdjwt-2026-10-23", recordKind: "manual_wallet_observation", wallet: "inji_mobile", walletLabel: "Inji Wallet Android (real wallet)", issuer: "inji_certify", verifier: "inji_verify", format: "vc_sd_jwt", credential: "Playground SD-JWT Identity", observedDate: "2026-10-23", deployment: "Hybrid: pinned official local Certify and public Collab Verify; Nothing Phone (2a), Android 16", versions: { issuer: "1.0.0-alpha.1", wallet: "1.0.0-alpha.1 (About screen)", verifier: "unreported" }, outcome: "valid", outcomeSource: "correlated_verifier_response", managedRunId: null, managedValidation: "pending", reviewStatus: "recorded_manual_acceptance",
    checkpoints: [
      { name: "Issuance", evidence: "observed", detail: "Real Android wallet listed Playground SD-JWT Identity." },
      { name: "Persistent storage", evidence: "user_confirmed", detail: "User confirmed that the card remained after closing and reopening; reopening was not independently recorded." },
      { name: "Presentation", evidence: "observed", detail: "Wallet matched the stored card, requested consent and reported successful sharing." },
      { name: "Verifier acceptance", evidence: "observed", detail: "Correlated Inji Verify response: valid; credential proof and holder proof true." },
    ],
    limitations: ["Manual mobile acceptance; no playground-managed run or native traffic capture.", "Hybrid deployment; installed binary attestation and Verify release remain unreported.", "User-confirmed persistence is distinct from independent observation; selective claim-policy behavior was not isolated."],
    artifacts: [
      { label: "A2 acceptance report", url: source("a638911cd9fc54b147a643b05a6155f02937c7b7", "submission/A2_MOBILE_EVIDENCE.md") },
      { label: "Mobile attempt and provenance", url: source("a638911cd9fc54b147a643b05a6155f02937c7b7", "submission/evidence/person3-a2-mobile-2026-10-23/attempt.json") },
      { label: "Wallet share success", url: source("a638911cd9fc54b147a643b05a6155f02937c7b7", "submission/evidence/person3-a2-mobile-2026-10-23/04-wallet-share-success.jpg") },
      { label: "Correlated verifier result", url: source("a638911cd9fc54b147a643b05a6155f02937c7b7", "submission/evidence/person3-a2-mobile-2026-10-23/verifier-result.json") },
    ],
  },
];
export function relatedWalletEvidence(run: RunSummary, items: readonly WalletEvidence[]) {
  return items.filter(item => run.config.wallet === "inji_web_assisted" && item.wallet === "inji_web" && !run.config.tamper && item.issuer === run.config.issuer && item.verifier === run.config.verifier && item.format === run.config.format);
}
export function renderWalletEvidenceMarkdown(items: readonly WalletEvidence[]) {
  return ["# Observed real-wallet compatibility", "", "Manual evidence applies only to the recorded credential and deployment. It does not change managed-run outcomes or evidence tiers.", "", ...items.flatMap(item => [
    `## ${item.walletLabel} · ${item.credential}`, "", `- Evidence ID: ${item.id}`, `- Record kind: ${item.recordKind}`, `- Observed: ${item.observedDate}`, `- Format: ${item.format}`, `- Outcome: ${item.outcome} (${item.outcomeSource})`, `- Deployment: ${item.deployment}`, `- Versions (issuer / wallet / verifier): ${item.versions.issuer} / ${item.versions.wallet} / ${item.versions.verifier}`, `- Managed run ID: none`, `- Managed validation: ${item.managedValidation}`, `- Review: ${item.reviewStatus}`, "", "### Checkpoints", "", ...item.checkpoints.map(check => `- ${check.name}: ${check.evidence}. ${check.detail}`), "", "### Limits", "", ...item.limitations.map(limit => `- ${limit}`), "", "### Source artifacts", "", ...item.artifacts.map(artifact => `- [${artifact.label}](${artifact.url})`), "",
  ])].join("\n") + "\n";
}
export function renderWalletEvidenceCsv(items: readonly WalletEvidence[]) {
  const rows = [["evidence_id", "record_kind", "issuer", "wallet", "verifier", "format", "credential", "observed_date", "outcome", "outcome_source", "managed_run_id", "managed_validation", "review_status", "deployment", "issuer_version", "wallet_version", "verifier_version", "limitations", "checkpoints", "artifact_urls"], ...items.map(item => [item.id, item.recordKind, item.issuer, item.wallet, item.verifier, item.format, item.credential, item.observedDate, item.outcome, item.outcomeSource, "", item.managedValidation, item.reviewStatus, item.deployment, item.versions.issuer, item.versions.wallet, item.versions.verifier, item.limitations.join("; "), item.checkpoints.map(check => `${check.name}: ${check.evidence}. ${check.detail}`).join("; "), item.artifacts.map(a => a.url).join("; ")])];
  return rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
}
