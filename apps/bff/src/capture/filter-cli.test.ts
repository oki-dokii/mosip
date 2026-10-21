import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, stat, rm, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, it } from "vitest";
import { harEntry } from "./fixtures/adversarial.js";

const exec = promisify(execFile);
const cwd = fileURLToPath(new URL("../..", import.meta.url));
const directories: string[] = [];
const runId = "f1571de0-0000-4000-8000-000000000003";
async function files() {
  const dir = await mkdtemp(join(tmpdir(), "capture-cli-")); directories.push(dir);
  return { input: join(dir, "input.json"), output: join(dir, "output.json") };
}
function cli(input: string, output: string) {
  return exec(process.execPath, ["--import", "tsx", "src/capture/filter.ts", input, output, runId], {
    cwd, timeout: 10_000, maxBuffer: 32_768,
    env: { ...process.env, CAPTURE_ORIGINS_JSON: JSON.stringify({ "https://issuer.example": "certify" }) },
  });
}
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

it("CLI filters real-shaped asset-heavy HAR, unknown timings and bad entries with counted reasons", async () => {
  const { input, output } = await files();
  const assets = Array.from({ length: 500 }, () => ({ request: { method: "GET", url: "https://issuer.example/assets/main.js" } }));
  const good = harEntry({ access_token: "CANARY_CLI_SECRET" });
  await writeFile(input, JSON.stringify({ log: { version: "1.2", entries: [...assets, good, harEntry({}, good.request.url, 0), null, { request: {} }] } }));
  const { stdout, stderr } = await cli(input, output);
  const report = JSON.parse(stdout);
  expect(report).toMatchObject({ inputEntries: 504, outputEntries: 1, skippedReasons: { untagged: 500, unfinished_request: 1, malformed_entry: 2 } });
  expect(stderr).toBe("");
  const saved = await readFile(output, "utf8");
  expect(saved).not.toContain("CANARY_");
  expect(JSON.parse(saved).har.log.entries[0].time).toBe(-1);
  expect((await stat(output)).mode & 0o777).toBe(0o600);
  const again = await cli(input, output).catch((error: unknown) => error) as { code: number; stderr: string };
  expect(again.code).toBe(1);
  expect(again.stderr).not.toContain("CANARY_");
  expect(await readFile(output, "utf8")).toBe(saved);
}, 20_000);

it("CLI rejects huge and malformed files within a deadline, creates no output and never echoes input", async () => {
  const { input, output } = await files();
  const handle = await open(input, "w");
  await handle.truncate(33 * 1024 * 1024); await handle.close();
  for (const huge of [true, false]) {
    if (!huge) await writeFile(input, '{"access_token":"CANARY_MALFORMED"');
    const result = await cli(input, output).catch((error: unknown) => error) as { code: number; killed: boolean; stdout: string; stderr: string };
    expect(result.code).toBe(1);
    expect(result.killed).toBe(false);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^CAPTURE_FILTER_FAILED:/);
    expect(result.stderr).not.toContain("CANARY_");
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }
}, 25_000);
