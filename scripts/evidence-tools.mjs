#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Fixed schema vocabulary: arbitrary input keys can themselves contain personal data.
const FIELDS = new Set(`accept accepted accessTokenAudienceConfigured accessTokenClientIdClaimIncluded accessTokenIssuerConfigured accessTokenNonceClaimIncluded accessTokenSigningKeyAdvertisedByAuthorizationServer access_token actorFrom actorTo actualOutcome algorithm allChecksSuccessful attempts authorizationClientLabel authorized c_nonce candidate capturedAt certify clientId completed config containsSecrets createRequestPath createStatus createdAt credentialChecksSuccessful credentialConfiguration credentialConfigurationId credentialConfigurations credentialFailure credentialPath credentialProofValid credentialReceived credentialRequestFields credentialReturned credential_configuration_id credential_issuer credentials dcqlQuery downloadSucceeded durationMs environment error errorCode evidence exchanges expectedOutcome failureDetail finishedAt flow format grantType grantTypes grant_type guestPresentationAvailable holderKeyMatchesCredential holderProofType holderProofValid id includeClaims issuer issuerCatalogPath issuerConfigurationPathTemplate issuerCount issuerId issuerMetadataPath jsonLd jsonLdCredentialStatus jsonLdRequestRecognized label meta metadataStatus method mimoto mockCertifyOnboarded nonce noncePath observed observedCancellationLifecycle observedIssuance observedPresentation offerDataPathTemplate offerPath offerStatus openApiPath outcome parentRunId persistentWalletLoginRequired pkce proof proofType queryLanguage redactions request requestFormat requestIdIssued requestObjectStatus requestRoute requestUriIssued response responseCodeValidationRequired responseMode resultErrorCode resultPathTemplate resultStatus run runId scenarioId sdJwt sdJwtCredentialStatus sdJwtPresentationSupported seq serviceVersions signedRequestReceived skipStatusChecks source startedAt status statusPathTemplate stepId stepKey steps storedForRun submissionAccepted submissionPath submissionStatus summary tamper tier title tokenPath tokenResponseIncludesNonce tokenStatus token_type transactionIdIssued url vct_values verifier verify wallet credential vp_token presentation_definition presentation_submission input_descriptors constraints fields path filter type name given_name family_name credentialSubject @context proofValue proofPurpose validFrom descriptor_map definition_id format client_id response_uri aud iss exp iat nbf _sd _sd_alg cnf jwk alg typ kid headers body publicView capture schemaVersion authenticity items kind`.split(/\s+/));
const STEPS = new Set("INIT ISSUE_OFFER ISSUE_TOKEN ISSUE_CREDENTIAL STORE PRESENT_REQUEST PRESENT_SUBMIT PRESENT_STATUS PRESENT_RESULT REPORT".split(" "));
const ACTORS = new Set("playground reference_wallet mock_issuer mock_verifier inji_certify inji_verify inji_web_assisted mimoto certify esignet verify wallet browser".split(" "));
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const OUTCOMES = new Set(["valid", "invalid", "expired", "error"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const known = (set, value) => set.has(value) ? value : "withheld";

export function shapeOf(value) {
  const fields = Object.create(null);
  let remaining = 4096;
  let truncated = false;
  const seen = new WeakSet();
  function visit(item, path, depth) {
    if (depth > 16 || remaining-- <= 0) { truncated = true; return; }
    const type = item === null ? "null" : Array.isArray(item) ? "array" :
      typeof item === "string" && /^\[REDACTED(?:[^\]]*)\]$/.test(item) ? "redacted" : typeof item;
    fields[path] = [...new Set([...(fields[path] ?? []), type])].sort();
    if (item && typeof item === "object") {
      if (seen.has(item)) { truncated = true; return; }
      seen.add(item);
      if (Array.isArray(item)) {
        if (item.length > 128) truncated = true;
        for (const child of item.slice(0, 128)) visit(child, `${path}[]`, depth + 1);
      } else {
        const entries = Object.entries(item).sort(([a], [b]) => a.localeCompare(b));
        if (entries.length > 128) truncated = true;
        for (const [name, child] of entries.slice(0, 128)) visit(child, `${path}.${FIELDS.has(name) ? name : "[unknown-field]"}`, depth + 1);
      }
    }
  }
  visit(value, "$", 0);
  return { fields, truncated };
}

export function diffShapes(before, after) {
  const a = shapeOf(before), b = shapeOf(after);
  const changes = [];
  for (const path of [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])].sort()) {
    const left = a.fields[path], right = b.fields[path];
    if (JSON.stringify(left) === JSON.stringify(right)) continue;
    changes.push({ path, change: left === undefined ? "added" : right === undefined ? "removed" : "changed", before: left ?? [], after: right ?? [] });
  }
  return { changes, truncated: a.truncated || b.truncated };
}

