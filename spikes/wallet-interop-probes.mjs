import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compactVerify, decodeJwt, decodeProtectedHeader, exportJWK, importJWK, importX509, SignJWT } from "jose";
import { evaluate, exitCode, safeObservation, knownCodes } from "./wallet-interop-evaluate.mjs";
const hash = (text) => createHash("sha256").update(text, "ascii").digest("base64url");
const now = () => Math.floor(Date.now() / 1000);
class ProbeError extends Error { constructor(code) { super(code); this.code = code; } }
export function validateTarget(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new ProbeError("configuration");
  return url.origin;
}
export function validateCatalog(catalog) {
  const faults = ["bad_signature", "expired", "wrong_type", "wrong_holder", "missing_holder_binding", "wrong_audience", "wrong_nonce", "replay", "used_state", "missing_required", "missing_optional", "unsupported_parameter"];
  if (catalog.schemaVersion !== 1 || catalog.profile !== "mock-sdjwt-flat-v1" || !Array.isArray(catalog.cases) || catalog.cases.length !== faults.length) throw new ProbeError("configuration");
  const ids = new Set(), seen = new Set();
  for (const item of catalog.cases) {
    if (!/^p3\.[a-z_.]{1,64}$/.test(item.id) || ids.has(item.id) || !faults.includes(item.fault) || seen.has(item.fault)) throw new ProbeError("configuration");
    ids.add(item.id); seen.add(item.fault);
    if (!["valid", "invalid"].includes(item.expected?.outcome) || !["result", "direct_post"].includes(item.expected.boundary)) throw new ProbeError("configuration");
    if (item.expected.outcome === "invalid" && (!Object.hasOwn(knownCodes, item.expected.code) || knownCodes[item.expected.code] !== item.expected.stage)) throw new ProbeError("configuration");
  }
  return catalog;
}
async function request(url, init, deadline) {
  const remaining = Math.min(5000, deadline - Date.now());
  if (remaining <= 0) throw new ProbeError("timeout");
  let response;
  try { response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(remaining) }); }
  catch (error) { throw new ProbeError(["TimeoutError", "AbortError"].includes(error?.name) ? "timeout" : "transport"); }
  // Bound the body while streaming, not after an unbounded response.text().
  const reader = response.body?.getReader(); let length = 0; const chunks = [];
  try {
    while (reader) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length; if (length > 65_536) { await reader.cancel(); throw new ProbeError("malformed_result"); }
      chunks.push(part.value);
    }
  } catch (error) { throw error instanceof ProbeError ? error : new ProbeError("transport"); }
  try { return { status: response.status, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }; }
  catch { throw new ProbeError("malformed_result"); }
}
const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function issue(issuer, variant, deadline) {
  const discovery = await request(`${issuer}/.well-known/openid-credential-issuer`, undefined, deadline);
  if (discovery.status !== 200 || discovery.body?.token_endpoint !== `${issuer}/token` || discovery.body?.credential_endpoint !== `${issuer}/credential` || discovery.body?.credential_configurations_supported?.MockVerifiableCredential_SD_JWT?.format !== "dc+sd-jwt") throw new ProbeError("configuration");
  const holder = generateKeyPairSync("ed25519"), publicJwk = await exportJWK(holder.publicKey);
  const token = await request(`${issuer}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code", "pre-authorized_code": "public-test-code", mock_case: variant }) }, deadline);
  if (token.status !== 200 || typeof token.body?.access_token !== "string" || typeof token.body?.c_nonce !== "string") throw new ProbeError("configuration");
  const proof = await new SignJWT({ aud: issuer, nonce: token.body.c_nonce, iat: now() }).setProtectedHeader({ alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: publicJwk }).sign(holder.privateKey);
  const result = await request(`${issuer}/credential`, { ...json({ credential_configuration_id: "MockVerifiableCredential_SD_JWT", proofs: { jwt: [proof] } }), headers: { "content-type": "application/json", authorization: `Bearer ${token.body.access_token}` } }, deadline);
  if (result.status !== 200 || typeof result.body?.credential !== "string") throw new ProbeError("configuration");
  return { holder, credential: result.body.credential };
}
async function challenge(verifier, deadline) {
  const result = await request(`${verifier}/vp-request`, json({ format: "dc+sd-jwt", profile: "mock-sdjwt-flat-v1", requiredClaims: ["given_name"] }), deadline);
  if (result.status !== 201 || typeof result.body?.claims?.nonce !== "string" || typeof result.body?.claims?.state !== "string" || typeof result.body?.requestId !== "string" || result.body?.claims?.client_id !== "mock-verifier" || result.body?.policy?.profile !== "mock-sdjwt-flat-v1") throw new ProbeError("configuration");
  return result.body;
}
async function present(issued, target, fault) {
  const originalJwt = issued.credential.split("~")[0];
  const parts = issued.credential.split("~");
  if (fault === "bad_signature") {
    const jwt = parts[0].split("."); const bytes = Buffer.from(jwt[2], "base64url"); bytes[0] ^= 1; jwt[2] = bytes.toString("base64url"); parts[0] = jwt.join(".");
  }
  if (["missing_required", "missing_optional"].includes(fault)) {
    const name = fault === "missing_required" ? "given_name" : "family_name";
    const index = parts.findIndex((part, i) => i > 0 && part && JSON.parse(Buffer.from(part, "base64url").toString("utf8"))[1] === name);
    if (index < 1) throw new ProbeError("construction"); parts.splice(index, 1);
  }
  const prefix = parts.join("~"), time = now();
  const holderKey = fault === "wrong_holder" ? generateKeyPairSync("ed25519").privateKey : issued.holder.privateKey;
  const kb = await new SignJWT({ iat: time, aud: fault === "wrong_audience" ? "different-verifier" : target.claims.client_id, nonce: fault === "wrong_nonce" ? randomUUID() : target.claims.nonce, sd_hash: hash(prefix) }).setProtectedHeader({ alg: "EdDSA", typ: "kb+jwt" }).sign(holderKey);
  const claims = decodeJwt(originalJwt), header = decodeProtectedHeader(originalJwt);
  const issuerKey = header.x5c ? await importX509(`-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`, header.alg) : await importJWK(JSON.parse(Buffer.from(claims.iss.slice(8), "base64url").toString("utf8")), header.alg);
  let issuerSignatureValid = true, holderSignatureValid = true;
  try { await compactVerify(parts[0], issuerKey); } catch { issuerSignatureValid = false; }
  try { await compactVerify(kb, issued.holder.publicKey); } catch { holderSignatureValid = false; }
  const disclosures = parts.slice(1, -1).map((part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")));
  const committed = disclosures.every((_, i) => claims._sd.includes(hash(parts[i + 1])));
  const holderClaims = decodeJwt(kb);
  const bound = claims.cnf?.jwk?.x === (await exportJWK(issued.holder.publicKey)).x;
  const construction = {
    issuerSignatureAsExpected: issuerSignatureValid === (fault !== "bad_signature"),
    holderSignatureAsExpected: holderSignatureValid === (fault !== "wrong_holder"),
    credentialTypeAsExpected: fault === "wrong_type" ? claims.vct === "UnexpectedCredential" : claims.vct === "MockVerifiableCredential_SD_JWT",
    validityAsExpected: fault === "expired" ? claims.exp < time && claims.nbf <= time : claims.exp > time && claims.nbf <= time,
    holderBindingAsExpected: fault === "missing_holder_binding" ? claims.cnf === undefined : bound,
    bindingHashValid: holderClaims.sd_hash === hash(prefix),
    disclosureCommitmentsValid: committed,
    requiredClaimAsExpected: fault === "missing_required" ? !disclosures.some((item) => item[1] === "given_name") : disclosures.some((item) => item[1] === "given_name"),
    optionalClaimAsExpected: fault === "missing_optional" ? !disclosures.some((item) => item[1] === "family_name") : true,
    audienceAsExpected: fault === "wrong_audience" ? holderClaims.aud !== target.claims.client_id : holderClaims.aud === target.claims.client_id,
    nonceAsExpected: fault === "wrong_nonce" ? holderClaims.nonce !== target.claims.nonce : holderClaims.nonce === target.claims.nonce,
  };
  return { token: `${prefix}${kb}`, constructionPassed: Object.values(construction).every(Boolean), construction };
}
async function submit(verifier, target, token, deadline, extra = {}) {
  const submitted = await request(`${verifier}/direct-post`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ state: target.claims.state, vp_token: JSON.stringify({ credential: [token] }), ...extra }) }, deadline);
  if (submitted.status >= 500) return { httpStatus: submitted.status, error: "transport" };
  if (submitted.status === 400) return { httpStatus: 400, boundary: "direct_post", outcome: "invalid", diagnosticsVersion: submitted.body?.diagnosticsVersion, code: submitted.body?.failure?.code, stage: submitted.body?.failure?.stage };
  if (submitted.status !== 200 || submitted.body?.accepted !== true) throw new ProbeError("malformed_result");
  while (Date.now() < deadline) {
    const result = await request(`${verifier}/result/${encodeURIComponent(target.requestId)}`, undefined, deadline);
    if (result.status === 202) { await new Promise((resolve) => setTimeout(resolve, 20)); continue; }
    if (result.status !== 200) return { httpStatus: result.status, error: "transport" };
    return { httpStatus: result.status, boundary: "result", outcome: result.body?.outcome, diagnosticsVersion: result.body?.diagnosticsVersion, code: result.body?.failure?.code, stage: result.body?.failure?.stage };
  }
  throw new ProbeError("timeout");
}
export async function runProbes({ issuer, verifier, catalog, caseTimeoutMs = 20_000 }) {
  issuer = validateTarget(issuer); verifier = validateTarget(verifier); validateCatalog(catalog);
  const results = [];
  for (const definition of catalog.cases) {
    const deadline = Date.now() + caseTimeoutMs, started = Date.now(); let controlPassed = false, constructionPassed = false, controlRecord = null, construction = {};
    try {
      const baseline = await issue(issuer, "valid", deadline), a = await challenge(verifier, deadline);
      const control = await present(baseline, a, "valid");
      const controlResult = safeObservation({ ...await submit(verifier, a, control.token, deadline), controlPassed: true, constructionPassed: control.constructionPassed });
      controlPassed = evaluate({ outcome: "valid", boundary: "result" }, controlResult) === "correct_acceptance";
      controlRecord = { caseId: `${definition.id}.control`, observed: controlResult, construction: control.construction, verdict: controlPassed ? "correct_acceptance" : "inconclusive" };
      if (!controlPassed) throw new ProbeError("construction");
      let observation;
      if (definition.fault === "used_state") {
        constructionPassed = control.constructionPassed; construction = { ...control.construction, previouslyAcceptedPresentationReused: true };
        observation = await submit(verifier, a, control.token, deadline);
      } else if (definition.fault === "replay") {
        const b = await challenge(verifier, deadline);
        const originalBytes = control.token; construction = { ...control.construction, freshChallengeNonceDiffers: a.claims.nonce !== b.claims.nonce, byteForBytePresentationPreserved: originalBytes === control.token }; constructionPassed = Object.values(construction).every(Boolean);
        observation = await submit(verifier, b, originalBytes, deadline);
      } else {
        const variant = ["expired", "wrong_type", "missing_holder_binding"].includes(definition.fault) ? definition.fault : "valid";
        const issued = await issue(issuer, variant, deadline), b = await challenge(verifier, deadline);
        const presentation = await present(issued, b, definition.fault); constructionPassed = presentation.constructionPassed; construction = presentation.construction;
        if (!constructionPassed) throw new ProbeError("construction");
        observation = await submit(verifier, b, presentation.token, deadline, definition.fault === "unsupported_parameter" ? { presentation_submission: "{malformed" } : {});
      }
      const observed = safeObservation({ ...observation, controlPassed, constructionPassed });
      results.push({ caseId: definition.id, profile: catalog.profile, applicationStep: null, control: controlRecord, construction, expected: definition.expected, observed, verdict: evaluate(definition.expected, observed), durationMs: Date.now() - started });
    } catch (error) {
      const observed = safeObservation({ controlPassed, constructionPassed, error: error instanceof ProbeError ? error.code : "construction" });
      results.push({ caseId: definition.id, profile: catalog.profile, applicationStep: null, control: controlRecord, construction, expected: definition.expected, observed, verdict: "inconclusive", durationMs: Date.now() - started });
    }
  }
  return results;
}
async function main() {
  const args = process.argv.slice(2), options = {};
  if (args.length !== 6) throw new ProbeError("configuration");
  for (let i = 0; i < args.length; i += 2) {
    if (!["--issuer", "--verifier", "--out"].includes(args[i]) || Object.hasOwn(options, args[i])) throw new ProbeError("configuration");
    options[args[i]] = args[i + 1];
  }
  if (!Object.values(options).every((value) => typeof value === "string" && value.length)) throw new ProbeError("configuration");
  const catalog = validateCatalog(JSON.parse(await readFile(new URL("./wallet-interop-cases.json", import.meta.url), "utf8")));
  const results = await runProbes({ issuer: options["--issuer"], verifier: options["--verifier"], catalog });
  let commit = "unreported", dirty = true;
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: repositoryRoot }).trim(); dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", cwd: repositoryRoot }).trim()); } catch { /* explicit unknown provenance */ }
  const evidence = { schemaVersion: 1, evidenceTier: "local_mock_protocol", timestamp: new Date().toISOString(), sourceCommit: /^[0-9a-f]{40}$/.test(commit) ? commit : "unreported", dirtyWorkingTree: dirty, versions: { issuer: "unreported", verifier: "unreported", labelSource: "target_builds_not_attested" }, profile: catalog.profile, results, exitCode: exitCode(results) };
  await writeFile(options["--out"], `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  process.stdout.write(`Protocol probes: ${results.length} cases; exit ${evidence.exitCode}\n`); process.exitCode = evidence.exitCode;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { process.stderr.write("Protocol probe failed: configuration or artifact error\n"); process.exitCode = 2; });
