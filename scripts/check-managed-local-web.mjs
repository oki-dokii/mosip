// Fresh playground-managed local run; only sanitized exports leave the BFF.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bff = process.env.LOCAL_ASSISTED_BFF_URL ?? 'http://127.0.0.1:4500';
if (!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(bff)) throw new Error('LOCAL_BFF_POLICY');
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const api = async (path, value) => {
  const response = await fetch(bff + '/api/v1' + path, { ...(value === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('LOCAL_MANAGED_API_FAILED');
  return response.json();
};
async function child(script, extra = {}) {
  const processChild = spawn(process.execPath, [script], { env: { ...process.env, ...extra }, stdio: ['ignore', 'inherit', 'inherit'] });
  await new Promise((resolve, reject) => { processChild.once('error', reject); processChild.once('exit', code => code === 0 ? resolve() : reject(new Error('LOCAL_WALLET_CHECK_FAILED'))); });
}
let runId;
async function waitFor(key) {
  for (let n = 0; n < 90; n++) {
    const status = await api('/assisted/runs/' + runId);
    if (key === 'passed' && status.run.status === 'passed') return status;
    if (status.steps?.some(step => step.stepKey === key && step.status === 'running')) return status;
    if (['errored', 'failed', 'cancelled'].includes(status.run.status)) throw new Error('LOCAL_MANAGED_CHECKPOINT_FAILED');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('LOCAL_MANAGED_WAIT_TIMEOUT');
}
try {
  const expected = {
    'mosip-mobile-a2-mobile-certify-1': 'injistack/inji-certify-with-plugins:0.14.0@sha256:f6686f55f5202815ff691a11bbaa7d1ce5bab4e5b8feaeeda0e33d6bba6bd00b',
    'mosip-web-local-mimoto-service-1': 'injistack/mimoto:0.22.0@sha256:89fc81eeb8c911c8a9944e4071d8f3e8f287d3de697c4461f2b3a2e8ce29858e',
    'mosip-web-local-inji-web-1': 'injistack/inji-web:0.17.0@sha256:62ca25a6c2f5c3d61edfed1e43e52885f1bcf1229b3a3ffb89c117245f839719',
    'mosip-local-inji-verify-service-1': 'injistack/inji-verify-service:0.18.2@sha256:2ed468e7e1f1ce317a41476dd131f4ce8f081b0f055a080c95e99a92cc192bdd',
  };
  const components = [];
  for (const [container, image] of Object.entries(expected)) {
    const [configuredImage, imageId] = execFileSync('docker', ['inspect', '--format', '{{.Config.Image}}|{{.Image}}', container], { encoding: 'utf8' }).trim().split('|');
    if (configuredImage !== image || !/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('LOCAL_IMAGE_PROVENANCE_MISMATCH');
    components.push({ container, configuredImage, imageId });
  }
  const provenance = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceTreeClean: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() === '',
    deployment: 'local_synthetic', components,
    limits: ['Synthetic IAR authorization fixture', 'Declared DID assertionMethod adapter', 'Public contexts require network', 'Not a conformance certification'] };
  const config = { issuer: 'inji_certify', wallet: 'inji_web_assisted', verifier: 'inji_verify', format: 'ldp_vc', flow: 'cross_device', tamper: null, scenarioId: null };
  ({ runId } = await api('/assisted/runs', { config, mode: 'live', timeoutMs: 120000 }));
  await waitFor('ISSUE_CREDENTIAL');
  await child('scripts/check-inji-web-jsonld.mjs');
  const issued = JSON.parse(await readFile(join(runtime, 'jsonld-issuance-result.json'), 'utf8'));
  if (issued.storedAfterReload !== true || issued.issuedCredentialCorrelated !== true) throw new Error('LOCAL_STORAGE_NOT_CONFIRMED');
  await waitFor('STORE');
  await api('/assisted/runs/' + runId + '/observations', { kind: 'storage' });
  await waitFor('PRESENT_SUBMIT');
  await child('scripts/check-inji-web-presentation.mjs', { LOCAL_ASSISTED_RUN_ID: runId, LOCAL_ASSISTED_BFF_URL: bff });
  await waitFor('passed');
  const report = await api('/runs/' + runId + '/report');
  const coverage = await api('/runs/' + runId + '/capture/coverage');
  const hops = coverage.serverHops;
  for (const rule of ['certify-token', 'certify-credential', 'verify-submit']) if (!hops.some(hop => hop.ruleId === rule && hop.state === 'observed')) throw new Error('LOCAL_SERVER_HOP_MISSING');
  const issuance = JSON.parse(await readFile(join(runtime, 'jsonld-issuance-result.json'), 'utf8'));
  const presentation = JSON.parse(await readFile(join(runtime, 'jsonld-presentation-result.json'), 'utf8'));
  const browserChecks = { observedAt: presentation.observedAt, source: 'real_local_inji_web_synthetic_wallet',
    exactCardReloaded: issuance.storedAfterReload === true && issuance.issuedCredentialCorrelated === true,
    sameWallet: presentation.walletMatchesIssuance === true, selectedCredentialMatchesIssuance: presentation.selectedCredentialMatchesIssuance === true,
    verifierValid: presentation.verifierValid === true, credentialProofValid: presentation.verifierDetails?.credentialProofValid === true,
    holderProofValid: presentation.verifierDetails?.holderProofValid === true };
  const directory = join(runtime, 'managed-evidence');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const [name, value] of Object.entries({ 'run-report.json': report, 'coverage.json': coverage, 'provenance.json': { ...provenance, runId }, 'browser-checks.json': browserChecks })) await writeFile(join(directory, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ result: 'LOCAL_MANAGED_JSONLD_PASS', runId, serverHops: hops }));
} catch (error) {
  if (runId) await api('/assisted/runs/' + runId + '/cancel', {}).catch(() => {});
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_MANAGED_FAILED');
  process.exitCode = 1;
}
