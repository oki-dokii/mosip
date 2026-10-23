export const knownCodes = Object.freeze({
  ISSUER_SIGNATURE_INVALID: "issuer_signature", CREDENTIAL_EXPIRED: "credential_time", CREDENTIAL_NOT_YET_VALID: "credential_time", INVALID_CREDENTIAL_CLAIMS: "credential_claims",
  CREDENTIAL_TYPE_MISMATCH: "credential_type", HOLDER_PROOF_INVALID: "holder_proof", HOLDER_BINDING_MISSING: "holder_binding", INVALID_HOLDER_KEY: "holder_binding",
  AUDIENCE_MISMATCH: "audience", NONCE_MISMATCH: "nonce", SD_HASH_MISMATCH: "binding_hash", REQUIRED_DISCLOSURE_MISSING: "required_claims",
  INVALID_STATE: "state", REQUEST_EXPIRED: "state", UNSUPPORTED_PRESENTATION_SUBMISSION: "profile", INVALID_VP_TOKEN: "transport",
  MALFORMED_PRESENTATION: "structure", UNSUPPORTED_ISSUER_KEY: "issuer_key", UNSUPPORTED_ALGORITHM: "issuer_key", DISCLOSURE_DIGEST_MISMATCH: "disclosures",
  MALFORMED_DISCLOSURE: "disclosures", UNSUPPORTED_DISCLOSURE_PROFILE: "disclosures", KB_TYPE_MISMATCH: "holder_proof", KB_TIME_INVALID: "holder_time",
});
export function evaluate(expected, observed) {
  if (!observed.controlPassed || !observed.constructionPassed || observed.error || ![200, 400].includes(observed.httpStatus) || !["result", "direct_post"].includes(observed.boundary) || observed.diagnosticsVersion !== 1 || !["valid", "invalid"].includes(observed.outcome)) return "inconclusive";
  if (observed.outcome === "valid" && (observed.httpStatus !== 200 || observed.boundary !== "result")) return "inconclusive";
  if (observed.outcome === "valid") return expected.outcome === "valid" ? "correct_acceptance" : "wrongly_accepted";
  if (!Object.hasOwn(knownCodes, observed.code) || knownCodes[observed.code] !== observed.stage) return "inconclusive";
  if (expected.outcome === "valid") return "unexpected_rejection";
  if (observed.boundary !== expected.boundary) return "wrong_step";
  if (observed.stage !== expected.stage || observed.code !== expected.code) return "wrong_reason";
  return "correct_rejection";
}
export function exitCode(results) {
  if (!results.length || results.some((result) => result.verdict === "inconclusive")) return 2;
  return results.every((result) => ["correct_acceptance", "correct_rejection"].includes(result.verdict)) ? 0 : 1;
}
// Rebuild from bounded vocabulary; never spread an HTTP body or Error into artifacts.
export function safeObservation(value) {
  const known = Object.hasOwn(knownCodes, value.code) && knownCodes[value.code] === value.stage;
  return {
    httpStatus: Number.isInteger(value.httpStatus) && value.httpStatus >= 100 && value.httpStatus <= 599 ? value.httpStatus : null,
    boundary: ["result", "direct_post"].includes(value.boundary) ? value.boundary : null,
    outcome: ["valid", "invalid"].includes(value.outcome) ? value.outcome : null,
    diagnosticsVersion: value.diagnosticsVersion === 1 ? 1 : null,
    code: known ? value.code : null, stage: known ? value.stage : null,
    controlPassed: value.controlPassed === true, constructionPassed: value.constructionPassed === true,
    error: ["transport", "timeout", "malformed_result", "configuration", "construction", "unknown_rejection"].includes(value.error) ? value.error : value.error ? "transport" : null,
  };
}
