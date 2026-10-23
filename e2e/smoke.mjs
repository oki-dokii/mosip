#!/usr/bin/env node
/**
 * e2e/smoke.mjs — HTTP smoke test for the packaged Inji Interoperability Playground.
 *
 * Evidence limit: this script exercises mock/fixture paths only.
 * No local Inji stack is started. Results do NOT prove Inji Web or
 * Inji Wallet interoperability. See DEPLOYMENT.md §Evidence limits.
 *
 * Usage:
 *   node e2e/smoke.mjs [--bff-url=http://...] [--web-url=http://...]
 *
 * Environment variables (override defaults):
 *   E2E_BFF_URL    Direct BFF base URL  (default http://127.0.0.1:4000)
 *   E2E_WEB_URL    Web proxy base URL   (default http://127.0.0.1:5174)
 *   E2E_TIMEOUT_MS Max ms to wait for health (default 90000)
 *   E2E_DRIVER_MODE Expected driverMode value (default "collab")
 *   E2E_STORAGE    Expected storage value     (default "postgres")
 */

import { setTimeout as sleep } from "node:timers/promises";

// ─── Configuration ────────────────────────────────────────────────────────────

const BFF_URL = process.env.E2E_BFF_URL ?? `http://127.0.0.1:${process.env.PLAYGROUND_WEB_PORT ?? "4000"}`;
const WEB_URL = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${process.env.PLAYGROUND_WEB_PORT_HOST ?? "5174"}`;
const HEALTH_TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS ?? 90_000);
const EXPECTED_DRIVER_MODE = process.env.E2E_DRIVER_MODE ?? null;
const EXPECTED_STORAGE = process.env.E2E_STORAGE ?? "postgres";
const RUN_POLL_TIMEOUT_MS = 120_000;
const RUN_POLL_INTERVAL_MS = 500;

// ─── Redaction smoke patterns ──────────────────────────────────────────────────
//
// These are conservative heuristics for obvious secret markers.
// This is NOT a replacement for the unit-level redaction tests in
// apps/bff/src/redaction.test.ts. Failures here mean something
// clearly secret leaked into an API response body.
const REDACTION_PATTERNS = [
  // JWK private key members
  { pattern: /"d"\s*:\s*"[A-Za-z0-9_-]{10,}"/, label: "JWK private key 'd'" },
  { pattern: /"p"\s*:\s*"[A-Za-z0-9_-]{10,}"/, label: "JWK prime 'p'" },
  { pattern: /"q"\s*:\s*"[A-Za-z0-9_-]{10,}"/, label: "JWK prime 'q'" },
  // Bearer token values (not just the word Bearer)
  { pattern: /Bearer [A-Za-z0-9._-]{20,}/, label: "Bearer token value" },
  // Pre-authorized code
  { pattern: /"pre.authorized_code"\s*:\s*"[^"]{4,}"/, label: "pre_authorized_code value" },
  // Long raw JWTs in fields that should be redacted
  // A field named "token" or "access_token" with a JWT value is suspicious
  { pattern: /"(?:access_token|id_token|refresh_token)"\s*:\s*"[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"/, label: "token field with JWT value" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const results = [];
let passed = 0;
let failed = 0;

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) {
    passed++;
    console.log(`  ✓  ${name}`);
  } else {
    failed++;
    console.error(`  ✗  ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function fetchJson(url, options = {}) {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  const res = await fetch(url, { ...options, signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function checkRedaction(label, obj) {
  const text = JSON.stringify(obj);
  const violations = [];
  for (const { pattern, label: patternLabel } of REDACTION_PATTERNS) {
    if (pattern.test(text)) violations.push(patternLabel);
  }
  if (violations.length) {
    record(`Redaction check: ${label}`, false, `Possible secret markers: ${violations.join(", ")}`);
  } else {
    record(`Redaction check: ${label}`, true);
  }
}

// ─── Step 1: Wait for BFF health ────────────────────────────────────────────

console.log("\n── Step 1: BFF health check ──────────────────────────────────────");
console.log(`   Waiting up to ${HEALTH_TIMEOUT_MS / 1000}s for ${BFF_URL}/api/v1/health`);

let health;
const healthDeadline = Date.now() + HEALTH_TIMEOUT_MS;

while (Date.now() < healthDeadline) {
  try {
    health = await fetchJson(`${BFF_URL}/api/v1/health`, { timeoutMs: 5_000 });
    console.log(`   BFF responded: driverMode=${health.driverMode} storage=${health.storage}`);
    break;
  } catch (err) {
    process.stdout.write(".");
    await sleep(2_000);
  }
}

if (!health) {
  console.error(`\nFATAL: BFF did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s`);
  process.exit(1);
}

// ─── Step 2: Assert health response fields ───────────────────────────────────

console.log("\n── Step 2: Health field assertions ────────────────────────────────");

if (EXPECTED_DRIVER_MODE) {
  record(
    `driverMode === "${EXPECTED_DRIVER_MODE}"`,
    health.driverMode === EXPECTED_DRIVER_MODE,
    `actual: ${health.driverMode}`
  );
} else {
  record(
    'driverMode is valid ("fixture" or "collab")',
    ["fixture", "collab"].includes(health.driverMode),
    `actual: ${health.driverMode}`
  );
}

record(
  `storage === "${EXPECTED_STORAGE}"`,
  health.storage === EXPECTED_STORAGE,
  `actual: ${health.storage}`
);

record(
  "services array non-empty",
  Array.isArray(health.services) && health.services.length > 0,
  `actual: ${JSON.stringify(health.services)}`
);

checkRedaction("health response", health);

// ─── Step 3: Run cases ───────────────────────────────────────────────────────

console.log("\n── Step 3: Run cases ───────────────────────────────────────────────");

/**
 * Start a run, poll until terminal, assert expected outcome.
 * Returns the runId, or null on failure.
 */
async function runCase(caseName, tamper, expectedOutcome) {
  console.log(`\n   [${caseName}] Starting run (tamper=${tamper ?? "none"}, expected=${expectedOutcome})`);

  let runId;
  try {
    const body = {
      issuer: "mock_issuer",
      wallet: "reference_wallet",
      verifier: "mock_verifier",
      format: "vc_sd_jwt",
      flow: "cross_device",
      tamper: tamper ?? null,
      scenarioId: null,
    };
    const created = await fetchJson(`${BFF_URL}/api/v1/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 10_000,
    });
    runId = created.runId;
    record(`${caseName}: POST /api/v1/runs → runId`, typeof runId === "string", `got: ${JSON.stringify(created)}`);
  } catch (err) {
    record(`${caseName}: POST /api/v1/runs`, false, err.message);
    return null;
  }

  // Poll for terminal status
  let run;
  const deadline = Date.now() + RUN_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      run = await fetchJson(`${BFF_URL}/api/v1/runs/${runId}`, { timeoutMs: 5_000 });
      if (["passed", "failed", "errored"].includes(run.status)) break;
    } catch (_) { /* keep polling */ }
    await sleep(RUN_POLL_INTERVAL_MS);
  }

  if (!run || !["passed", "failed", "errored"].includes(run.status)) {
    record(`${caseName}: run completed within ${RUN_POLL_TIMEOUT_MS / 1000}s`, false, `status: ${run?.status ?? "timeout"}`);
    return runId;
  }

  record(`${caseName}: run completed within ${RUN_POLL_TIMEOUT_MS / 1000}s`, true, `status=${run.status}`);

  // Assert outcome by comparing API fields, not log strings
  record(
    `${caseName}: run.status === "passed"`,
    run.status === "passed",
    `actual: ${run.status}`
  );

  record(
    `${caseName}: run.actualOutcome === "${expectedOutcome}"`,
    run.actualOutcome === expectedOutcome,
    `actual: ${run.actualOutcome}`
  );

  record(
    `${caseName}: run.expectedOutcome === "${expectedOutcome}"`,
    run.expectedOutcome === expectedOutcome,
    `actual: ${run.expectedOutcome}`
  );

  checkRedaction(`run ${caseName}`, run);

  // Fetch steps
  try {
    const stepsResp = await fetchJson(`${BFF_URL}/api/v1/runs/${runId}/steps`, { timeoutMs: 10_000 });
    record(`${caseName}: steps.items non-empty`, Array.isArray(stepsResp.items) && stepsResp.items.length > 0, `count: ${stepsResp.items?.length}`);
    checkRedaction(`steps ${caseName}`, stepsResp);
  } catch (err) {
    record(`${caseName}: GET /runs/${runId}/steps`, false, err.message);
  }

  // Fetch exchanges
  try {
    const exResp = await fetchJson(`${BFF_URL}/api/v1/runs/${runId}/exchanges`, { timeoutMs: 10_000 });
    record(`${caseName}: exchanges.items non-empty`, Array.isArray(exResp.items) && exResp.items.length > 0, `count: ${exResp.items?.length}`);
    checkRedaction(`exchanges ${caseName}`, exResp);
  } catch (err) {
    record(`${caseName}: GET /runs/${runId}/exchanges`, false, err.message);
  }

  // Fetch report
  try {
    const report = await fetchJson(`${BFF_URL}/api/v1/runs/${runId}/report?format=json`, { timeoutMs: 10_000 });
    const expectedTier = health.driverMode === "collab" ? "mock_interop" : "fixture";
    record(`${caseName}: report.evidence.tier === "${expectedTier}"`, report.evidence?.tier === expectedTier, `actual: ${report.evidence?.tier}`);
    checkRedaction(`report ${caseName}`, report);
  } catch (err) {
    record(`${caseName}: GET /runs/${runId}/report`, false, err.message);
  }

  return runId;
}

const baselineRunId = await runCase("baseline (valid)", null, "valid");
const corruptRunId = await runCase("bad_signature (invalid)", "bad_signature", "invalid");

// ─── Step 4: Matrix export ───────────────────────────────────────────────────

console.log("\n── Step 4: Matrix export ───────────────────────────────────────────");

try {
  const matrix = await fetchJson(`${BFF_URL}/api/v1/matrix/export?format=json`, { timeoutMs: 10_000 });
  const runIds = [baselineRunId, corruptRunId].filter(Boolean);
  const matched = matrix.items?.filter((item) => runIds.includes(item.id)) ?? [];
  record("Matrix contains both test runs", matched.length === runIds.length, `found ${matched.length}/${runIds.length}`);
  checkRedaction("matrix export", matrix);
} catch (err) {
  record("GET /matrix/export?format=json", false, err.message);
}

// ─── Step 5: Summary ─────────────────────────────────────────────────────────

const total = passed + failed;
console.log("\n────────────────────────────────────────────────────────────────────");
console.log("E2E smoke summary");
console.log("────────────────────────────────────────────────────────────────────");
console.log(`  Passed : ${passed}/${total}`);
console.log(`  Failed : ${failed}/${total}`);
console.log("────────────────────────────────────────────────────────────────────");

if (failed > 0) {
  console.error("\nFailed assertions:");
  for (const r of results.filter((r) => !r.ok)) {
    console.error(`  ✗  ${r.name}${r.detail ? ": " + r.detail : ""}`);
  }
  console.error("\nSMOKE FAILED");
  process.exit(1);
}

console.log(`
All ${total} assertions passed.

Evidence limit: Mock/fixture smoke only. No local Inji stack was started.
This result DOES NOT prove Inji Web or Inji Wallet interoperability.
A1 and A2 real-wallet gates are separate and owned by other team members.
`);
