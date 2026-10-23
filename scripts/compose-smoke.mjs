import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

const base = `http://127.0.0.1:${process.env.PLAYGROUND_WEB_PORT ?? "5174"}/api/v1`;
const reports = [];

async function json(path, options) {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const health = await json("/health");
if (health.driverMode !== "collab" || health.storage !== "postgres") {
  throw new Error(`Expected collab/postgres, got ${health.driverMode}/${health.storage}`);
}
const catalog = await json("/scenarios");

async function runCase(tamper, expected) {
  const scenario = catalog.items.find((item) => item.config.issuer === "mock_issuer" && item.config.verifier === "mock_verifier" && item.config.tamper === tamper);
  if (!scenario?.available) throw new Error(`Controlled scenario unavailable: ${tamper ?? "baseline"}`);
  const config = scenario.config;
  const { runId } = await json("/runs", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(config),
  });
  let run;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    run = await json(`/runs/${runId}`);
    if (["passed", "failed", "errored"].includes(run.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (run?.status !== "passed" || run.actualOutcome !== expected) {
    throw new Error(`${tamper ?? "baseline"} did not pass: ${run?.status ?? "timeout"}/${run?.actualOutcome ?? "none"} (${runId})`);
  }
  if (run.protocolProfile !== "mock-sdjwt-flat-v1" || run.evaluation?.verdict !== (tamper ? "correct_rejection" : "correct_acceptance") || (tamper && run.evaluation.observed.code !== run.evaluation.expected.code)) {
    throw new Error(`Missing precise protocol evaluation for ${runId}`);
  }
  const [steps, exchanges, report] = await Promise.all([
    json(`/runs/${runId}/steps`), json(`/runs/${runId}/exchanges`), json(`/runs/${runId}/report?format=json`),
  ]);
  if (steps.items.length !== 10 || exchanges.items.length < 5 || report.evidence.tier !== "mock_interop") {
    throw new Error(`Incomplete run evidence for ${runId}`);
  }
  if (JSON.stringify(report.run.evaluation) !== JSON.stringify(run.evaluation)) throw new Error(`Report evaluation mismatch for ${runId}`);
  reports.push(report);
  console.log(`${tamper ?? "baseline"}: ${expected}, 10 steps, ${exchanges.items.length} exchanges, mock_interop (${runId})`);
  return runId;
}

const cases = process.env.MOCK_ISSUER_ENABLE_TEST_CASES === "true"
  ? [null, "bad_signature", "expired", "wrong_type", "missing_disclosure", "replay_nonce"]
  : [null, "bad_signature"];
const runIds = [];
for (const tamper of cases) runIds.push(await runCase(tamper, tamper ? "invalid" : "valid"));
const matrix = await json("/matrix/export?format=json");
const tested = matrix.items.filter((item) => runIds.includes(item.id));
if (tested.length !== cases.length) throw new Error(`Expected ${cases.length} tested matrix cells, found ${tested.length}`);

if (process.env.MATRIX_ARTIFACT_PATH) {
  await mkdir(dirname(process.env.MATRIX_ARTIFACT_PATH), { recursive: true });
  await writeFile(process.env.MATRIX_ARTIFACT_PATH, `${JSON.stringify({
    schemaVersion: 1, capturedAt: new Date().toISOString(), source: "synthetic Docker mock matrix",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirtyWorkingTree: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
    storage: health.storage, items: tested, reports,
  }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(`Wrote synthetic matrix to ${process.env.MATRIX_ARTIFACT_PATH}`);
}
