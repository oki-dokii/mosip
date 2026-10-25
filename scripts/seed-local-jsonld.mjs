// Add a synthetic JSON-LD configuration to the dedicated local Certify DB.
// The credential is not exported; this script only installs a public template.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtime = process.env.MOBILE_RUNTIME_DIR ?? join(tmpdir(), 'mosip-mobile-inji');
const configurationId = 'PlaygroundIdentity_LDP_VC';
const context = 'https://inji.github.io/inji-config/contexts/farmer.json';

function sql(value) { return `'${String(value).replaceAll("'", "''")}'`; }
const template = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    context,
    'https://w3id.org/security/suites/ed25519-2020/v1',
  ],
  issuer: '${_issuer}',
  type: ['VerifiableCredential', 'FarmerCredential'],
  issuanceDate: '${validFrom}',
  expirationDate: '${validUntil}',
  credentialSubject: {
    id: "#if($_holderId.endsWith('#0'))${_holderId.replace('=', '')}#else${_holderId.replace('=', '')}#0#end",
    fullName: '${fullName}',
    farmerID: '${farmerID}',
  },
};

async function main() {
  const state = JSON.parse(await readFile(join(runtime, 'public-state.json'), 'utf8'));
  if (state.issuer !== 'http://127.0.0.1:18090' || state.localOnly !== true) throw new Error('LOCAL_CERTIFY_REQUIRED');
  const seed = `ALTER TABLE certify.credential_config ADD COLUMN IF NOT EXISTS credential_subject JSONB;
    INSERT INTO certify.credential_config
    (credential_config_key_id, config_id, status, vc_template, context, credential_type,
     credential_format, did_url, key_manager_app_id, key_manager_ref_id, signature_algo,
     signature_crypto_suite, display, display_order, scope,
     cryptographic_binding_methods_supported, credential_signing_alg_values_supported,
     proof_types_supported, claims, cr_dtimes)
    VALUES (${sql(configurationId)}, 'local-jsonld-identity', 'active',
      ${sql(Buffer.from(JSON.stringify(template)).toString('base64'))},
      ${sql([context, 'https://www.w3.org/2018/credentials/v1'].sort().join(','))},
      'FarmerCredential,VerifiableCredential', 'ldp_vc',
      'did:web:local.test', 'CERTIFY_VC_SIGN_ED25519', 'ED25519_SIGN',
      'EdDSA', 'Ed25519Signature2020',
      ${sql(JSON.stringify([{ name: 'Playground Synthetic Farmer', locale: 'en' }]))}::jsonb,
      ARRAY['fullName','farmerID'], 'playground_farmer_ldp', ARRAY['did:jwk'],
      ARRAY['Ed25519Signature2020'],
      '{"jwt":{"proof_signing_alg_values_supported":["Ed25519","RS256","EdDSA"]}}'::jsonb,
      ${sql(JSON.stringify({
        fullName: { display: [{ name: 'Full Name', locale: 'en' }] },
        farmerID: { display: [{ name: 'Farmer ID', locale: 'en' }] },
        validFrom: { display: [{ name: 'Valid From', locale: 'en' }] },
        validUntil: { display: [{ name: 'Valid Until', locale: 'en' }] },
      }))}::jsonb,
      NOW())
    ON CONFLICT (credential_config_key_id) DO UPDATE SET
      vc_template=EXCLUDED.vc_template, context=EXCLUDED.context,
      credential_type=EXCLUDED.credential_type, did_url=EXCLUDED.did_url,
      proof_types_supported=EXCLUDED.proof_types_supported,
      claims=EXCLUDED.claims;
    UPDATE certify.credential_config SET credential_subject=claims
      WHERE credential_config_key_id=${sql(configurationId)};
`;
  await writeFile(join(runtime, 'local-jsonld-seed.sql'), seed, { mode: 0o600 });
  execFileSync('docker', ['compose', '-p', 'mosip-mobile-a2', '-f', 'deploy/docker-compose.mobile.yml',
    'exec', '-T', 'mobile-db', 'psql', '-U', 'postgres', '-d', 'inji_certify', '-v', 'ON_ERROR_STOP=1'],
  { input: seed, stdio: ['pipe', 'ignore', 'pipe'], env: {
    ...process.env, MOBILE_RUNTIME_DIR: runtime,
    MOBILE_DB_PASSWORD: JSON.parse(await readFile(join(runtime, 'settings.json'), 'utf8')).databasePassword,
  } });
  const response = await fetch('http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer', { signal: AbortSignal.timeout(5000) });
  const metadata = await response.json();
  if (response.status !== 200 || metadata.credential_configurations_supported?.[configurationId]?.format !== 'ldp_vc') throw new Error('JSONLD_METADATA_NOT_READY');
  console.log(JSON.stringify({ result: 'LOCAL_JSONLD_METADATA_READY', configurationId, format: 'ldp_vc', issuer: state.issuer }));
}

main().catch(error => {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_JSONLD_SEED_FAILED');
  process.exitCode = 1;
});
