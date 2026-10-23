import type { RunConfig } from "@playground/shared";

type TamperKind = NonNullable<RunConfig["tamper"]>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function flipLastCharacter(value: string) {
  if (!value) throw new Error("Cannot corrupt an empty signature");
  const last = value.at(-1);
  return `${value.slice(0, -1)}${last === "A" ? "B" : "A"}`;
}

function corruptJwtSignature(jwt: string) {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[2]) throw new Error("Expected a signed compact JWT");
  const signature = Buffer.from(parts[2], "base64url");
  if (!signature.length) throw new Error("Expected a non-empty JWT signature");
  signature[0] = signature[0]! ^ 0x01;
  parts[2] = signature.toString("base64url");
  return parts.join(".");
}

function tamperSdJwt(credential: string, kind: TamperKind) {
  const parts = credential.split("~");
  if (!parts[0]) throw new Error("Expected an SD-JWT credential");
  if (kind === "bad_signature") parts[0] = corruptJwtSignature(parts[0]);
  if (kind === "missing_disclosure") {
    if (parts.length < 3) throw new Error("SD-JWT does not contain a disclosure to remove");
    parts.splice(1, 1);
  }
  return parts.join("~");
}

function tamperJsonLd(credential: Record<string, any>, kind: TamperKind) {
  const output = clone(credential);
  if (kind === "bad_signature") {
    if (!output.proof?.proofValue) throw new Error("JSON-LD credential has no proof value to corrupt");
    output.proof.proofValue = flipLastCharacter(output.proof.proofValue);
  }
  if (kind === "missing_disclosure") throw new Error("Disclosure policy tests require SD-JWT");
  return output;
}

export function applyCredentialTamper(credential: unknown, kind: TamperKind, format: RunConfig["format"]) {
  if (kind === "expired" || kind === "wrong_type") throw new Error("Semantic faults must be signed at issuance");
  if (kind === "replay_nonce") return clone(credential);
  if (format === "vc_sd_jwt") {
    if (typeof credential !== "string") throw new Error("Expected an SD-JWT string");
    return tamperSdJwt(credential, kind);
  }
  if (!credential || typeof credential !== "object") throw new Error("Expected a JSON-LD credential object");
  return tamperJsonLd(credential as Record<string, any>, kind);
}

export function presentationNonce(nonce: string, kind: RunConfig["tamper"]) {
  return kind === "replay_nonce" ? `replayed-${nonce}` : nonce;
}
