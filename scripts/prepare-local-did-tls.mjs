// Trust a short-lived synthetic local.test DID endpoint in the local service JVMs.
// Cert/key/truststore stay in the owner-only runtime and never enter Git.
import { execFileSync } from 'node:child_process';
import { chmod, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const image = 'injistack/mimoto:0.22.0@sha256:89fc81eeb8c911c8a9944e4071d8f3e8f287d3de697c4461f2b3a2e8ce29858e';
let stage = 'config';
function run(binary, args) { return execFileSync(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }

async function main() {
  const config = JSON.parse(await readFile(join(runtime, 'mimoto-issuers-config.json'), 'utf8'));
  if (!JSON.stringify(config).includes('LocalFarmer')) throw new Error('LOCAL_ISSUER_CONFIG_REQUIRED');
  const key = join(runtime, 'localhost.key');
  const certificate = join(runtime, 'localhost.crt');
  const truststore = join(runtime, 'local-truststore');
  stage = 'certificate';
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '7',
    '-keyout', key, '-out', certificate, '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:local.test,DNS:localhost']);
  await chmod(key, 0o600); await chmod(certificate, 0o600);
  stage = 'image';
  const temporary = run('docker', ['create', '--entrypoint', '/bin/true', image]).toString().trim();
  if (!/^[a-f0-9]{64}$/.test(temporary)) throw new Error('LOCAL_IMAGE_CREATE_FAILED');
  stage = 'copy_truststore';
  try {
    run('docker', ['cp', `${temporary}:/opt/java/openjdk/lib/security/cacerts`, truststore]);
  } finally { run('docker', ['rm', temporary]); }
  stage = 'keytool';
  await chmod(truststore, 0o600);
  run('keytool', ['-importcert', '-noprompt', '-alias', 'mosip-localhost-did',
    '-file', certificate, '-keystore', truststore, '-storepass', 'changeit']);
  console.log(JSON.stringify({ result: 'LOCAL_DID_TLS_READY', did: 'did:web:local.test',
    trustScope: 'local_mimoto_and_verify_jvms', validityDays: 7 }));
}
main().catch(error => {
  console.error(JSON.stringify({ result: 'LOCAL_DID_TLS_SETUP_FAILED', stage,
    code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'COMMAND_FAILED' }));
  process.exitCode = 1;
});
