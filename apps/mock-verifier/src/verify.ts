import { decodeProtectedHeader, errors, exportJWK, importJWK, importX509, jwtVerify, type JWK, type JWTPayload } from "jose";
import { decodeJson, object } from "./http.js";
import { failure, Rejection, type VerificationResult } from "./diagnostics.js";
import { digest, verifyDisclosures } from "./disclosures.js";
import { flatProfile, legacyPolicy, type Policy } from "./profile.js";

type RequestClaims = { client_id: string; nonce: string };
function decodedObject(segment: string) {
  try { const value = decodeJson(segment); if (object(value)) return value; } catch { /* bounded rejection below */ }
  throw new Rejection("MALFORMED_PRESENTATION");
}
function publicJwk(value: unknown, holder = false): JWK {
  const code = holder ? "INVALID_HOLDER_KEY" : "UNSUPPORTED_ISSUER_KEY";
  if (!object(value) || ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some((key) => Object.hasOwn(value, key))) throw new Rejection(code);
  if (holder && (value.kty !== "OKP" || value.crv !== "Ed25519")) throw new Rejection(code);
  return value as JWK;
}
function algorithmPolicy(alg: unknown, jwk?: JWK) {
  if (alg !== "EdDSA" && alg !== "ES256" && alg !== "RS256") throw new Rejection("UNSUPPORTED_ALGORITHM");
  if (jwk && !((alg === "EdDSA" && jwk.kty === "OKP" && jwk.crv === "Ed25519") || (alg === "ES256" && jwk.kty === "EC" && jwk.crv === "P-256") || (alg === "RS256" && jwk.kty === "RSA" && typeof jwk.n === "string" && Buffer.from(jwk.n, "base64url").length >= 256))) throw new Rejection("UNSUPPORTED_ISSUER_KEY");
  return alg;
}
async function verify(token: string, request: RequestClaims, policy: Policy, now: number): Promise<VerificationResult> {
  if (typeof token !== "string" || Buffer.byteLength(token) > 32_768 || !/^[A-Za-z0-9_.~-]+$/.test(token)) throw new Rejection("MALFORMED_PRESENTATION");
  const pieces = token.split("~"), issuerJwt = pieces[0] ?? "", bindingJwt = pieces.at(-1) ?? "";
  if (pieces.length < 2 || !issuerJwt || !bindingJwt || issuerJwt.length > 16_384 || bindingJwt.length > 16_384 || pieces.length > 18 || pieces.slice(1, -1).some((part) => !part)) throw new Rejection("MALFORMED_PRESENTATION");
  for (const jwt of [issuerJwt, bindingJwt]) {
    const segments = jwt.split(".");
    if (segments.length !== 3 || segments.some((segment) => !segment || Buffer.from(segment, "base64url").toString("base64url") !== segment)) throw new Rejection("MALFORMED_PRESENTATION");
  }
  decodedObject(issuerJwt.split(".")[0]!); decodedObject(bindingJwt.split(".")[0]!); decodedObject(bindingJwt.split(".")[1]!);
  const unverified = decodedObject(issuerJwt.split(".")[1]!);
  const header = decodeProtectedHeader(issuerJwt), strict = policy.profile === flatProfile;
  const alg = algorithmPolicy(header.alg);
  if (header.b64 === false || header.crit !== undefined) throw new Rejection("UNSUPPORTED_ALGORITHM");
  let key;
  try {
    if (Array.isArray(header.x5c) && typeof header.x5c[0] === "string" && header.x5c[0].length <= 8192) {
      key = await importX509(`-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`, alg);
      algorithmPolicy(alg, await exportJWK(key));
    } else if (typeof unverified.iss === "string" && unverified.iss.startsWith("did:jwk:")) {
      const jwk = publicJwk(decodeJson(unverified.iss.slice(8)));
      algorithmPolicy(alg, jwk); key = await importJWK(jwk, alg);
    } else throw new Rejection("UNSUPPORTED_ISSUER_KEY");
  } catch (error) { if (error instanceof Rejection) throw error; throw new Rejection("UNSUPPORTED_ISSUER_KEY"); }
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(issuerJwt, key, { algorithms: [alg], currentDate: new Date(now * 1000), ...(strict ? { requiredClaims: ["iat", "nbf", "exp"] } : {}) }));
  } catch (error) {
    if (error instanceof errors.JWTExpired) throw new Rejection("CREDENTIAL_EXPIRED");
    if (error instanceof errors.JWTClaimValidationFailed) throw new Rejection(error.claim === "nbf" && error.reason === "check_failed" ? "CREDENTIAL_NOT_YET_VALID" : "INVALID_CREDENTIAL_CLAIMS");
    if (error instanceof errors.JWSSignatureVerificationFailed) throw new Rejection("ISSUER_SIGNATURE_INVALID");
    if (error instanceof errors.JOSEError) throw new Rejection("MALFORMED_PRESENTATION");
    throw error;
  }
  if (payload.vct !== "MockVerifiableCredential_SD_JWT") throw new Rejection("CREDENTIAL_TYPE_MISMATCH");
  const cnf = object(payload.cnf) ? payload.cnf : {};
  if (strict && cnf.jwk !== undefined && cnf.kid !== undefined) throw new Rejection("INVALID_HOLDER_KEY");
  let holderValue = cnf.jwk;
  if (!holderValue && typeof cnf.kid === "string" && cnf.kid.startsWith("did:jwk:")) {
    try { holderValue = decodeJson(cnf.kid.slice(8).split("#")[0]!); } catch { throw new Rejection("INVALID_HOLDER_KEY"); }
  }
  if (!holderValue) throw new Rejection("HOLDER_BINDING_MISSING");
  const holderJwk = publicJwk(holderValue, true);
  const disclosures = pieces.slice(1, -1);
  const claims = verifyDisclosures(payload, disclosures, strict);
  const kbHeader = decodeProtectedHeader(bindingJwt);
  if (strict && kbHeader.typ !== "kb+jwt") throw new Rejection("KB_TYPE_MISMATCH");
  if (kbHeader.alg !== "EdDSA" || kbHeader.b64 === false || kbHeader.crit !== undefined) throw new Rejection("HOLDER_PROOF_INVALID");
  let holderKey;
  try { holderKey = await importJWK(holderJwk, "EdDSA"); } catch { throw new Rejection("INVALID_HOLDER_KEY"); }
  let binding: JWTPayload;
  try {
    ({ payload: binding } = await jwtVerify(bindingJwt, holderKey, { algorithms: ["EdDSA"], currentDate: new Date(now * 1000), ...(strict ? { requiredClaims: ["iat"] } : {}) }));
  } catch (error) {
    if (error instanceof errors.JWTExpired || error instanceof errors.JWTClaimValidationFailed) throw new Rejection("KB_TIME_INVALID");
    if (error instanceof errors.JOSEError) throw new Rejection("HOLDER_PROOF_INVALID");
    throw error;
  }
  if (strict && (typeof binding.iat !== "number" || !Number.isFinite(binding.iat) || now - binding.iat > 120 || binding.iat - now > 5)) throw new Rejection("KB_TIME_INVALID");
  if (strict ? binding.aud !== request.client_id : !(binding.aud === request.client_id || Array.isArray(binding.aud) && binding.aud.includes(request.client_id))) throw new Rejection("AUDIENCE_MISMATCH");
  if (typeof binding.nonce !== "string" || binding.nonce !== request.nonce) throw new Rejection("NONCE_MISMATCH");
  const prefix = token.slice(0, -bindingJwt.length);
  if (typeof binding.sd_hash !== "string" || binding.sd_hash !== digest(prefix)) throw new Rejection("SD_HASH_MISMATCH");
  for (const name of policy.requiredClaims) if (!claims.has(name) || typeof claims.get(name) !== "string" || !(claims.get(name) as string).length) throw new Rejection("REQUIRED_DISCLOSURE_MISSING");
  return { outcome: "valid", diagnosticsVersion: 1, issuerSignatureValid: true, holderProofValid: true, disclosedClaims: disclosures.length, certificateTrustChecked: false };
}
export async function verifyPresentation(token: string, request: RequestClaims, policy: Policy = legacyPolicy, now = Math.floor(Date.now() / 1000)): Promise<VerificationResult> {
  try { return await verify(token, request, policy, now); }
  catch (error) {
    if (error instanceof Rejection) return { outcome: "invalid", diagnosticsVersion: 1, failure: failure(error.code) };
    throw error;
  }
}
