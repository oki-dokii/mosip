import { assertOutboundUrl, readBoundedResponse } from "./outbound.js";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { importJWK, SignJWT, type JWK } from "jose";
import type { DriverContext, DriverExchange } from "./types.js";
import { issueCredential as issueSignedMockCredential } from "@playground/mock-issuer/credential";
import { loadIssuerSigner } from "@playground/mock-issuer/signing";
import { UpstreamHttpFailure } from "./upstreamFailure.js";
import { safeFailure, signedVariant } from "../protocol.js";

export type JsonObject = Record<string, any>;

interface CollabConfig {
  authBaseUrl: string;
  certifyBaseUrl: string;
  verifyBaseUrl: string;
  postmanEnvironmentPath: string;
  mockOtp: string;
  clientId: string;
  redirectUri: string;
  individualId: string;
  clientPrivateJwk: JWK;
  credentialConfigurationId: string;
  credentialScope: string;
  credentialFormat: "ldp_vc" | "dc+sd-jwt";
}

export interface HttpResult {
  status: number;
  body: any;
  durationMs: number;
}

export const STATE = {
  config: "collab.config",
  cookie: "collab.cookie",
  cookieOrigin: "collab.cookieOrigin",
  accessToken: "collab.accessToken",
  credentialNonce: "collab.credentialNonce",
  holderKey: "collab.holderKey",
  holderPublicJwk: "collab.holderPublicJwk",
  holderPrivateJwk: "collab.holderPrivateJwk",
  credential: "collab.credential",
  verifyTransactionId: "collab.verifyTransactionId",
  verifyRequestId: "collab.verifyRequestId",
  requestClaims: "collab.requestClaims",
  mockVpToken: "collab.mockVpToken",
  mockVerifierRequestId: "collab.mockVerifierRequestId",
  verifySubmissionRejection: "collab.verifySubmissionRejection",
} as const;

export function stateValue<T>(context: DriverContext, key: string): T {
  const value = context.state.get(key);
  if (value === undefined) throw new Error(`Collab run state is missing ${key}`);
  return value as T;
}

