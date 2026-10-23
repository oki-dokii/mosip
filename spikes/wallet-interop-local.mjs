// Build both mock packages first. This launcher creates isolated loopback listeners
// and uses the same HTTP probe CLI as separately running mock processes.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const servers = [];
async function listen(server) {
  servers.push(server);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--out" || !process.argv[3]) throw new Error();
  try { await lstat(process.argv[3]); throw new Error(); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const [{ createMockIssuer }, { createMockVerifier }, { loadIssuerSigner }] = await Promise.all([
    import("../apps/mock-issuer/dist/app.js"), import("../apps/mock-verifier/dist/app.js"), import("../apps/mock-issuer/dist/signing.js"),
  ]);
  let issuerUrl = "", verifierUrl = "";
  const signer = await loadIssuerSigner({ issuerUrl: "http://127.0.0.1" });
  issuerUrl = await listen(createMockIssuer({ signer, enableTestCases: true, publicBaseUrl: () => issuerUrl }));
  verifierUrl = await listen(createMockVerifier({ publicBaseUrl: () => verifierUrl }));
  const out = process.argv[3];
  let runnerExit = 0;
  try {
    const result = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("./wallet-interop-probes.mjs", import.meta.url)), "--issuer", issuerUrl, "--verifier", verifierUrl, "--out", out], { timeout: 300_000, maxBuffer: 4096 });
    process.stdout.write(result.stdout);
  } catch (error) {
    // Only the probe's reviewed fixed messages reach stdout/stderr.
    if (![1, 2].includes(error.code)) throw new Error();
    runnerExit = error.code;
    process.stderr.write("Protocol probe returned a failure or inconclusive result\n");
  }
  const evidence = JSON.parse(await readFile(out, "utf8"));
  if (evidence.exitCode !== runnerExit) throw new Error();
  process.exitCode = evidence.exitCode;
}
try { await main(); }
catch { process.stderr.write("Local protocol launcher failed; build both mock packages and use a new output path\n"); process.exitCode = 2; }
finally { await Promise.all(servers.map((server) => new Promise((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }))); }
