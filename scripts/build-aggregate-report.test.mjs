import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAggregate, sources } from './build-aggregate-report.mjs';
const load = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
test('current aggregate preserves actual record kinds, IDs and deployment/version boundaries', async () => {
  const { matrix, markdown } = await buildAggregate();
  assert.equal(matrix.records.length, 12);
  const hosted = matrix.records.find(row => row.deployment === 'hosted_collab_web');
  assert.equal(hosted.versions.wallet, 'unreported');
  assert.equal((await load(sources.hosted)).run.serviceVersions.wallet, 'reference-wallet/0.1.0');
  assert.ok(matrix.records.filter(row => row.recordKind !== 'bff_run').every(row => row.bffRunId === null));
  assert.match(markdown, /f5f56b45-3160-49b3-96ff-e1238c412fb1/);
  assert.doesNotMatch(markdown, /A1 blocked on account|A1 is still separate and unpassed/);
});
for (const [name, change] of [
  ['missing reload proof', d => { d.managedBrowser.exactCardReloaded = false; }],
  ['mismatched provenance run', d => { d.managedProvenance.runId = 'wrong'; }],
  ['invented Android BFF record', d => { d.mobile.bffRunId = 'wrong'; }],
  ['unlinked issuance exchange', d => { d.hosted.steps.find(s => s.stepKey === 'ISSUE_CREDENTIAL').summary.exchangeId = 'wrong'; }],
]) test('rejects ' + name, async () => {
  const data = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key,path]) => [key, await load(path)])));
  change(data);
  await assert.rejects(buildAggregate(async path => data[Object.keys(sources).find(key => sources[key] === path)]), /INTEGRITY/);
});