export function sha256Base64url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function positiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Expected a non-negative integer, received ${value}`);
  return parsed;
}

export function submissionErrorCode(body: JsonObject | undefined) {
  const candidate = body?.errorCode ?? body?.error;
  return typeof candidate === "string" && ["invalid_request", "invalid_nonce", "invalid_state", "access_denied", "unsupported_response_type", "invalid_client", "invalid_vp_token"].includes(candidate)
    ? candidate : "VERIFIER_REJECTED_SUBMISSION";
}

export function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function decodeJwtPayload(jwt: string): JsonObject {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("Expected a compact JWT");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export async function createJwt(privateJwk: JWK, payload: JsonObject, header: JsonObject = {}) {
  const now = Math.floor(Date.now() / 1000);
  const algorithm = header.alg ?? "RS256";
  const key = await importJWK(privateJwk, algorithm);
  return new SignJWT(payload)
    .setProtectedHeader({
      typ: "JWT",
      alg: algorithm,
      ...(privateJwk.kid ? { kid: privateJwk.kid } : {}),
      ...header,
    })
    .setIssuedAt(now - 5)
    .setNotBefore(now - 5)
    .setExpirationTime(now + 600)
    .setJti(randomUUID())
    .sign(key);
}

export async function loadConfig(context: DriverContext): Promise<CollabConfig> {
  const existing = context.state.get(STATE.config);
  if (existing) return existing as CollabConfig;
  if (context.config.wallet === "inji_web_assisted" && context.config.format === "ldp_vc") {
    const config: CollabConfig = { authBaseUrl: "", certifyBaseUrl: process.env.CERTIFY_BASE_URL ?? "", verifyBaseUrl: process.env.VERIFY_BASE_URL ?? "", postmanEnvironmentPath: "", mockOtp: "", clientId: "", redirectUri: "", individualId: "", clientPrivateJwk: {}, credentialConfigurationId: process.env.CREDENTIAL_CONFIGURATION_ID ?? "FarmerCredential_VCDM2.0", credentialScope: "", credentialFormat: "ldp_vc" };
    context.state.set(STATE.config, config); return config;
  }
  if (context.config.wallet !== "reference_wallet" || ((context.config.issuer === "mock_issuer" || context.config.verifier === "mock_verifier") && context.config.format !== "vc_sd_jwt")) {
    throw new Error("Collab mode supports the Reference Wallet; mock roles support SD-JWT VC only");
  }
  if (context.config.issuer === "mock_issuer") {
    const config: CollabConfig = {
      authBaseUrl: "", certifyBaseUrl: "", postmanEnvironmentPath: "", mockOtp: "",
      verifyBaseUrl: process.env.VERIFY_BASE_URL ?? "https://injiverify.collab.mosip.net/v1/verify",
      clientId: "playground-test-client", redirectUri: "", individualId: "", clientPrivateJwk: {},
      credentialConfigurationId: "MockVerifiableCredential_SD_JWT", credentialScope: "",
      credentialFormat: "dc+sd-jwt",
    };
    context.state.set(STATE.config, config);
    return config;
  }
  const postmanEnvironmentPath = process.env.OFFICIAL_POSTMAN_ENV_PATH;
  const mockOtp = process.env.MOCK_OTP;
  if (!postmanEnvironmentPath || !mockOtp) {
    throw new Error("Collab mode requires OFFICIAL_POSTMAN_ENV_PATH and MOCK_OTP");
  }
  const environment = JSON.parse(await readFile(postmanEnvironmentPath, "utf8"));
  const values = Object.fromEntries((environment.values ?? []).map(({ key, value }: JsonObject) => [key, value]));
  const clientPrivateJwk = JSON.parse(values.privateKey_jwk ?? "null");
  if (!values.clientId || !values.redirectionUrl || !values.individual_id || !clientPrivateJwk?.d) {
    throw new Error("Official environment is missing the test client, identity, redirect URI, or private JWK");
  }
  const isSdJwt = context.config.format === "vc_sd_jwt";
  const config: CollabConfig = {
    authBaseUrl: process.env.ESIGNET_BASE_URL ?? "https://esignet-mock.collab.mosip.net/v1/esignet",
    certifyBaseUrl: process.env.CERTIFY_BASE_URL
      ?? process.env.FARMER_CERTIFY_BASE_URL
      ?? (isSdJwt ? "https://injicertify-mock.collab.mosip.net" : "https://injicertify-farmer.collab.mosip.net"),
    verifyBaseUrl: process.env.VERIFY_BASE_URL ?? "https://injiverify.collab.mosip.net/v1/verify",
    postmanEnvironmentPath,
    mockOtp,
    clientId: values.clientId,
    redirectUri: values.redirectionUrl,
    individualId: values.individual_id,
    clientPrivateJwk,
    credentialConfigurationId: process.env.CREDENTIAL_CONFIGURATION_ID
      ?? (isSdJwt ? "MockVerifiableCredential_SD_JWT" : "FarmerCredential_VCDM2.0"),
    credentialScope: process.env.CREDENTIAL_SCOPE ?? "mock_identity_vc_ldp",
    credentialFormat: isSdJwt ? "dc+sd-jwt" : "ldp_vc",
  };
  context.state.set(STATE.config, config);
  return config;
}

export async function issueMockSdJwt(holderPublicJwk: JWK, context: DriverContext) {
  const signer = await loadIssuerSigner({ issuerUrl: "http://mock-issuer.test" });
  return issueSignedMockCredential({ signer, holderPublicJwk, variant: signedVariant(context.config) ?? "valid", now: Math.floor(Date.now() / 1000), twoClaims: true });
}

export function issuerRepresentation(credential: string): "x509" | "did:jwk" | "unreported" {
  const jwt = credential.split("~")[0]!;
  const header = JSON.parse(Buffer.from(jwt.split(".")[0]!, "base64url").toString("utf8"));
  return Array.isArray(header.x5c) && header.x5c.length ? "x509" : decodeJwtPayload(jwt).iss?.startsWith("did:jwk:") ? "did:jwk" : "unreported";
}
export function mockResult(body: JsonObject, boundary: "result" | "direct_post" = "result"): JsonObject {
  const diagnostic = safeFailure(body?.failure, boundary);
  if (body?.diagnosticsVersion !== 1 || (body?.outcome !== "valid" && body?.outcome !== "invalid")) return { outcome: "error", error: "MALFORMED_VERIFIER_RESULT" };
  if (body.outcome === "invalid" && !diagnostic || body.outcome === "valid" && (body.issuerSignatureValid !== true || body.holderProofValid !== true)) return { outcome: "error", error: "MALFORMED_VERIFIER_RESULT" };
  return { outcome: body.outcome, diagnosticsVersion: 1, ...(diagnostic ? { failure: diagnostic } : {}), ...(body.outcome === "valid" ? { issuerSignatureValid: true, holderProofValid: true, certificateTrustChecked: false } : {}) };
}

export async function request(context: DriverContext, url: string, options: RequestInit & { allowStatuses?: number[] } = {}): Promise<HttpResult> {
  const { allowStatuses = [], ...fetchOptions } = options;
  const configured = await loadConfig(context);
  assertOutboundUrl(url, [configured.authBaseUrl, configured.certifyBaseUrl, configured.verifyBaseUrl, process.env.MOCK_ISSUER_BASE_URL ?? "", process.env.MOCK_VERIFIER_BASE_URL ?? ""]);
  const headers = new Headers(fetchOptions.headers);
  const cookie = context.state.get(STATE.cookie);
  const requestOrigin = new URL(url).origin;
  const cookieOrigin = context.state.get(STATE.cookieOrigin);
  const attachCookie = typeof cookie === "string" && !!cookie && cookieOrigin === requestOrigin;
  if (attachCookie) headers.set("cookie", cookie);
  const startedAt = performance.now();
  const response = await fetch(url, { ...fetchOptions, headers, redirect: "manual" as const, signal: context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
  const durationMs = Math.round(performance.now() - startedAt);
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const config = context.state.get(STATE.config) as CollabConfig | undefined;
  const authOrigin = config?.authBaseUrl ? new URL(config.authBaseUrl).origin : null;
  if (setCookies.length && context.config.wallet !== "inji_web_assisted" && authOrigin === requestOrigin && (!response.url || new URL(response.url).origin === requestOrigin)) {
    context.state.set(STATE.cookie, setCookies.map((item) => item.split(";", 1)[0]).join("; "));
    context.state.set(STATE.cookieOrigin, requestOrigin);
  }
  if (response.status >= 300 && response.status < 400) throw new Error("OUTBOUND_REDIRECT_FORBIDDEN");
  const text = await readBoundedResponse(response);
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new UpstreamHttpFailure({ method: fetchOptions.method ?? "GET", url, status: response.status, durationMs, body });
  }
  return { status: response.status, body, durationMs };
}

export function exchange(
  actorFrom: string,
  actorTo: string,
  method: string,
  url: string,
  result: HttpResult,
  requestBody: unknown,
  responseBody: unknown,
): DriverExchange {
  return { actorFrom, actorTo, method, url, status: result.status, durationMs: result.durationMs, request: requestBody, response: responseBody };
}

export function authHeaders(csrfToken: string, oauthDetailsKey?: string, oauthDetailsHash?: string) {
  return {
    "content-type": "application/json",
    "x-xsrf-token": csrfToken,
    ...(oauthDetailsKey ? { "oauth-details-key": oauthDetailsKey } : {}),
    ...(oauthDetailsHash ? { "oauth-details-hash": oauthDetailsHash } : {}),
  };
}
