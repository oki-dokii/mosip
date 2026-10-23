import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, X509Certificate, type KeyObject } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { exportJWK, SignJWT, type JWTHeaderParameters } from "jose";
import { describe, expect, it } from "vitest";
import { verifyPresentation } from "./verify.js";
import { flatProfile, type Policy } from "./profile.js";

const now = 2_000_000_000;
const policy: Policy = { profile: flatProfile, requiredClaims: ["given_name"] };
const challenge = { client_id: "mock-verifier", nonce: "synthetic-challenge" };
const hash = (text: string) => createHash("sha256").update(text).digest("base64url");
async function specimen(options: {
  issuerClaims?: Record<string, unknown>; kbClaims?: Record<string, unknown>; kbHeader?: Record<string, unknown>;
  wrongHolder?: boolean; omit?: string; corruptIssuer?: boolean; corruptHolder?: boolean;
  duplicateDisclosure?: boolean; malformedDisclosure?: boolean; uncommitted?: boolean;
  duplicateCommitment?: boolean; duplicateName?: boolean;
  x509Signer?: { privateKey: KeyObject; header: JWTHeaderParameters; issuerId: string };
} = {}) {
  const issuer = generateKeyPairSync("ed25519"), holder = generateKeyPairSync("ed25519");
  const issuerJwk = await exportJWK(issuer.publicKey), holderJwk = await exportJWK(holder.publicKey);
  const issuerId = options.x509Signer?.issuerId ?? `did:jwk:${Buffer.from(JSON.stringify(issuerJwk)).toString("base64url")}`;
  const values = ["given_name", options.duplicateName ? "given_name" : "family_name"].map((name) => ({ name, value: Buffer.from(JSON.stringify([randomBytes(16).toString("base64url"), name, "Synthetic"])).toString("base64url") }));
  if (options.malformedDisclosure) values[0]!.value = Buffer.from(JSON.stringify(["salt", "given_name"])).toString("base64url");
  const claims = { iss: issuerId, vct: "MockVerifiableCredential_SD_JWT", cnf: { jwk: holderJwk }, iat: now - 10, nbf: now - 10, exp: now + 3600, _sd_alg: "sha-256", _sd: values.map((item) => hash(item.value)), ...options.issuerClaims };
  if (options.duplicateCommitment) claims._sd.push(claims._sd[0]!);
  let jwt = await new SignJWT(claims).setProtectedHeader(options.x509Signer?.header ?? { alg: "EdDSA", typ: "vc+sd-jwt" }).sign(options.x509Signer?.privateKey ?? issuer.privateKey);
  const corrupt = (token: string) => { const parts = token.split("."); const bytes = Buffer.from(parts[2]!, "base64url"); bytes[0] = bytes[0]! ^ 1; parts[2] = bytes.toString("base64url"); return parts.join("."); };
  if (options.corruptIssuer) jwt = corrupt(jwt);
  const disclosures = values.filter((item) => item.name !== options.omit).map((item) => item.value);
  if (options.duplicateDisclosure) disclosures.push(disclosures[0]!);
  if (options.uncommitted) disclosures[0] = Buffer.from(JSON.stringify(["salt", "given_name", "Different"])).toString("base64url");
  const prefix = `${jwt}~${disclosures.join("~")}~`;
  let kb = await new SignJWT({ iat: now, aud: challenge.client_id, nonce: challenge.nonce, sd_hash: hash(prefix), ...options.kbClaims }).setProtectedHeader({ alg: "EdDSA", typ: "kb+jwt", ...options.kbHeader }).sign(options.wrongHolder ? generateKeyPairSync("ed25519").privateKey : holder.privateKey);
  if (options.corruptHolder) kb = corrupt(kb);
  return `${prefix}${kb}`;
}
async function code(options: Parameters<typeof specimen>[0], expected: string) {
  const result = await verifyPresentation(await specimen(options), challenge, policy, now);
  expect(result.outcome).toBe("invalid");
  if (result.outcome === "invalid") expect(result.failure.code).toBe(expected);
}

