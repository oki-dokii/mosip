import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const settings = JSON.parse(await readFile(join(runtime, 'capture/bff.json'), 'utf8'));
const child = spawn('pnpm', ['--filter', '@playground/bff', 'start'], { stdio: 'inherit', env: { ...process.env, ...settings } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.once('exit', code => { process.exitCode = code ?? 1; });
