import { randomBytes } from "node:crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";
import type { DriverContext, DriverExchange, DriverResult, VerifierDriver, IssuerDriver } from "./types.js";

export const localProfile = () => process.env.ASSISTED_LOCAL_PROFILE === "jsonld-0.14";
// Deliberately exact. No general HTTP exemption, TLS bypass or arbitrary-host fetch.
export function validLocalSettings() {
  return localProfile() && process.env.CERTIFY_BASE_URL === "http://127.0.0.1:18090/v1/certify" &&
    process.env.VERIFY_BASE_URL === "http://127.0.0.1:18081/v1/verify" &&
    process.env.ASSISTED_WALLET_URL === "http://127.0.0.1:18093/" &&
    process.env.ASSISTED_OFFER_URL === "http://127.0.0.1:18093/issuers/LocalFarmer";
}
const verifier = "http://127.0.0.1:18081/v1/verify";
async function call(context: DriverContext, path: string, body?: unknown) {
  if (!validLocalSettings() || !/^\/(?:vp-request(?:\/[A-Za-z0-9_-]+(?:\/status)?)?|v2\/vp-results\/[A-Za-z0-9_-]+)$/.test(path)) throw new Error("LOCAL_VERIFY_POLICY");
  const start = Date.now();
  const response = await fetch(verifier + path, { method: body === undefined ? "GET" : "POST", redirect: "error",
    headers: { "content-type": "application/json", accept: "application/json, application/oauth-authz-req+jwt" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) });
  const text = await response.text();
  if (text.length > 131072) throw new Error("LOCAL_VERIFY_RESPONSE_LIMIT");
  let value; try { value = JSON.parse(text); } catch { value = text; }
  return { status: response.status, value, durationMs: Date.now() - start };
}
const entry = (path: string, method: string, result: { status: number; durationMs: number }, response: unknown): DriverExchange =>
  ({ actorFrom: "playground", actorTo: "inji_verify", method, url: verifier + path, status: result.status, durationMs: result.durationMs,
    request: { protocolProfile: "local-jsonld-pex-0.18.2", bodyStored: false }, response });
export class LocalWebIssuer implements IssuerDriver {
  readonly id = "inji_certify" as const;
  async createOffer(context: DriverContext): Promise<DriverResult> {
    if (!validLocalSettings()) throw new Error("LOCAL_ISSUER_POLICY");
    const url = "http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer";
    const response = await fetch(url, { redirect: "error", signal: context.signal ?? AbortSignal.timeout(10000) });
    if (response.status !== 200) throw new Error("LOCAL_ISSUER_UNAVAILABLE");
    return { summary: { catalogueConfigured: true, authorization: "synthetic_iar_fixture", issuerVersion: "0.14.0" },
      exchanges: [{ actorFrom: "playground", actorTo: this.id, method: "GET", url, status: response.status, durationMs: 0,
        request: { bodyStored: false }, response: { metadataAvailable: true, credentialFormat: "ldp_vc" } }] };
  }
}
export class LocalWebVerifier implements VerifierDriver {
  readonly id = "inji_verify" as const;
  async createRequest(context: DriverContext): Promise<DriverResult> {
    const definition = { id: "local-jsonld-farmer", input_descriptors: [{ id: "farmer",
      format: { ldp_vc: { proof_type: ["Ed25519Signature2020"] } },
      constraints: { fields: [{ path: ["$.type[*]"], filter: { type: "string", pattern: "FarmerCredential" } }] } }] };
    const nonce = randomBytes(24).toString("base64url");
    const created = await call(context, "/vp-request", { clientId: "did:web:local.test:verify", nonce,
      presentationDefinition: definition, responseCodeValidationRequired: false });
    if (created.status !== 201 || !created.value?.transactionId || !created.value?.requestId || typeof created.value.requestUri !== "string") throw new Error("LOCAL_VERIFY_REQUEST_FAILED");
    const uri = new URL(created.value.requestUri);
    if (uri.origin !== "https://local.test" || uri.search || uri.hash || !/^\/v1\/verify\/vp-request\/[A-Za-z0-9_-]+$/.test(uri.pathname)) throw new Error("LOCAL_VERIFY_REQUEST_URI_POLICY");
    const signed = await call(context, uri.pathname.slice("/v1/verify".length));
    if (signed.status !== 200 || typeof signed.value !== "string") throw new Error("LOCAL_VERIFY_SIGNED_REQUEST_FAILED");
    const claims = decodeJwt(signed.value);
    if (decodeProtectedHeader(signed.value).alg !== "EdDSA" || claims.nonce !== nonce || claims.client_id !== "did:web:local.test:verify" ||
      claims.response_uri !== "https://local.test/v1/verify/vp-submission/direct-post" || claims.response_mode !== "direct_post" || typeof claims.state !== "string" || claims.state.length < 32) throw new Error("LOCAL_VERIFY_REQUEST_BINDING");
    context.state.set("collab.requestClaims", claims);
    context.state.set("local.verify.ids", { requestId: created.value.requestId, transactionId: created.value.transactionId });
    const params = new URLSearchParams({ request: signed.value });
    for (const key of ["client_id", "client_id_scheme", "response_type", "response_mode", "nonce", "state", "response_uri"]) if (typeof claims[key] === "string") params.set(key, claims[key] as string);
    params.set("presentation_definition", JSON.stringify(claims.presentation_definition));
    context.state.set("assisted.localPresentationUrl", "http://127.0.0.1:18093/user/authorize?" + params);
    return { summary: { signedRequestReceived: true, queryLanguage: "Presentation Exchange", protocolProfile: "local-jsonld-pex-0.18.2", requestSignatureVerification: "wallet_responsibility" },
      exchanges: [entry("/vp-request", "POST", created, { requestUriIssued: true, bodyStored: false }), entry(uri.pathname.slice(10), "GET", signed, { signedRequestReceived: true, bodyStored: false })] };
  }
  async pollStatus(_context: DriverContext): Promise<DriverResult> {
    // Actual submitted server exchange has already been correlated by the wallet driver.
    return { summary: { status: "VP_SUBMITTED", source: "correlated_server_direct_post", transportOnly: true } };
  }
  async getResult(context: DriverContext): Promise<DriverResult> {
    const ids = context.state.get("local.verify.ids") as { transactionId: string };
    if (!ids || !/^[A-Za-z0-9_-]+$/.test(ids.transactionId)) throw new Error("LOCAL_VERIFY_IDS_MISSING");
    const path = "/v2/vp-results/" + ids.transactionId;
    const result = await call(context, path, { includeClaims: false, skipStatusChecks: true });
    const body = result.value;
    if (result.status !== 200 || typeof body?.allChecksSuccessful !== "boolean") throw new Error("LOCAL_VERIFY_RESULT_UNAVAILABLE");
    const first = body.credentialResults?.[0];
    const summary = { allChecksSuccessful: body.allChecksSuccessful,
      credentialProofValid: first?.schemaAndSignatureCheck?.valid === true,
      holderProofValid: first?.holderProofCheck?.valid === true,
      outcome: body.allChecksSuccessful && first?.schemaAndSignatureCheck?.valid === true && first?.holderProofCheck?.valid === true ? "valid" : "invalid",
      protocolProfile: "local-jsonld-pex-0.18.2", statusChecks: "skipped", resultSource: "independent_verify_poll" };
    return { summary, exchanges: [entry(path, "POST", result, summary)] };
  }
}