describe("isolated SD-JWT verification", () => {
  it("passes control and optional omission, preserving trust limitation", async () => {
    for (const options of [{}, { omit: "family_name" }]) {
      const result = await verifyPresentation(await specimen(options), challenge, policy, now);
      expect(result.outcome).toBe("valid");
      if (result.outcome === "valid") expect(result.certificateTrustChecked).toBe(false);
    }
  });
  it.each([
    [{ corruptIssuer: true }, "ISSUER_SIGNATURE_INVALID"],
    [{ issuerClaims: { iat: now - 120, nbf: now - 120, exp: now - 60 } }, "CREDENTIAL_EXPIRED"],
    [{ issuerClaims: { nbf: now + 60 } }, "CREDENTIAL_NOT_YET_VALID"],
    [{ issuerClaims: { exp: undefined } }, "INVALID_CREDENTIAL_CLAIMS"],
    [{ issuerClaims: { vct: "UnexpectedCredential" } }, "CREDENTIAL_TYPE_MISMATCH"],
    [{ issuerClaims: { cnf: undefined } }, "HOLDER_BINDING_MISSING"],
    [{ issuerClaims: { cnf: { jwk: { kty: "RSA" } } } }, "INVALID_HOLDER_KEY"],
    [{ issuerClaims: { cnf: { jwk: { kty: "OKP", crv: "Ed25519", x: "invalid" } } } }, "INVALID_HOLDER_KEY"],
    [{ issuerClaims: { iss: "https://unsupported-issuer.test" } }, "UNSUPPORTED_ISSUER_KEY"],
    [{ wrongHolder: true }, "HOLDER_PROOF_INVALID"],
    [{ corruptHolder: true }, "HOLDER_PROOF_INVALID"],
    [{ kbHeader: { typ: "JWT" } }, "KB_TYPE_MISMATCH"],
    [{ kbClaims: { iat: now - 121 } }, "KB_TIME_INVALID"],
    [{ kbClaims: { iat: now + 6 } }, "KB_TIME_INVALID"],
    [{ kbClaims: { iat: undefined } }, "KB_TIME_INVALID"],
    [{ kbClaims: { aud: "different-verifier" } }, "AUDIENCE_MISMATCH"],
    [{ kbClaims: { aud: [challenge.client_id] } }, "AUDIENCE_MISMATCH"],
    [{ kbClaims: { aud: undefined } }, "AUDIENCE_MISMATCH"],
    [{ kbClaims: { nonce: "different-challenge" } }, "NONCE_MISMATCH"],
    [{ kbClaims: { nonce: undefined } }, "NONCE_MISMATCH"],
    [{ kbClaims: { sd_hash: "incorrect-hash" } }, "SD_HASH_MISMATCH"],
    [{ omit: "given_name" }, "REQUIRED_DISCLOSURE_MISSING"],
    [{ duplicateDisclosure: true }, "MALFORMED_DISCLOSURE"],
    [{ duplicateCommitment: true }, "MALFORMED_DISCLOSURE"],
    [{ duplicateName: true }, "MALFORMED_DISCLOSURE"],
    [{ malformedDisclosure: true }, "MALFORMED_DISCLOSURE"],
    [{ uncommitted: true }, "DISCLOSURE_DIGEST_MISMATCH"],
    [{ issuerClaims: { _sd_alg: "sha-512" } }, "UNSUPPORTED_DISCLOSURE_PROFILE"],
    [{ issuerClaims: { nested: { _sd: ["synthetic"] } } }, "UNSUPPORTED_DISCLOSURE_PROFILE"],
    [{ issuerClaims: { given_name: "collision" } }, "MALFORMED_DISCLOSURE"],
  ] as const)("returns a bounded rejection for isolated fault %#", async (options, expected) => { await code(options, expected); });
  it("accepts KB age and future skew at the exact boundary", async () => {
    for (const iat of [now - 120, now + 5]) expect((await verifyPresentation(await specimen({ kbClaims: { iat } }), challenge, policy, now)).outcome).toBe("valid");
  });
  it.each(["EdDSA", "ES256", "RS256"])("accepts an embedded %s certificate without claiming chain trust", async (algorithm) => {
    const directory = mkdtempSync(join(tmpdir(), "person3-verifier-cert-"));
    try {
      const keyPath = join(directory, "key.pem"), certPath = join(directory, "cert.pem");
      const keyArgs = algorithm === "EdDSA" ? ["-newkey", "ed25519"] : algorithm === "ES256" ? ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256"] : ["-newkey", "rsa:2048"];
      execFileSync("openssl", ["req", "-x509", ...keyArgs, "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=issuer.test"], { stdio: "ignore" });
      const certificate = new X509Certificate(readFileSync(certPath));
      const x509Signer = { privateKey: createPrivateKey(readFileSync(keyPath)), header: { alg: algorithm, typ: "vc+sd-jwt", x5c: [certificate.raw.toString("base64")] }, issuerId: "https://issuer.test" };
      const result = await verifyPresentation(await specimen({ x509Signer }), challenge, policy, now);
      expect(result.outcome).toBe("valid");
      if (result.outcome === "valid") expect(result.certificateTrustChecked).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("rejects exact presentation bytes under a fresh challenge", async () => {
    const token = await specimen();
    expect((await verifyPresentation(token, challenge, policy, now)).outcome).toBe("valid");
    const result = await verifyPresentation(token, { ...challenge, nonce: "fresh-challenge" }, policy, now);
    expect(result.outcome === "invalid" && result.failure.code).toBe("NONCE_MISMATCH");
  });
  it.each(["", "a~", "a~b", "a~~b", "a".repeat(32_769)])("rejects malformed presentation without error prose %#", async (token) => {
    const result = await verifyPresentation(token, challenge, policy, now);
    expect(result.outcome === "invalid" && result.failure.code).toBe("MALFORMED_PRESENTATION");
  });
});
