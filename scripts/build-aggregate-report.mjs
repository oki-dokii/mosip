import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const sources = {
  mocks: 'submission/evidence/2026-10-23-ci-mock-matrix.json',
  externalValid: 'submission/evidence/2026-10-21-mock-x509-valid.json',
  externalInvalid: 'submission/evidence/2026-10-21-mock-x509-bad-signature.json',
  hosted: 'submission/evidence/person2-managed-a1-2026-10-25/run-report.json',
  managed: 'submission/evidence/2026-10-26-managed-local-jsonld/run-report.json',
  managedProvenance: 'submission/evidence/2026-10-26-managed-local-jsonld/provenance.json',
  managedBrowser: 'submission/evidence/2026-10-26-managed-local-jsonld/browser-checks.json',
  directIssuance: 'submission/evidence/2026-10-26-local-web-jsonld/issuance.json',
  directPresentation: 'submission/evidence/2026-10-26-local-web-jsonld/presentation.json',
  mobile: 'submission/evidence/person3-a2-mobile-2026-10-23/attempt.json',
  mobileResult: 'submission/evidence/person3-a2-mobile-2026-10-23/verifier-result.json',
};
const root = new URL('../', import.meta.url);
export async function buildAggregate(load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))) {
  const data = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key, path]) => [key, await load(path)])));
  const require = condition => { if (!condition) throw new Error('AGGREGATE_EVIDENCE_INTEGRITY_FAILED'); };
  require(data.mocks.source === 'synthetic Docker mock matrix' && data.mocks.dirtyWorkingTree === false && data.mocks.items.length === 6 && data.mocks.reports.length === 6);
  require(data.mocks.items.every(run => run.status === 'passed' && data.mocks.reports.some(report => report.run.id === run.id)));
  const hosted = data.hosted, managed = data.managed;
  for (const report of [hosted, managed]) {
    const steps = report.steps;
    const issue = steps.find(step => step.stepKey === 'ISSUE_CREDENTIAL');
    const submit = steps.find(step => step.stepKey === 'PRESENT_SUBMIT');
    const result = steps.find(step => step.stepKey === 'PRESENT_RESULT');
    require(report.run.status === 'passed' && report.run.actualOutcome === 'valid' && report.run.config.wallet === 'inji_web_assisted' &&
      issue?.summary?.issuanceObserved === true && steps.find(step => step.stepKey === 'STORE')?.summary?.storageConfirmed === true &&
      submit?.summary?.presentationObserved === true && result?.summary?.outcome === 'valid' &&
      [issue, submit].every(step => report.exchanges.some(exchange => exchange.id === step.summary.exchangeId && exchange.runId === report.run.id && exchange.stepId === step.id)));
  }
  require(data.managedProvenance.runId === managed.run.id && data.managedProvenance.sourceTreeClean === true &&
    managed.run.protocolProfile === 'local-jsonld-pex-0.18.2' && data.managedBrowser.exactCardReloaded === true &&
    data.managedBrowser.sameWallet === true && data.managedBrowser.selectedCredentialMatchesIssuance === true &&
    data.managedBrowser.credentialProofValid === true && data.managedBrowser.holderProofValid === true);
  require(data.directIssuance.storedAfterReload === true && data.directPresentation.verifierValid === true && data.directPresentation.walletMatchesIssuance === true && data.directPresentation.selectedCredentialMatchesIssuance === true);
  require(data.mobile.status === 'passed' && data.mobile.bffRunId === null && data.mobile.attemptId === data.mobileResult.attemptId &&
    data.mobileResult.outcome === 'valid' && data.mobileResult.credentialProofValid === true && data.mobileResult.holderProofValid === true);

  const rows = [];
  const addRun = (report, deployment, source, limits) => {
    const run = structuredClone(report.run);
    const corrections = [];
    if (run.config.wallet === 'inji_web_assisted' && run.serviceVersions?.wallet === 'reference-wallet/0.1.0') {
      run.serviceVersions.wallet = 'unreported';
      corrections.push('Historical export incorrectly labelled Inji Web as reference-wallet/0.1.0; corrected only in this projection.');
    }
    rows.push({ recordKind: 'bff_run', recordId: run.id, bffRunId: run.id, deployment,
      participants: { issuer: run.config.issuer, wallet: run.config.wallet, verifier: run.config.verifier },
      format: run.config.format, scenario: run.config.tamper ?? 'none', protocolProfile: run.protocolProfile ?? 'unreported',
      versions: run.serviceVersions ?? { issuer: 'unreported', wallet: 'unreported', verifier: 'unreported' },
      expected: run.expectedOutcome, actual: run.actualOutcome, evaluation: run.evaluation?.verdict ?? 'not_recorded',
      observedAt: run.finishedAt, source, corrections, limits });
  };
  for (const report of data.mocks.reports) addRun(report, 'docker_mock_ci', sources.mocks, ['Synthetic mock issuer/verifier and Reference Wallet; not Inji wallet evidence.']);
  for (const key of ['externalValid', 'externalInvalid']) {
    require(data[key].evidence?.tier === 'mock_interop');
    addRun(data[key], 'mock_issuer_collab_verify', sources[key], ['Self-signed synthetic X.509 issuer, Reference Wallet; Collab Verify build unreported.', 'Historical negatives lack exact reason diagnostics.']);
  }
  addRun(hosted, 'hosted_collab_web', sources.hosted, ['Browser→Mimoto observations only; downstream server hops not observed.', 'Deployed versions unreported; final team review separate.']);
  addRun(managed, 'local_synthetic_web', sources.managed, ['Synthetic IAR authorization fixture and declared DID assertionMethod adapter.', 'Canonical server hops observed; browser capture not attached; signed request passed by value.', 'Public context network dependency and KERNEL health warning remain.', 'Generic report evidence tier remains unverified; this is an observed functional pass, not conformance certification.']);
  rows.push({ recordKind: 'direct_wallet_harness', recordId: 'local-web-jsonld-2026-10-26', bffRunId: null,
    deployment: 'local_synthetic_web_direct', participants: { issuer: 'inji_certify', wallet: 'inji_web', verifier: 'inji_verify' },
    format: 'ldp_vc', scenario: 'none', protocolProfile: 'local-jsonld-pex-0.18.2',
    versions: { issuer: data.directPresentation.issuerVersion, wallet: data.directPresentation.walletVersion, verifier: data.directPresentation.verifierVersion },
    expected: 'valid', actual: 'valid', evaluation: 'observed_wallet_chain', observedAt: data.directPresentation.observedAt,
    source: sources.directPresentation, corrections: [], limits: ['Separate direct harness; no fabricated BFF run ID.', 'Synthetic authorization and DID adapter; public context dependency.'] });
  rows.push({ recordKind: 'manual_android_observation', recordId: data.mobile.attemptId, bffRunId: null,
    deployment: 'hybrid_local_certify_android_collab_verify', participants: { issuer: 'inji_certify', wallet: 'inji_mobile', verifier: 'inji_verify' },
    format: 'vc_sd_jwt', scenario: 'none', protocolProfile: 'manual_hybrid',
    versions: { issuer: '1.0.0-alpha.1', wallet: `${data.mobile.participants.wallet.aboutVersionObserved} (About screen)`, verifier: 'unreported' },
    expected: 'valid', actual: 'valid', evaluation: 'observed_wallet_chain', observedAt: data.mobileResult.observedAt,
    source: sources.mobile, corrections: [], limits: ['Reopen persistence is user-confirmed.', 'Installed APK/source identity and Collab build not independently attested.', 'Hybrid path, not Android→local Verify; no native capture or BFF run ID.'] });
  rows.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.recordId.localeCompare(b.recordId));
  const matrix = { schemaVersion: 1, updated: '2026-10-26', source: 'committed_evidence_projection', executesNewFlows: false,
    records: rows, sources: Object.values(sources),
    notObserved: ['Android wallet → fully local Verify', 'Inji Web SD-JWT presentation', 'Executed external ecosystem issuer/verifier', 'mDoc/DC API/iOS wallet chain', 'Independent-machine full local wallet rehearsal'] };
  const cell = value => String(value ?? 'unreported').replaceAll('|', '\\|').replaceAll('`', "'").replace(/[<>\r\n]/g, ' ');
  const link = path => path.slice('submission/evidence/'.length);
  const lines = ['# Aggregate interoperability evidence — 26 October 2026', '',
    'Generated from committed source records. This command executes no wallet or network flow. Hosted, local, direct-harness and Android evidence stay separate; direct/manual records have no invented BFF run IDs. Historical source files are preserved.', '',
    '## Recorded results', '', '| Record / source | Deployment | Participants | Format / fault | Expected / actual | Evaluation | Versions: issuer / wallet / verifier | Observed (UTC) |', '|---|---|---|---|---|---|---|---|',
    ...rows.map(row => `| [${cell(row.recordId)}](${link(row.source)}) | ${cell(row.deployment)} (${row.recordKind}) | ${cell(Object.values(row.participants).join(' → '))} | ${cell(row.format)} / ${cell(row.scenario)} | ${cell(row.expected)} / ${cell(row.actual)} | ${cell(row.evaluation)} | ${cell(Object.values(row.versions).join(' / '))} | ${cell(row.observedAt)} |`), '',
    '## Provenance and boundaries', '',
    ...rows.filter(row => row.recordKind !== 'bff_run' || ['hosted_collab_web', 'local_synthetic_web'].includes(row.deployment)).flatMap(row => [`### ${cell(row.recordId)}`, '', ...[...row.corrections, ...row.limits].map(limit => `- ${limit}`), '']),
    `The local managed record has source commit \`${cell(data.managedProvenance.sourceCommit)}\`, a clean source tree and running-image digests in [its provenance](${link(sources.managedProvenance)}). Exact-card reload, same-wallet selection and both proof checks are recorded separately in [browser checks](${link(sources.managedBrowser)}).`, '',
    'The original hosted wallet version was incorrectly reference-wallet/0.1.0. The current aggregate and archived API projection use unreported; the immutable source is not rewritten and local Web 0.17.0 is not substituted for the hosted release.', '',
    'A passing HTTP transport is not a verifier verdict. A known invalid negative without exact reason diagnostics is not counted as an exact-reason conformance pass. The mock replay_nonce preset is a nonce mutation, not true byte replay.', '',
    '## Still unobserved in these committed records', '', ...matrix.notObserved.map(item => `- ${item}`), '',
    'Final team acceptance, independent setup, private gap reporting and current CI are separate release checks. See [readiness](../READINESS.md), [findings](../../docs/GAPS.md) and the [current assignment](../../docs/FINAL_FOUR_PERSON_EXECUTION_PLAN.md).', ''];
  return { markdown: lines.join('\n'), matrix };
}
export async function writeAggregate(check = false) {
  const result = await buildAggregate();
  for (const [path, text] of [
    ['submission/evidence/2026-10-26-aggregate-interop.md', result.markdown],
    ['submission/evidence/2026-10-26-aggregate-matrix.json', JSON.stringify(result.matrix, null, 2) + '\n'],
  ]) {
    const url = new URL(path, root);
    if (check) { if (await readFile(url, 'utf8') !== text) throw new Error('AGGREGATE_OUTPUT_STALE'); }
    else await writeFile(url, text);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writeAggregate(process.argv.includes('--check'));
