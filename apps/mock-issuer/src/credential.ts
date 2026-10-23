import { createHash, randomBytes } from "node:crypto";
import { SignJWT, type JWK } from "jose";
import type { IssuerSigner } from "./signing.js";

export const configurationId = "MockVerifiableCredential_SD_JWT";
export const variants = ["valid", "expired", "wrong_type", "missing_holder_binding"] as const;
export type CredentialVariant = typeof variants[number];
export async function issueCredential(options: { signer: IssuerSigner; holderPublicJwk: JWK; variant: CredentialVariant; now: number; twoClaims?: boolean }) {
  const { signer, holderPublicJwk, variant, now } = options;
  const claims = options.twoClaims ? [["given_name", "Test"], ["family_name", "Example"]] : [["given_name", "Test"]];
  const disclosures = claims.map(([name, value]) => Buffer.from(JSON.stringify([randomBytes(16).toString("base64url"), name, value])).toString("base64url"));
  const expired = variant === "expired";
  const jwt = await new SignJWT({
    iss: signer.issuer, vct: variant === "wrong_type" ? "UnexpectedCredential" : configurationId,
    ...(variant === "missing_holder_binding" ? {} : { cnf: { jwk: holderPublicJwk } }),
    _sd_alg: "sha-256", _sd: disclosures.map((item) => createHash("sha256").update(item).digest("base64url")),
    iat: now - (expired ? 120 : 10), nbf: now - (expired ? 120 : 10), exp: now + (expired ? -60 : 3600),
  }).setProtectedHeader(signer.header).sign(signer.privateKey);
  return `${jwt}~${disclosures.join("~")}~`;
}
