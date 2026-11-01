// Read-only prerequisites for the packaged playground.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const checks = [
  ['Node 22 or newer', Number(process.versions.node.split('.')[0]) >= 22, process.version],
];
for (const [label, tool, args, required] of [
  ['Pinned pnpm', 'pnpm', ['--version'], manifest.packageManager.split('@')[1]],
  ['Docker Compose', 'docker', ['compose', 'version', '--short'], null],
  ['Docker daemon', 'docker', ['info', '--format', '{{.ServerVersion}}'], null],
]) {
  const result = spawnSync(tool, args, { encoding:'utf8', timeout:10000 });
  const version = result.stdout?.trim() ?? '';
  checks.push([label, result.status===0 && Boolean(version) && (!required || version===required), result.status===0 ? version : 'unavailable']);
}
for (const [name, ok, detail] of checks) console.log(ok ? 'PASS' : 'CHECK', name, detail);
process.exitCode=checks.every(([,ok])=>ok)?0:1;
