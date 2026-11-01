import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Ed25519VerificationKey2020 } from "@digitalbazaar/ed25519-verification-key-2020";
import jsigs from "jsonld-signatures";
import { readFileSync } from "node:fs";
const staticContexts = new Map(Object.entries({
  "https://www.w3.org/2018/credentials/v1": "credentials",
  "https://www.w3.org/ns/did/v1": "did",
  "https://w3id.org/security/suites/ed25519-2020/v1": "ed25519",
}).map(([url, name]) => [url, JSON.parse(readFileSync(new URL("./fixtures/jsonld-contexts/"+name+".json", import.meta.url), "utf8"))]));

const { AssertionProofPurpose } = jsigs.purposes;

export function buildDocumentLoader(issuerKey, attackerKey) {
  return async function customDocumentLoader(url) {
    if (url === "did:example:issuer") {
      return {
        contextUrl: null,
        documentUrl: url,
        document: {
          "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1"
          ],
          id: "did:example:issuer",
          verificationMethod: [issuerKey.export({ publicKey: true })],
          assertionMethod: [issuerKey.id]
        }
      };
    }
    if (url === issuerKey.id) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: issuerKey.export({ publicKey: true })
      };
    }
    if (url === "did:example:attacker") {
      return {
        contextUrl: null,
        documentUrl: url,
        document: {
          "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1"
          ],
          id: "did:example:attacker",
          verificationMethod: [attackerKey.export({ publicKey: true })],
          assertionMethod: [attackerKey.id]
        }
      };
    }
    if (url === attackerKey.id) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: attackerKey.export({ publicKey: true })
      };
    }
    if (!staticContexts.has(url)) throw new Error("Unregistered test context");
    return { contextUrl: null, documentUrl: url, document: structuredClone(staticContexts.get(url)) };
  };
}

export async function createBaseCredential(overrides = {}) {
  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
      {
        fullName: "https://schema.org/name",
        country: "https://schema.org/nationality",
        ProofOfIdentityCredential: "https://schema.org/identifier"
      }
    ],
    id: "urn:uuid:mock-jsonld-vc-1",
    type: ["VerifiableCredential", "ProofOfIdentityCredential"],
    issuer: "did:example:issuer",
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: "did:example:holder",
      fullName: "Alice Resident",
      country: "India"
    },
    ...overrides
  };
}

export async function verifyCredential(vc, { keyPair, documentLoader, requiredType = "ProofOfIdentityCredential" }) {
  // 1. Signature check
  let sigResult;
  try {
    sigResult = await jsigs.verify(vc, {
      suite: new Ed25519Signature2020({ key: keyPair, canonizeOptions: { safe: false } }),
      purpose: new AssertionProofPurpose(),
      documentLoader
    });
  } catch (err) {
    return {
      outcome: "invalid",
      code: "PROOF_VALUE_INVALID",
      error: err.message
    };
  }

  if (!sigResult.verified) {
    if (vc.proof?.verificationMethod && !vc.proof.verificationMethod.startsWith(vc.issuer)) {
      return { outcome: "invalid", code: "UNTRUSTED_KEY", error: "Verification method not authorized by issuer" };
    }
    const isBase58Btc = typeof vc.proof?.proofValue === "string" && /^z[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(vc.proof.proofValue);
    const proofError = sigResult.results?.[0]?.error;
    if (!isBase58Btc || proofError?.name === "TypeError") {
      return { outcome: "invalid", code: "PROOF_VALUE_INVALID", error: "Malformed or invalid proof value encoding" };
    }
    return { outcome: "invalid", code: "SIGNATURE_CORRUPTED", error: "Cryptographic signature mismatch" };
  }

  // 2. Temporal expiration check
  if (vc.expirationDate) {
    const exp = new Date(vc.expirationDate);
    if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      return { outcome: "invalid", code: "CREDENTIAL_EXPIRED", error: `Credential expired on ${vc.expirationDate}` };
    }
  }

  // 3. Schema / credential type validation
  if (!Array.isArray(vc.type) || !vc.type.includes(requiredType)) {
    return { outcome: "invalid", code: "CREDENTIAL_TYPE_MISMATCH", error: `Missing required type ${requiredType}` };
  }

  return { outcome: "valid", code: null, error: null };
}

