import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const output = new URL("../submission/evidence/2026-10-23-aggregate-interop.md", import.meta.url);
const localSource = "submission/evidence/2026-10-23-ci-mock-matrix.json";
const liveSources = [
  "submission/evidence/2026-10-21-mock-x509-valid.json",
  "submission/evidence/2026-10-21-mock-x509-bad-signature.json",
];

async function load(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function cell(value) {
  return String(value ?? "unreported").replaceAll("|", "\\|").replaceAll("`", "'").replace(/[<>]/g, "");
}

function row(run, source) {
  const failedStep = run.evaluation?.observed?.step ?? (run.actualOutcome === "invalid" ? "unreported" : "—");
  const code = run.evaluation?.observed?.code ?? (run.actualOutcome === "invalid" ? "unreported" : "—");
  return `| \`${cell(run.id)}\` | ${cell(run.config.issuer)} → ${cell(run.config.wallet)} → ${cell(run.config.verifier)} | ${cell(run.config.format)} / ${cell(run.config.tamper ?? "none")} | ${cell(run.expectedOutcome)} / ${cell(run.actualOutcome)} | ${cell(run.evaluation?.verdict ?? "not_recorded")} | ${cell(failedStep)} / ${cell(code)} | ${cell(run.finishedAt)} | [record](${source}) |`;
}

const local = await load(localSource);
const live = await Promise.all(liveSources.map(load));
if (local.source !== "synthetic Docker mock matrix" || local.dirtyWorkingTree !== false || local.items.length !== 6 || local.reports.length !== 6 || live.some(item => item.evidence?.tier !== "mock_interop")) {
  throw new Error("Expected committed sanitized run evidence is missing or changed");
}
for (const run of local.items) {
  if (!local.reports.some(report => report.run?.id === run.id) || run.status !== "passed") throw new Error("Local mock matrix and reports disagree");
}

const localLink = localSource.slice("submission/evidence/".length);
const liveLinks = liveSources.map(path => path.slice("submission/evidence/".length));
const lines = [
  "# Aggregate interoperability evidence — 23 October 2026",
  "",
  "Compiled against merged `main` checkpoint `b0f132d`. This report projects only metadata from committed sanitized run records; it does not execute a new wallet or Collab flow. Run IDs in the older memory-backed records are identifiers, not live web links. Open the linked record and search its run ID. Unknown deployment versions remain `unreported`.",
  "",
  "## Observed mock interoperability with public Collab Verify",
  "",
  "Two synthetic X.509 mock issuer → Reference Wallet → public Inji Verify SD-JWT runs from 21 October. The verifier deployment version was unreported; the issuer used a self-signed test certificate. These establish the recorded acceptance/rejection only, not production certificate trust or an Inji-wallet pass.",
  "",
  "| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |",
  "|---|---|---|---|---|---|---|---|",
  ...live.map((report, index) => row(report.run, liveLinks[index])),
  "",
  "Known versions: issuer `mock-x509-1`, wallet `reference-wallet/0.1.0`, verifier `unreported`. Protocol profile and detailed rejection code were not recorded in these historical reports.",
  "",
  "## Observed hosted CI mock protocol matrix",
  "",
  `Six synthetic Docker mock issuer → Reference Wallet → mock verifier SD-JWT runs from 23 October, recorded in [the source matrix](${localLink}). The source records commit \`${cell(local.sourceCommit)}\`, capture time \`${cell(local.capturedAt)}\`, PostgreSQL storage and \`dirtyWorkingTree: false\`. All six passed with exact expected verdicts in [hosted CI run 28](https://github.com/oki-dokii/mosip/actions/runs/39902817583). This clean CI evidence supersedes the earlier 22 October dirty-tree mock matrix for the submission report.`,
  "",
  "| Run ID | Participants | Format / fault | Expected / actual | Reason evaluation | Failing step / code | Finished (UTC) | Evidence |",
  "|---|---|---|---|---|---|---|---|",
  ...[...local.items].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).map(run => row(run, localLink)),
  "",
  "Known versions: wallet `reference-wallet/0.1.0`, verifier `local-mock/1`; mock issuer build label was `unreported`. Profile `mock-sdjwt-flat-v1`, issuer representation `did:jwk`. The `replay_nonce` preset changes the nonce; a true byte replay is a separate local probe, not this matrix cell.",
  "",
  "## Positive-control coverage still untested in committed full run records",
  "",
  "| Issuer | Wallet | Verifier | Format | State |",
  "|---|---|---|---|---|",
  "| Inji Certify | Reference Wallet | Inji Verify | JSON-LD | `not_tested` in this full-record export; earlier sanitized spike summaries exist |",
  "| Inji Certify | Reference Wallet | Inji Verify | SD-JWT | `not_tested` in this full-record export; earlier sanitized spike summaries exist |",
  "| Inji Certify | Reference Wallet | Mock verifier | SD-JWT | `not_tested` in this full-record export |",
  "| Mock issuer | Reference Wallet | Inji Verify | SD-JWT | observed above, 21 October |",
  "| Mock issuer | Reference Wallet | Mock verifier | SD-JWT | observed above, 23 October |",
  "| Inji Certify | Inji Web assisted | Inji Verify | JSON-LD | `not_tested`; A1 blocked on account and authenticated Web/Mimoto deployment |",
  "| Inji Certify | Inji Wallet mobile | Inji Verify | SD-JWT | `not_tested`; A2 blocked on pinned installed app/device |",
  "",
  "The last row is the A2 acceptance gate, beyond the current UI selector. `not_tested` is not a failed verifier result. The app's live `/api/v1/matrix/cells` endpoint derives its own current-run grid; this static report covers only the committed records linked above.",
  "",
  "## Remaining acceptance boundaries",
  "",
  "- A1 requires an actual logged-in Inji Web wallet to issue, persist, present and receive a correlated `valid` Verify result. The connected fixture and browser tests do not satisfy it. See [A1 evidence](../A1_WEB_EVIDENCE.md).",
  "- A2 requires a pinned Inji Wallet mobile build and device, with the same full SD-JWT chain. See [A2 evidence](../A2_MOBILE_EVIDENCE.md).",
  "- The pinned local Inji profile is configuration-only until Keymanager, eSignet and verifier trust settings are provisioned. See [local Inji status](../../deploy/INJI_LOCAL.md).",
  "- Capture sees only explicitly recorded, allowlisted browser exchanges; server-to-server and native-wallet boundaries stay unobserved. See [capture limits](../../CAPTURE.md).",
  "",
];
const document = `${lines.join("\n")}\n`;
if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== document) throw new Error(`${fileURLToPath(output)} is stale`);
} else {
  await writeFile(output, document);
}
