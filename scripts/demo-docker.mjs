import { spawnSync } from 'node:child_process';

const check1 = spawnSync('docker', ['info'], { stdio: 'ignore', shell: process.platform === 'win32' });
let dockerContext = process.env.DOCKER_CONTEXT;
if (check1.status !== 0) {
  const check2 = spawnSync('docker', ['--context', 'desktop-linux', 'info'], { stdio: 'ignore', shell: process.platform === 'win32' });
  if (check2.status === 0) {
    dockerContext = 'desktop-linux';
  } else {
    console.error('Docker daemon is unavailable. Start Docker Desktop or set DOCKER_CONTEXT.');
    process.exit(1);
  }
}

const env = {
  ...process.env,
  ...(dockerContext ? { DOCKER_CONTEXT: dockerContext } : {}),
  PLAYGROUND_DRIVER_MODE: 'collab',
  MOCK_ISSUER_BASE_URL: 'http://mock-issuer:4101',
  MOCK_VERIFIER_BASE_URL: 'http://mock-verifier:4102',
  MOCK_ISSUER_ENABLE_TEST_CASES: 'true',
};

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('docker', ['compose', '--profile', 'core', '--profile', 'mocks', 'up', '-d', '--build', '--wait'], { env });
run(process.execPath, ['scripts/compose-smoke.mjs'], { env });
console.log(`DEMO PASS — open http://localhost:${process.env.PLAYGROUND_WEB_PORT || 5174}`);

