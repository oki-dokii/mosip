// Switch only the dedicated loopback Certify instance to its bundled CSV plugin.
// IAR access tokens then resolve a synthetic subject ID to synthetic claim data.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtime = process.env.MOBILE_RUNTIME_DIR ?? join(tmpdir(), 'mosip-mobile-inji');
async function main() {
  const state = JSON.parse(await readFile(join(runtime, 'public-state.json'), 'utf8'));
  if (!state.localOnly || state.issuer !== 'http://127.0.0.1:18090') throw new Error('LOCAL_CERTIFY_REQUIRED');
  const settings = JSON.parse(await readFile(join(runtime, 'settings.json'), 'utf8'));
  const legacyMetadata = `UPDATE certify.credential_config SET status='inactive',
    sd_jwt_claims=(SELECT jsonb_object_agg(key,value - 'mandatory') FROM jsonb_each(sd_jwt_claims))
    WHERE credential_config_key_id='MockVerifiableCredential_SD_JWT';`;
  execFileSync('docker', ['compose', '-p', process.env.MOBILE_COMPOSE_PROJECT ?? 'mosip-mobile-a2', '-f', 'deploy/docker-compose.mobile.yml',
    'exec', '-T', 'mobile-db', 'psql', '-U', 'postgres', '-d', 'inji_certify', '-v', 'ON_ERROR_STOP=1'],
  { input: legacyMetadata, stdio: ['pipe', 'ignore', 'pipe'], env: {
    ...process.env, MOBILE_RUNTIME_DIR: runtime, MOBILE_DB_PASSWORD: settings.databasePassword,
  } });
  const csv = 'id,fullName,farmerID,validFrom,validUntil\nSYNTHETIC-001,Ada Example,SYNTHETIC-001,2026-10-25T00:00:00Z,2027-10-25T00:00:00Z\n';
  await writeFile(join(runtime, 'synthetic-farmer.csv'), csv, { mode: 0o600 });
  const propertiesPath = join(runtime, 'certify-default.properties');
  let properties = await readFile(propertiesPath, 'utf8');
  properties = properties.split('\n# Local Web synthetic CSV fixture\n')[0];
  properties += '\n# Local Web synthetic CSV fixture\n';
  properties += 'mosip.certify.integration.data-provider-plugin=MockCSVDataProviderPlugin\n';
  properties += 'mosip.certify.mock.data-provider.csv.identifier-column=id\n';
  properties += 'mosip.certify.mock.data-provider.csv.data-columns=id,fullName,farmerID,validFrom,validUntil\n';
  properties += 'mosip.certify.mock.data-provider.csv-registry-uri=/home/mosip/config/synthetic-farmer.csv\n';
  properties += 'mosip.certify.data-provider-plugin.did-url=did:web:local.test\n';
  await writeFile(propertiesPath, properties, { mode: 0o600 });
  execFileSync('docker', ['compose', '-p', process.env.MOBILE_COMPOSE_PROJECT ?? 'mosip-mobile-a2', '-f', 'deploy/docker-compose.mobile.yml',
    '-f', 'deploy/docker-compose.certify-web-jsonld.yml',
    'up', '-d', '--force-recreate', '--wait', 'mobile-certify'], { stdio: 'ignore', env: {
      ...process.env, MOBILE_RUNTIME_DIR: runtime, MOBILE_DB_PASSWORD: settings.databasePassword,
    } });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(state.issuer + '/v1/certify/.well-known/openid-credential-issuer',
        { signal: AbortSignal.timeout(2000) });
      const metadata = await response.json();
      if (response.status === 200 && metadata.credential_configurations_supported?.PlaygroundIdentity_LDP_VC?.format === 'ldp_vc') {
        ready = true; break;
      }
    } catch { /* cold startup */ }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!ready) throw new Error('LOCAL_JSONLD_CERTIFY_STARTUP_TIMEOUT');
  await writeFile(join(runtime, 'public-state.json'), JSON.stringify({ ...state,
    activeProfile: 'web_jsonld', configurationId: 'PlaygroundIdentity_LDP_VC',
    image: 'injistack/inji-certify-with-plugins:0.14.0',
    imageDigest: 'sha256:f6686f55f5202815ff691a11bbaa7d1ce5bab4e5b8feaeeda0e33d6bba6bd00b',
    sourceCommit: 'e54539a89616f64dc90e8f6797db9e66d826d97d',
  }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ result: 'LOCAL_SYNTHETIC_CSV_READY', issuer: state.issuer,
    issuerVersion: '0.14.0', subject: 'SYNTHETIC-001' }));
}
main().catch(error => {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_CSV_SETUP_FAILED');
  process.exitCode = 1;
});
