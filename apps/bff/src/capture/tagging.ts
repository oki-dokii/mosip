export type CaptureService = "mimoto" | "certify" | "esignet" | "verify";

export interface CaptureRule {
  id: string;
  service: CaptureService;
  method: string;
  pattern: RegExp;
  stepKey: string;
  template: string;
  why: string;
  example: string;
}

// Specific status/result routes precede request-resource routes. No substring guessing.
export const CAPTURE_RULES: readonly CaptureRule[] = [
  { id: "mimoto-discovery", service: "mimoto", method: "GET", pattern: /^\/v1\/mimoto\/issuers(?:\/[^/]+)?\/?$/, stepKey: "ISSUE_OFFER", template: "/v1/mimoto/issuers/{id}", why: "Browser requests issuer discovery from Mimoto.", example: "/v1/mimoto/issuers/Farmer" },
  { id: "mimoto-download", service: "mimoto", method: "POST", pattern: /^\/v1\/mimoto\/(?:credential|download)(?:\/[^/]+)?\/?$/, stepKey: "ISSUE_CREDENTIAL", template: "/v1/mimoto/credential/{id}", why: "Explicit credential download endpoint; not evidence of wallet storage.", example: "/v1/mimoto/credential/test" },
  { id: "certify-metadata", service: "certify", method: "GET", pattern: /^\/(?:[^/]+\/)*\.well-known\/(?:openid-credential-issuer|oauth-authorization-server|openid-configuration)\/?$/, stepKey: "ISSUE_OFFER", template: "/.well-known/{metadata}", why: "Discovery metadata precedes issuance and is not a credential response.", example: "/.well-known/openid-credential-issuer" },
  { id: "certify-offer", service: "certify", method: "GET", pattern: /^\/(?:v1\/certify\/)?(?:credential-offer|credential-offer-data)(?:\/[^/]+)?\/?$/, stepKey: "ISSUE_OFFER", template: "/credential-offer/{id}", why: "Explicit credential offer retrieval.", example: "/v1/certify/credential-offer-data/test" },
  { id: "certify-token", service: "certify", method: "POST", pattern: /^\/(?:v1\/certify\/)?(?:oauth\/)?token\/?$/, stepKey: "ISSUE_TOKEN", template: "/token", why: "POST to the configured token endpoint exchanges a grant.", example: "/v1/certify/oauth/token" },
  { id: "certify-credential", service: "certify", method: "POST", pattern: /^\/(?:v1\/certify\/)?(?:issuance\/)?credential\/?$/, stepKey: "ISSUE_CREDENTIAL", template: "/credential", why: "POST to the explicit credential endpoint requests issuance.", example: "/v1/certify/issuance/credential" },
  { id: "esignet-token", service: "esignet", method: "POST", pattern: /^\/(?:v1\/esignet\/)?oauth\/(?:v2\/)?token\/?$/, stepKey: "ISSUE_TOKEN", template: "/oauth/token", why: "Only the eSignet token endpoint is issuance-token evidence; login/consent pages remain untagged.", example: "/v1/esignet/oauth/v2/token" },
  { id: "verify-status", service: "verify", method: "GET", pattern: /^\/(?:v1\/verify\/(?:v2\/)?)?vp-request\/[^/]+\/status\/?$/, stepKey: "PRESENT_STATUS", template: "/vp-request/{id}/status", why: "Status subresource is polling evidence, not a new presentation request.", example: "/v1/verify/vp-request/test/status" },
  { id: "verify-result", service: "verify", method: "POST", pattern: /^\/(?:v1\/verify\/(?:v2\/)?)?vp-results\/[^/]+\/?$/, stepKey: "PRESENT_RESULT", template: "/vp-results/{id}", why: "Explicit verifier result resource; verdict still comes from its response.", example: "/v1/verify/v2/vp-results/test" },
  { id: "verify-request-create", service: "verify", method: "POST", pattern: /^\/(?:v1\/verify\/(?:v2\/)?)?vp-request\/?$/, stepKey: "PRESENT_REQUEST", template: "/vp-request", why: "POST creates the presentation request.", example: "/v1/verify/v2/vp-request" },
  { id: "verify-request-fetch", service: "verify", method: "GET", pattern: /^\/(?:v1\/verify\/(?:v2\/)?)?(?:vp-request|request-object)\/[^/]+\/?$/, stepKey: "PRESENT_REQUEST", template: "/vp-request/{id}", why: "GET fetches one request object; it does not prove a presentation occurred.", example: "/vp-request/test" },
  { id: "verify-submit", service: "verify", method: "POST", pattern: /^\/(?:v1\/verify\/(?:v2\/)?)?(?:vp-submission\/)?direct-post(?:\/[^/]+)?\/?$/, stepKey: "PRESENT_SUBMIT", template: "/direct-post/{id}", why: "Explicit direct-post endpoint receives a presentation.", example: "/v1/verify/v2/vp-submission/direct-post" },
];

export function tagCapture(service: CaptureService, method: string, path: string) {
  return CAPTURE_RULES.find((rule) => rule.service === service && rule.method === method && rule.pattern.test(path)) ?? null;
}
