import { createHash } from "node:crypto";
import { importJWK, importX509, jwtVerify } from "jose";

type ObjectValue = Record<string, any>;

function decode(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as ObjectValue;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export async function verifyPresentation(token: string, request: { client_id: string; nonce: string }) {
  const pieces = token.split("~");
  const issuerJwt = pieces[0] ?? "";
  const bindingJwt = pieces.at(-1) ?? "";
  const header = decode(issuerJwt.split(".")[0] ?? "");
  const unverifiedClaims = decode(issuerJwt.split(".")[1] ?? "");
  const key = Array.isArray(header.x5c) && typeof header.x5c[0] === "string"
    ? await importX509(`-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`, header.alg)
    : typeof unverifiedClaims.iss === "string" && unverifiedClaims.iss.startsWith("did:jwk:")
      ? await importJWK(decode(unverifiedClaims.iss.slice("did:jwk:".length)), header.alg)
      : null;
  if (!key) throw new Error("No supported issuer public key in the SD-JWT");
  const { payload } = await jwtVerify(issuerJwt, key, { algorithms: [header.alg] });
  if (payload.vct !== "MockVerifiableCredential_SD_JWT") throw new Error("Credential type does not match the request");
  const confirmation = payload.cnf && typeof payload.cnf === "object" ? payload.cnf as ObjectValue : {};
  const holderJwk = confirmation.jwk ?? (typeof confirmation.kid === "string" && confirmation.kid.startsWith("did:jwk:")
    ? decode(confirmation.kid.slice("did:jwk:".length).split("#")[0] ?? "") : null);
  if (!holderJwk) throw new Error("Credential is missing holder binding");
  const holder = await jwtVerify(bindingJwt, await importJWK(holderJwk, "EdDSA"), { algorithms: ["EdDSA"], audience: request.client_id });
  const credential = token.slice(0, token.length - bindingJwt.length);
  if (holder.payload.nonce !== request.nonce) throw new Error("Presentation nonce does not match");
  if (holder.payload.sd_hash !== hash(credential)) throw new Error("SD-JWT key binding hash does not match");
  const digests: string[] = [];
  const collect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(collect); return; }
    const object = value as ObjectValue;
    if (Array.isArray(object._sd)) digests.push(...object._sd.filter((item: unknown) => typeof item === "string"));
    Object.values(object).forEach(collect);
  };
  collect(payload);
  const disclosures = pieces.slice(1, -1).filter(Boolean);
  for (const disclosure of disclosures) if (!digests.includes(hash(disclosure))) throw new Error("SD-JWT disclosure digest does not match");
  return { outcome: "valid" as const, issuerSignatureValid: true, holderProofValid: true, disclosedClaims: disclosures.length, certificateTrustChecked: false };
}
