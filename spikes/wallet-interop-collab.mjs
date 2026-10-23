// Explicit opt-in synthetic public-test probe. Never imports authentication files.
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodeJwt, exportJWK, SignJWT } from "jose";

const certify = "https://injicertify-mock.collab.mosip.net";
const verify = "https://injiverify.collab.mosip.net/v1/verify";
const root = fileURLToPath(new URL("..", import.meta.url));
const allowed = new Set([new URL(certify).origin, new URL(verify).origin, "https://esignet-mock.collab.mosip.net"]);
function fixedTarget(url) { const parsed = new URL(url); if (!allowed.has(parsed.origin) || parsed.username || parsed.password) throw new Error("unapproved_target"); return parsed.href; }
async function http(url, options = {}) {
  const response = await fetch(fixedTarget(url), { ...options, redirect: "error", signal: AbortSignal.timeout(20_000) });
  const chunks = []; let size = 0;
  for await (const chunk of response.body ?? []) { size += chunk.length; if (size > 1_048_576) throw new Error("response_limit"); chunks.push(chunk); }
  let body = null; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { /* no raw error/body export */ }
  return { status: response.status, body };
}
const post = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function versions(base) {
  const checks = [];
  for (const path of ["/actuator/info", "/v3/api-docs"]) {
    try {
      const result = await http(`${base}${path}`);
      const release = result.body?.build?.version;
      checks.push({ path, httpStatus: result.status, deploymentVersion: typeof release === "string" && /^v?\d+(?:\.\d+){1,3}(?:[-+][A-Za-z0-9.-]{1,32})?$/.test(release) ? release : "unreported", apiDescriptionAvailable: path === "/v3/api-docs" && result.status === 200 });
    } catch { checks.push({ path, httpStatus: null, deploymentVersion: "unreported", error: "unavailable" }); }
  }
  return checks;
}
async function preauthorized(configurationId) {
  const result = { configurationId, checkpoints: {}, conclusion: "inconclusive" };
  try {
    const metadata = await http(`${certify}/.well-known/openid-credential-issuer`);
    result.checkpoints.metadata = metadata.status;
    if (metadata.status !== 200 || !metadata.body?.credential_configurations_supported?.[configurationId]) return result;
    const started = await http(`${certify}/v1/certify/pre-authorized-data`, post({ credential_configuration_id: configurationId, claims: { UIN: "9999999999", email: "playground@example.invalid", phone: "0000000000", vcVer: "1.0", gender: "Unspecified", region: "Test Region", fullName: "Synthetic Playground User", postalCode: "000000", dateOfBirth: "2000-01-01", addressLine1: "Synthetic Test Address" }, expires_in: 300 }));
    result.checkpoints.offerCreation = started.status;
    const offerUrl = new URL(started.body?.credential_offer_uri).searchParams.get("credential_offer_uri");
    if (!offerUrl) throw new Error("offer_unavailable");
    const advertised = new URL(offerUrl, certify);
    result.offerUriIsAbsolute = URL.canParse(offerUrl);
    result.offerOriginMatchesIssuer = advertised.origin === new URL(certify).origin;
    const offerId = advertised.pathname.split("/").at(-1);
    if (!offerId || !/^[A-Za-z0-9_-]{1,160}$/.test(offerId)) throw new Error("offer_unavailable");
    // Match the established contract spike: resolve the offer ID through the
    // fixed issuer API, never follow an arbitrary origin from the offer link.
    result.offerResolution = "fixed_issuer_credential_offer_data_endpoint";
    const offer = await http(`${certify}/v1/certify/credential-offer-data/${offerId}`); result.checkpoints.offer = offer.status;
    const code = offer.body?.grants?.["urn:ietf:params:oauth:grant-type:pre-authorized_code"]?.["pre-authorized_code"];
    if (typeof code !== "string") throw new Error("offer_unavailable");
    const token = await http(`${certify}/v1/certify/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code", "pre-authorized_code": code }) });
    result.checkpoints.token = token.status;
    if (typeof token.body?.access_token !== "string") throw new Error("token_unavailable");
    let claims = null; try { claims = decodeJwt(token.body.access_token); } catch { /* opaque token */ }
    result.tokenShape = { jwtDecoded: claims !== null, issuerConfigured: claims ? Boolean(claims.iss) : null, audienceConfigured: claims ? (Array.isArray(claims.aud) ? claims.aud.length > 0 : Boolean(claims.aud)) : null, nonceClaimIncluded: claims ? Boolean(claims.c_nonce) : null, clientIdClaimIncluded: claims ? Boolean(claims.client_id) : null };
    const nonce = await http(metadata.body.nonce_endpoint, { method: "POST" }); result.checkpoints.nonce = nonce.status;
    if (typeof nonce.body?.c_nonce !== "string") throw new Error("nonce_unavailable");
    const key = generateKeyPairSync("ed25519");
    const proof = await new SignJWT({ aud: metadata.body.credential_issuer, nonce: nonce.body.c_nonce, iat: Math.floor(Date.now() / 1000) }).setProtectedHeader({ alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: await exportJWK(key.publicKey) }).sign(key.privateKey);
    if (new URL(metadata.body.credential_endpoint).origin !== new URL(certify).origin) throw new Error("unapproved_target");
    const issued = await http(metadata.body.credential_endpoint, { ...post({ credential_configuration_id: configurationId, proofs: { jwt: [proof] } }), headers: { "content-type": "application/json", authorization: `Bearer ${token.body.access_token}` } });
    result.checkpoints.credential = issued.status;
    result.credentialReturned = Boolean(issued.body?.credential || issued.body?.credentials);
    result.conclusion = result.credentialReturned && issued.status === 200 ? "issued" : issued.status === 401 ? "fresh_pre_authorized_token_rejected" : "rejected_other_reason";
  } catch { result.error = "probe_dependency_unavailable"; }
  return result;
}
async function main() {
  if (process.argv.length !== 6 || process.argv[2] !== "--target" || process.argv[3] !== "collab" || process.argv[4] !== "--out") throw new Error("configuration");
  const out = process.argv[5];
  try { await lstat(out); throw new Error("output_exists"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const [{ createMockIssuer }, { loadIssuerSigner }, { createCollabDrivers }, { MemoryRunRepository }, { createSteps, runDemo }, { buildReport }] = await Promise.all([
    import("../apps/mock-issuer/dist/app.js"), import("../apps/mock-issuer/dist/signing.js"), import("../apps/bff/dist/drivers/collab.js"), import("../apps/bff/dist/store.js"), import("../apps/bff/dist/orchestrator.js"), import("../apps/bff/dist/report.js"),
  ]);
  const directory = await mkdtemp(join(tmpdir(), "person3-live-cert-")), listeners = [];
  process.env.VERIFY_BASE_URL = verify;
  const evidence = { schemaVersion: 1, timestamp: new Date().toISOString(), evidenceTier: "mock_interop_live_investigation", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), dirtyWorkingTree: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()), deploymentVersions: { certify: "unreported", verify: "unreported" }, versionDiscovery: {}, runs: [], preauthorized: [], limits: ["Synthetic Reference Wallet and mock issuer; no real Inji wallet acceptance.", "Self-signed X.509 signature path does not establish certificate-chain trust.", "Generic upstream rejection codes do not establish exact nonce/signature failure reasons.", "Running deployment releases cannot be inferred from API generation or current upstream source."] };
  try {
    evidence.versionDiscovery.certify = await versions(certify);
    evidence.versionDiscovery.verify = await versions(verify);
    const keyPath = join(directory, "key.pem"), certificatePath = join(directory, "cert.pem");
    execFileSync("openssl", ["req", "-x509", "-newkey", "ed25519", "-nodes", "-keyout", keyPath, "-out", certificatePath, "-days", "1", "-subj", "/CN=mock-issuer.example.org", "-addext", "subjectAltName=DNS:mock-issuer.example.org"], { stdio: "ignore" });
    for (const [label, tamper, x509] of [["x509_control", null, true], ["x509_bad_signature", "bad_signature", true], ["x509_nonce_mismatch", "replay_nonce", true], ["did_jwk_control", null, false]]) {
      const signer = await loadIssuerSigner(x509 ? { privateKeyPath: keyPath, certificatePath, issuerUrl: "https://mock-issuer.example.org" } : { issuerUrl: "http://mock-issuer.test" });
      let issuerUrl = "";
      const server = createMockIssuer({ signer, publicBaseUrl: () => issuerUrl }); listeners.push(server);
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      issuerUrl = `http://127.0.0.1:${server.address().port}`;
      process.env.MOCK_ISSUER_BASE_URL = issuerUrl; delete process.env.MOCK_VERIFIER_BASE_URL;
      process.env.VERIFY_POLL_TIMEOUT_MS = "15000"; process.env.VERIFY_POLL_INTERVAL_MS = "250";
      const config = { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper, scenarioId: null };
      const id = randomUUID(), repository = new MemoryRunRepository();
      const run = { id, parentRunId: null, config, status: "pending", expectedOutcome: tamper ? "invalid" : "valid", actualOutcome: null, proofType: "kb+jwt", algorithm: "EdDSA", serviceVersions: { issuer: x509 ? "person3-x509-working-tree" : "person3-did-jwk-working-tree", wallet: "reference-wallet/0.1.0", verifier: "unreported" }, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null };
      await repository.create({ run, steps: createSteps(id), exchanges: [] });
      const drivers = createCollabDrivers(config), present = drivers.wallet.present.bind(drivers.wallet);
      drivers.wallet.present = async (context) => { const claims = context.state.get("collab.requestClaims"); if (new URL(claims?.response_uri).origin !== new URL(verify).origin) throw new Error("unapproved_target"); return present(context); };
      try { await runDemo(id, { of: () => ({ to: () => ({ emit() {} }) }) }, repository, 0, drivers); } catch { /* bounded errored report retained */ }
      evidence.runs.push({ label, report: buildReport(await repository.get(id)) });
      await new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }); listeners.splice(listeners.indexOf(server), 1);
    }
    for (const id of ["MockVerifiableCredential_SD_JWT", "MockVerifiableCredential_VCDM2.0"]) evidence.preauthorized.push(await preauthorized(id));
  } finally {
    await Promise.all(listeners.map((server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); })));
    await rm(directory, { recursive: true, force: true });
    await writeFile(out, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify({ artifactWritten: true, runs: evidence.runs.map(({ label, report }) => ({ label, status: report.run.status, outcome: report.run.actualOutcome, evaluation: report.run.evaluation?.verdict })), preauthorized: evidence.preauthorized.map(({ configurationId, conclusion }) => ({ configurationId, conclusion })) }));
}
main().catch(() => { console.error("Live probe failed: configuration, infrastructure, or artifact error; no secret values emitted"); process.exitCode = 2; });
