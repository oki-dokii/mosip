import { InputError } from "./http.js";
export const flatProfile = "mock-sdjwt-flat-v1";
export interface Policy { profile: "legacy-mock-v1" | typeof flatProfile; requiredClaims: readonly string[] }
export const legacyPolicy: Policy = Object.freeze({ profile: "legacy-mock-v1", requiredClaims: Object.freeze([]) });
export function parsePolicy(input: Record<string, unknown>): Policy {
  if (Object.keys(input).some((key) => !["format", "profile", "requiredClaims"].includes(key))) throw new InputError(400, "invalid_request_policy");
  if (input.format !== "dc+sd-jwt") throw new InputError(400, "unsupported_format");
  if (input.profile === undefined && input.requiredClaims === undefined) return legacyPolicy;
  if (input.profile !== flatProfile) throw new InputError(400, "invalid_request_policy");
  const names = input.requiredClaims === undefined ? [] : input.requiredClaims;
  if (!Array.isArray(names) || names.length > 2 || names.some((name) => !["given_name", "family_name"].includes(name)) || new Set(names).size !== names.length) throw new InputError(400, "invalid_request_policy");
  return Object.freeze({ profile: flatProfile, requiredClaims: Object.freeze([...names] as string[]) });
}