export async function runProbes(options = {}) {
  const catalog = options.catalog || JSON.parse(await readFile(new URL("./jsonld-interop-cases.json", import.meta.url), "utf8"));
  
  // Runtime keypair generation (no hardcoded private keys)
  const issuerKey = await Ed25519VerificationKey2020.generate({ controller: "did:example:issuer" });
  issuerKey.id = "did:example:issuer#key-1";

  const attackerKey = await Ed25519VerificationKey2020.generate({ controller: "did:example:attacker" });
  attackerKey.id = "did:example:attacker#key-1";

  const documentLoader = buildDocumentLoader(issuerKey, attackerKey);

  // Baseline signed credential (positive control)
  const baselineVc = await createBaseCredential();
  const signedBaseline = await jsigs.sign(baselineVc, {
    suite: new Ed25519Signature2020({ key: issuerKey, canonizeOptions: { safe: false } }),
    purpose: new AssertionProofPurpose(),
    documentLoader
  });

  const controlObserved = await verifyCredential(signedBaseline, { keyPair: issuerKey, documentLoader });
  const controlPassed = controlObserved.outcome === "valid";

  const results = [];

  for (const item of catalog.cases) {
    const started = Date.now();
    let candidateVc;
    let singleVariableMutated;

    switch (item.fault) {
      case "none":
        candidateVc = structuredClone(signedBaseline);
        singleVariableMutated = "none";
        break;

      case "bad_proof_value": {
        candidateVc = structuredClone(signedBaseline);
        const pv = candidateVc.proof.proofValue;
        candidateVc.proof.proofValue = pv.slice(0, -1) + "_";
        singleVariableMutated = "proof.proofValue corrupted with non-base58 character post-issuance";
        break;
      }

      case "expired": {
        const expiredUnsigned = await createBaseCredential({
          expirationDate: "2020-01-01T00:00:00Z"
        });
        candidateVc = await jsigs.sign(expiredUnsigned, {
          suite: new Ed25519Signature2020({ key: issuerKey, canonizeOptions: { safe: false } }),
          purpose: new AssertionProofPurpose(),
          documentLoader
        });
        singleVariableMutated = "expirationDate set to past date at issuance";
        break;
      }

      case "wrong_type": {
        const wrongTypeUnsigned = await createBaseCredential({
          type: ["VerifiableCredential"] // missing ProofOfIdentityCredential
        });
        candidateVc = await jsigs.sign(wrongTypeUnsigned, {
          suite: new Ed25519Signature2020({ key: issuerKey, canonizeOptions: { safe: false } }),
          purpose: new AssertionProofPurpose(),
          documentLoader
        });
        singleVariableMutated = "type omitted ProofOfIdentityCredential at issuance";
        break;
      }

      case "reverse_member_order":
        candidateVc = Object.fromEntries(Object.entries(signedBaseline).reverse());
        singleVariableMutated = "reverse top-level JSON member order without changing the RDF dataset";
        break;
      case "remove_proof":
        candidateVc = structuredClone(signedBaseline);
        delete candidateVc.proof;
        singleVariableMutated = "remove the proof property from a valid credential";
        break;
      case "replace_subject_id":
        candidateVc = structuredClone(signedBaseline);
        candidateVc.credentialSubject.id = "did:example:other-holder";
        singleVariableMutated = "replace only the credential subject identifier after signing";
        break;
      case "altered_claim": {
        candidateVc = structuredClone(signedBaseline);
        candidateVc.credentialSubject.fullName = "Eve Attacker";
        singleVariableMutated = "credentialSubject.fullName changed post-issuance";
        break;
      }

      case "forged_verification_method": {
        candidateVc = structuredClone(signedBaseline);
        candidateVc.proof.verificationMethod = attackerKey.id;
        singleVariableMutated = "proof.verificationMethod pointed to untrusted key post-issuance";
        break;
      }

      default:
        throw new Error(`Unknown fault type: ${item.fault}`);
    }

    const observed = await verifyCredential(candidateVc, { keyPair: issuerKey, documentLoader });

    let verdict;
    if (item.expected.outcome === "valid") {
      verdict = (observed.outcome === "valid" && controlPassed) ? "correct_acceptance" : "failed";
    } else {
      verdict = (observed.outcome === "invalid" && observed.code === item.expected.code && controlPassed)
        ? "correct_rejection"
        : "failed";
    }

    results.push({
      caseId: item.id,
      fault: item.fault,
      singleVariableMutated,
      control: {
        caseId: "j1.control.valid",
        passed: controlPassed
      },
      expected: item.expected,
      observed,
      verdict,
      durationMs: Date.now() - started
    });
  }

  return results;
}

export async function main() {
  const args = process.argv.slice(2);
  let outPath = null;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--out") {
      outPath = args[i + 1];
    }
  }

  const results = await runProbes();
  const allPassed = results.every((r) => ["correct_acceptance", "correct_rejection"].includes(r.verdict));
  const exitCode = allPassed ? 0 : 1;

  let commit = "unreported", dirty = true;
  try {
    const root = fileURLToPath(new URL("..", import.meta.url));
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: root }).trim();
    dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", cwd: root }).trim());
  } catch { /* ignored */ }

  const evidence = {
    schemaVersion: 1,
    evidenceTier: "local_mock_protocol",
    profile: "jsonld-ldp-v1",
    timestamp: new Date().toISOString(),
    sourceCommit: commit,
    dirtyWorkingTree: dirty,
    results,
    exitCode
  };

  if (outPath) {
    await writeFile(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`JSON-LD protocol probes: ${results.length} cases; exit ${exitCode}\n`);
  process.exitCode = exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`JSON-LD probe failed: ${err.message}\n`);
    process.exitCode = 2;
  });
}
