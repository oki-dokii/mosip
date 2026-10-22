export const stages = {
  MALFORMED_PRESENTATION: "structure", UNSUPPORTED_ISSUER_KEY: "issuer_key", UNSUPPORTED_ALGORITHM: "issuer_key",
  ISSUER_SIGNATURE_INVALID: "issuer_signature", CREDENTIAL_EXPIRED: "credential_time", CREDENTIAL_NOT_YET_VALID: "credential_time", INVALID_CREDENTIAL_CLAIMS: "credential_claims",
  CREDENTIAL_TYPE_MISMATCH: "credential_type", HOLDER_BINDING_MISSING: "holder_binding", INVALID_HOLDER_KEY: "holder_binding",
  DISCLOSURE_DIGEST_MISMATCH: "disclosures", MALFORMED_DISCLOSURE: "disclosures", UNSUPPORTED_DISCLOSURE_PROFILE: "disclosures",
  KB_TYPE_MISMATCH: "holder_proof", HOLDER_PROOF_INVALID: "holder_proof", KB_TIME_INVALID: "holder_time",
  AUDIENCE_MISMATCH: "audience", NONCE_MISMATCH: "nonce", SD_HASH_MISMATCH: "binding_hash", REQUIRED_DISCLOSURE_MISSING: "required_claims",
  INVALID_STATE: "state", REQUEST_EXPIRED: "state", UNSUPPORTED_PRESENTATION_SUBMISSION: "profile", INVALID_VP_TOKEN: "transport",
} as const;
export type RejectionCode = keyof typeof stages;
export class Rejection extends Error {
  constructor(readonly code: RejectionCode) { super(code); }
}
export function failure(code: RejectionCode, boundary: "result" | "direct_post" = "result") {
  return { boundary, stage: stages[code], code };
}
export type VerificationResult =
  | { outcome: "valid"; diagnosticsVersion: 1; issuerSignatureValid: true; holderProofValid: true; disclosedClaims: number; certificateTrustChecked: false }
  | { outcome: "invalid"; diagnosticsVersion: 1; failure: ReturnType<typeof failure> };