function isRun(doc) { return object(doc) && object(doc.run) && Array.isArray(doc.steps) && Array.isArray(doc.exchanges); }
function exchangeSlots(doc) {
  if (!isRun(doc) || doc.exchanges.length > 1000 || doc.steps.length > 1000) throw new Error("EVIDENCE_INVALID_RUN");
  const stepKeys = new Map(doc.steps.filter(object).map((s) => [s.id, known(STEPS, s.stepKey)]));
  const slots = new Map(), occurrences = new Map();
  const sorted = [...doc.exchanges].sort((a, b) => (Number.isSafeInteger(a?.seq) ? a.seq : 0) - (Number.isSafeInteger(b?.seq) ? b.seq : 0));
  for (const exchange of sorted) {
    if (!object(exchange) || !Object.hasOwn(exchange, "request") || !Object.hasOwn(exchange, "response")) throw new Error("EVIDENCE_INVALID_EXCHANGE");
    const key = `${stepKeys.get(exchange.stepId) ?? "withheld"}/${known(ACTORS, exchange.actorFrom)}/${known(ACTORS, exchange.actorTo)}/${known(METHODS, exchange.method)}`;
    const n = (occurrences.get(key) ?? 0) + 1; occurrences.set(key, n);
    slots.set(`${key}/${n}`, exchange);
  }
  return slots;
}

export function compareEvidence(before, after) {
  if (!isRun(before) && !isRun(after)) return { schemaVersion: 1, kind: "document_shapes", ...diffShapes(before, after) };
  if (!isRun(before) || !isRun(after)) throw new Error("EVIDENCE_KIND_MISMATCH");
  const a = exchangeSlots(before), b = exchangeSlots(after);
  const exchanges = [];
  for (const slot of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const left = a.get(slot), right = b.get(slot);
    const request = diffShapes(left?.request, right?.request), response = diffShapes(left?.response, right?.response);
    if (!left || !right || request.changes.length || response.changes.length || request.truncated || response.truncated) {
      exchanges.push({ slot, change: !left ? "added" : !right ? "removed" : "changed", request, response });
    }
  }
  return { schemaVersion: 1, kind: "run_exchange_shapes", exchanges,
    note: "Aligned by step, actors, method and occurrence order; no URL, identifier or scalar value is compared. Unknown field names are collapsed. A redacted marker describes the stored evidence, not the original wire type. Shape equality is not protocol compatibility." };
}

function safeVersion(value) {
  return typeof value === "string" && /^(?:unreported|fixture|(?:reference-wallet\/|mock-x509-|mock-issuer\/|mock-verifier\/|v)?\d+(?:\.\d+){0,3})$/.test(value) ? value : "withheld/unreported";
}

