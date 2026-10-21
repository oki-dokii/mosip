import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const base = `http://127.0.0.1:${process.env.PLAYGROUND_WEB_PORT ?? "5174"}/api/v1`;

async function json(path, options) {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const health = await json("/health");
if (health.driverMode !== "collab" || health.storage !== "postgres") {
  throw new Error(`Expected collab/postgres, got ${health.driverMode}/${health.storage}`);
}

async function runCase(tamper, expected) {
  const config = {
    issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier",
    format: "vc_sd_jwt", flow: "cross_device", tamper, scenarioId: null,
  };
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
  const [steps, exchanges, report] = await Promise.all([
    json(`/runs/${runId}/steps`), json(`/runs/${runId}/exchanges`), json(`/runs/${runId}/report?format=json`),
  ]);
  if (steps.items.length !== 10 || exchanges.items.length < 5 || report.evidence.tier !== "mock_interop") {
    throw new Error(`Incomplete run evidence for ${runId}`);
  }
  console.log(`${tamper ?? "baseline"}: ${expected}, 10 steps, ${exchanges.items.length} exchanges, mock_interop (${runId})`);
  return runId;
}

const runIds = [await runCase(null, "valid"), await runCase("bad_signature", "invalid")];
const matrix = await json("/matrix/export?format=json");
const tested = matrix.items.filter((item) => runIds.includes(item.id));
if (tested.length !== 2) throw new Error(`Expected two tested matrix cells, found ${tested.length}`);

if (process.env.MATRIX_ARTIFACT_PATH) {
  await mkdir(dirname(process.env.MATRIX_ARTIFACT_PATH), { recursive: true });
  await writeFile(process.env.MATRIX_ARTIFACT_PATH, `${JSON.stringify({
    capturedAt: new Date().toISOString(), source: "synthetic Docker mock matrix", items: tested,
  }, null, 2)}\n`);
  console.log(`Wrote synthetic matrix to ${process.env.MATRIX_ARTIFACT_PATH}`);
}