export function issueDraft(doc) {
  const slots = exchangeSlots(doc);
  const run = doc.run;
  const lines = ["# Private interoperability finding draft", "", "Review required before sharing. This generated draft does not establish a vulnerability or publish an issue.", "",
    `Run: ${UUID.test(run.id) ? run.id : "withheld"}`,
    `Expected: ${known(OUTCOMES, run.expectedOutcome)}; actual: ${known(OUTCOMES, run.actualOutcome)}.`,
    `Format: ${known(new Set(["ldp_vc", "vc_sd_jwt", "dc+sd-jwt", "vc+sd-jwt"]), run.config?.format)}; flow: ${known(new Set(["cross_device", "same_device"]), run.config?.flow)}; tamper: ${run.config?.tamper === null ? "none" : known(new Set(["bad_signature", "expired", "wrong_type", "missing_disclosure", "nonce_mismatch"]), run.config?.tamper)}.`,
    `Evidence tier: ${known(new Set(["mock_interop", "fixture", "live_reference", "live_inji", "synthetic_capture"]), doc.evidence?.tier)}.`,
    "A passing negative scenario may have an invalid actual outcome; the run status is not a verifier verdict.", "",
    "## Component versions", "", "| Role | Component | Recorded version |", "| --- | --- | --- |"];
  for (const role of ["issuer", "wallet", "verifier"]) lines.push(`| ${role} | ${known(ACTORS, run.config?.[role])} | ${safeVersion(run.serviceVersions?.[role])} |`);
  lines.push("", "## Reproduction outline", "", "1. Use synthetic identities on the same pinned component versions.",
    "2. Recreate the recorded configuration locally; consult the source run for setup. Secret values and arbitrary free text are deliberately omitted here.",
    "3. Execute the observed steps below and compare expected versus actual. Supply a reviewed minimal reproducer before filing.", "", "| Step | Recorded status |", "| --- | --- |");
  for (const step of doc.steps) if (object(step)) lines.push(`| ${known(STEPS, step.stepKey)} | ${known(new Set(["pending", "running", "succeeded", "failed", "skipped"]), step.status)} |`);
  lines.push("", "## Exchange shapes", "", "No token, nonce, claim value, raw URL, error prose, or private key is included. Unknown field names collapse to a placeholder. Array element types are unioned.");
  for (const [slot, exchange] of slots) {
    lines.push("", `### ${slot}`, "", `HTTP status: ${Number.isInteger(exchange.status) && exchange.status >= 100 && exchange.status <= 599 ? exchange.status : "withheld"}`, "", "```json",
      JSON.stringify({ request: shapeOf(exchange.request), response: shapeOf(exchange.response) }, null, 2), "```");
  }
  lines.push("", "## Triage", "", "Confirm reproducibility, expected protocol behaviour, affected versions and disclosure channel. Security-impact findings require private triage under docs/SECURITY.md. Do not infer a live-wallet result from a reference-wallet or synthetic capture.", "");
  return lines.join("\n");
}

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export function readCommitted(path) {
  if (typeof path !== "string" || !/^(?:submission\/evidence|spikes\/fixtures)\/[a-zA-Z0-9_./-]+\.json$/.test(path) || path.split("/").includes("..")) throw new Error("EVIDENCE_PATH_NOT_ALLOWED");
  const bytes = execFileSync("git", ["show", `HEAD:${path}`], { cwd: root, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return { doc: JSON.parse(bytes.toString("utf8")), provenance: { path, commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim(), sha256: createHash("sha256").update(bytes).digest("hex") } };
}
async function main() {
  try {
    const [command, first, second, third] = process.argv.slice(2);
    if (command === "drift" && first && second && third) {
      const a = readCommitted(first), b = readCommitted(second);
      await writeFile(third, `${JSON.stringify({ ...compareEvidence(a.doc, b.doc), sources: [a.provenance, b.provenance] }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    } else if (command === "issue" && first && second && !third) {
      const { doc, provenance } = readCommitted(first);
      const source = `\nSource: ${provenance.path}\nCommit: ${provenance.commit}\nSource SHA-256: ${provenance.sha256}\n`;
      await writeFile(second, issueDraft(doc) + source, { flag: "wx", mode: 0o600 });
    } else throw new Error("EVIDENCE_ARGUMENTS");
    console.log("EVIDENCE_EXPORT_SAVED");
  } catch { console.error("EVIDENCE_EXPORT_FAILED: check command, committed input paths, size, schema and output existence locally."); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
