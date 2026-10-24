import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Ed25519VerificationKey2020 } from "@digitalbazaar/ed25519-verification-key-2020";
import { importJWK, SignJWT, type JWK } from "jose";
import jsonld from "jsonld";
import jsigs from "jsonld-signatures";
import type { RunConfig } from "@playground/shared";
import type { DriverContext, DriverExchange, DriverResult, DriverSet, IssuerDriver, VerifierDriver, WalletDriver } from "./types.js";
import { applyCredentialTamper, presentationNonce } from "../tamper/index.js";
import { issueCredential as issueSignedMockCredential } from "@playground/mock-issuer/credential";
import { loadIssuerSigner } from "@playground/mock-issuer/signing";
import { verifyPresentation } from "@playground/mock-verifier";
import { UpstreamHttpFailure } from "./upstreamFailure.js";
import { mockPolicy, safeFailure, signedVariant } from "../protocol.js";

const { AuthenticationProofPurpose } = jsigs.purposes;

type JsonObject = Record<string, any>;

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

interface HttpResult {
  status: number;
  body: any;
  durationMs: number;
}

const STATE = {
  config: "collab.config",
  cookie: "collab.cookie",
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

function stateValue<T>(context: DriverContext, key: string): T {
  const value = context.state.get(key);
  if (value === undefined) throw new Error(`Collab run state is missing ${key}`);
  return value as T;
}

function sha256Base64url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function positiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Expected a non-negative integer, received ${value}`);
  return parsed;
}

function submissionErrorCode(body: JsonObject | undefined) {
  const candidate = body?.errorCode ?? body?.error;
  return typeof candidate === "string" && ["invalid_request", "invalid_nonce", "invalid_state", "access_denied", "unsupported_response_type", "invalid_client", "invalid_vp_token"].includes(candidate)
    ? candidate : "VERIFIER_REJECTED_SUBMISSION";
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function decodeJwtPayload(jwt: string): JsonObject {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("Expected a compact JWT");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function createJwt(privateJwk: JWK, payload: JsonObject, header: JsonObject = {}) {
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

async function loadConfig(context: DriverContext): Promise<CollabConfig> {
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

class MockIssuerDriver implements IssuerDriver {
  readonly id = "mock_issuer" as const;

  async createOffer(context: DriverContext): Promise<DriverResult> {
    if (context.config.format !== "vc_sd_jwt") throw new Error("Mock issuer currently supports SD-JWT VC only");
    const baseUrl = process.env.MOCK_ISSUER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/.well-known/openid-credential-issuer`;
      const result = await request(context, url);
      if (!result.body?.credential_configurations_supported?.MockVerifiableCredential_SD_JWT) throw new Error("External mock issuer does not advertise the SD-JWT configuration");
      return { exchanges: [exchange(context.config.wallet, this.id, "GET", url, result, {}, {
        credential_issuer: result.body.credential_issuer, credential_configuration_id: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt",
      })], summary: { credentialConfigurationId: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt", source: "external_non_inji_mock" } };
    }
    return {
      exchanges: [exchange(context.config.wallet, this.id, "GET", "mock://issuer/.well-known/openid-credential-issuer", { status: 200, body: {}, durationMs: 0 }, {}, {
        credential_issuer: "mock://issuer", credential_configuration_id: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt",
      })],
      summary: { credentialConfigurationId: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt", source: "local_non_inji_mock" },
    };
  }
}

async function issueMockSdJwt(holderPublicJwk: JWK, context: DriverContext) {
  const signer = await loadIssuerSigner({ issuerUrl: "http://mock-issuer.test" });
  return issueSignedMockCredential({ signer, holderPublicJwk, variant: signedVariant(context.config) ?? "valid", now: Math.floor(Date.now() / 1000), twoClaims: true });
}

function issuerRepresentation(credential: string): "x509" | "did:jwk" | "unreported" {
  const jwt = credential.split("~")[0]!;
  const header = JSON.parse(Buffer.from(jwt.split(".")[0]!, "base64url").toString("utf8"));
  return Array.isArray(header.x5c) && header.x5c.length ? "x509" : decodeJwtPayload(jwt).iss?.startsWith("did:jwk:") ? "did:jwk" : "unreported";
}
function mockResult(body: JsonObject, boundary: "result" | "direct_post" = "result"): JsonObject {
  const diagnostic = safeFailure(body?.failure, boundary);
  if (body?.diagnosticsVersion !== 1 || (body?.outcome !== "valid" && body?.outcome !== "invalid")) return { outcome: "error", error: "MALFORMED_VERIFIER_RESULT" };
  if (body.outcome === "invalid" && !diagnostic || body.outcome === "valid" && (body.issuerSignatureValid !== true || body.holderProofValid !== true)) return { outcome: "error", error: "MALFORMED_VERIFIER_RESULT" };
  return { outcome: body.outcome, diagnosticsVersion: 1, ...(diagnostic ? { failure: diagnostic } : {}), ...(body.outcome === "valid" ? { issuerSignatureValid: true, holderProofValid: true, certificateTrustChecked: false } : {}) };
}

async function request(context: DriverContext, url: string, options: RequestInit & { allowStatuses?: number[] } = {}): Promise<HttpResult> {
  const { allowStatuses = [], ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  const cookie = context.state.get(STATE.cookie);
  if (typeof cookie === "string" && cookie) headers.set("cookie", cookie);
  const startedAt = performance.now();
  const response = await fetch(url, { ...fetchOptions, headers, signal: context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
  const durationMs = Math.round(performance.now() - startedAt);
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length && context.config.wallet !== "inji_web_assisted") context.state.set(STATE.cookie, setCookies.map((item) => item.split(";", 1)[0]).join("; "));
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new UpstreamHttpFailure({ method: fetchOptions.method ?? "GET", url, status: response.status, durationMs, body });
  }
  return { status: response.status, body, durationMs };
}

function exchange(
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

function authHeaders(csrfToken: string, oauthDetailsKey?: string, oauthDetailsHash?: string) {
  return {
    "content-type": "application/json",
    "x-xsrf-token": csrfToken,
    ...(oauthDetailsKey ? { "oauth-details-key": oauthDetailsKey } : {}),
    ...(oauthDetailsHash ? { "oauth-details-hash": oauthDetailsHash } : {}),
  };
}

class CollabIssuerDriver implements IssuerDriver {
  readonly id = "inji_certify" as const;

  async createOffer(context: DriverContext): Promise<DriverResult> {
    const config = await loadConfig(context);
    const url = `${config.certifyBaseUrl}/.well-known/openid-credential-issuer`;
    const result = await request(context, url, { headers: { accept: "application/json" } });
    const configurations = result.body?.credential_configurations_supported ?? {};
    if (!configurations[config.credentialConfigurationId]) {
      throw new Error(`Issuer does not advertise ${config.credentialConfigurationId}`);
    }
    return {
      exchanges: [exchange(context.config.wallet, this.id, "GET", url, result, { accept: "application/json" }, {
        credential_issuer: result.body?.credential_issuer,
        credential_configuration_id: config.credentialConfigurationId,
        format: config.credentialFormat,
        supported: true,
      })],
      summary: { credentialConfigurationId: config.credentialConfigurationId, format: config.credentialFormat },
    };
  }
}

class CollabWalletDriver implements WalletDriver {
  readonly id = "reference_wallet" as const;

  async authorize(context: DriverContext): Promise<DriverResult> {
    if (context.config.issuer === "mock_issuer") {
      const baseUrl = process.env.MOCK_ISSUER_BASE_URL;
      if (baseUrl) {
        const url = `${baseUrl}/token`;
        const token = await request(context, url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code", "pre-authorized_code": "public-test-code", ...(signedVariant(context.config) ? { mock_case: signedVariant(context.config)! } : {}) }) });
        if (!token.body?.access_token || !token.body?.c_nonce) throw new Error("External mock issuer omitted token or nonce");
        context.state.set(STATE.accessToken, token.body.access_token);
        context.state.set(STATE.credentialNonce, token.body.c_nonce);
        return { exchanges: [exchange(this.id, "mock_issuer", "POST", url, token, { grant_type: "pre-authorized_code" }, { token_type: token.body.token_type, access_token: token.body.access_token, c_nonce: token.body.c_nonce })], summary: { authorized: true, source: "external_non_inji_mock" } };
      }
      return { exchanges: [exchange(this.id, "mock_issuer", "POST", "mock://issuer/token", { status: 200, body: {}, durationMs: 0 }, { grant_type: "pre-authorized_code" }, { token_type: "Bearer", access_token: "synthetic-token" })], summary: { authorized: true, source: "local_non_inji_mock" } };
    }
    const config = await loadConfig(context);
    const exchanges: DriverExchange[] = [];
    const csrfUrl = `${config.authBaseUrl}/csrf/token`;
    const csrf = await request(context, csrfUrl);
    exchanges.push(exchange(this.id, "esignet", "GET", csrfUrl, csrf, {}, { csrfCookieReceived: true }));
    const cookie = stateValue<string>(context, STATE.cookie);
    const csrfToken = cookie.split("; ").find((item) => item.startsWith("XSRF-TOKEN="))?.slice("XSRF-TOKEN=".length);
    if (!csrfToken) throw new Error("eSignet did not set an XSRF-TOKEN cookie");

    const codeVerifier = randomBytes(32).toString("base64url");
    const oauthBody = {
      requestTime: new Date().toISOString(),
      request: {
        clientId: config.clientId,
        scope: config.credentialScope,
        responseType: "code",
        redirectUri: config.redirectUri,
        display: "popup",
        prompt: "login",
        acrValues: "mosip:idp:acr:generated-code",
        nonce: randomBytes(18).toString("base64url"),
        state: randomBytes(12).toString("base64url"),
        claimsLocales: "en",
        codeChallenge: sha256Base64url(codeVerifier),
        codeChallengeMethod: "S256",
      },
    };
    const detailsUrl = `${config.authBaseUrl}/authorization/v2/oauth-details`;
    const details = await request(context, detailsUrl, { method: "POST", headers: authHeaders(csrfToken), body: JSON.stringify(oauthBody) });
    const detailsValue = details.body?.response;
    const transactionId = detailsValue?.transactionId;
    if (!transactionId) throw new Error("eSignet did not return a transaction id");
    const detailsHash = sha256Base64url(JSON.stringify(detailsValue));
    exchanges.push(exchange(this.id, "esignet", "POST", detailsUrl, details, oauthBody, { transactionCreated: true }));

    const otpUrl = `${config.authBaseUrl}/authorization/send-otp`;
    const otpBody = { requestTime: new Date().toISOString(), request: { transactionId, individualId: config.individualId, otpChannels: ["email", "phone"], captchaToken: "dummy" } };
    const otp = await request(context, otpUrl, { method: "POST", headers: authHeaders(csrfToken, transactionId, detailsHash), body: JSON.stringify(otpBody) });
    exchanges.push(exchange(this.id, "esignet", "POST", otpUrl, otp, otpBody, { otpDispatched: otp.status < 300 }));

    const authenticateUrl = `${config.authBaseUrl}/authorization/v3/authenticate`;
    const authenticateBody = { requestTime: new Date().toISOString(), request: { transactionId, individualId: config.individualId, challengeList: [{ authFactorType: "OTP", challenge: config.mockOtp, format: "alpha-numeric" }] } };
    const authenticated = await request(context, authenticateUrl, { method: "POST", headers: authHeaders(csrfToken, transactionId, detailsHash), body: JSON.stringify(authenticateBody) });
    exchanges.push(exchange(this.id, "esignet", "POST", authenticateUrl, authenticated, authenticateBody, { authenticated: authenticated.status < 300 }));

    const codeUrl = `${config.authBaseUrl}/authorization/auth-code`;
    const codeBody = { requestTime: new Date().toISOString(), request: { transactionId, acceptedClaims: [], permittedAuthorizeScopes: [] } };
    const authorization = await request(context, codeUrl, { method: "POST", headers: authHeaders(csrfToken, transactionId, detailsHash), body: JSON.stringify(codeBody) });
    const code = authorization.body?.response?.code;
    if (!code) throw new Error("eSignet did not return an authorization code");
    exchanges.push(exchange(this.id, "esignet", "POST", codeUrl, authorization, codeBody, { codeIssued: true }));

    const tokenUrl = `${config.authBaseUrl}/oauth/v2/token`;
    const clientAssertion = await createJwt(config.clientPrivateJwk, { sub: config.clientId, iss: config.clientId, aud: tokenUrl });
    const tokenBody = { code, client_id: config.clientId, redirect_uri: config.redirectUri, grant_type: "authorization_code", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: clientAssertion, code_verifier: codeVerifier };
    const token = await request(context, tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(tokenBody) });
    const accessToken = token.body?.access_token;
    const cNonce = token.body?.c_nonce;
    if (!accessToken || !cNonce) throw new Error("eSignet token response omitted access_token or c_nonce");
    context.state.set(STATE.accessToken, accessToken);
    exchanges.push(exchange(this.id, "esignet", "POST", tokenUrl, token, tokenBody, { token_type: token.body?.token_type, access_token: accessToken, c_nonce: cNonce }));

    const nonceUrl = `${config.certifyBaseUrl}/v1/certify/nonce`;
    const nonce = await request(context, nonceUrl, { method: "POST", headers: { authorization: `Bearer ${accessToken}` } });
    context.state.set(STATE.credentialNonce, nonce.body?.c_nonce ?? cNonce);
    exchanges.push(exchange(this.id, context.config.issuer, "POST", nonceUrl, nonce, {}, { c_nonce: nonce.body?.c_nonce ?? cNonce }));
    return { exchanges, summary: { authorized: true, nonceReceived: true } };
  }

  async requestCredential(context: DriverContext): Promise<DriverResult> {
    const config = await loadConfig(context);
    const holderKey = await Ed25519VerificationKey2020.generate();
    const holderPublicJwk = holderKey.toJwk({ publicKey: true });
    const holderPrivateJwk = holderKey.toJwk({ publicKey: true, privateKey: true });
    holderPrivateJwk.d = Buffer.from(holderPrivateJwk.d, "base64url").subarray(0, 32).toString("base64url");
    context.state.set(STATE.holderKey, holderKey);
    context.state.set(STATE.holderPublicJwk, holderPublicJwk);
    context.state.set(STATE.holderPrivateJwk, holderPrivateJwk);
    if (context.config.issuer === "mock_issuer") {
      const baseUrl = process.env.MOCK_ISSUER_BASE_URL;
      if (baseUrl) {
        const accessToken = stateValue<string>(context, STATE.accessToken);
        const nonce = stateValue<string>(context, STATE.credentialNonce);
        const proof = await createJwt(holderPrivateJwk, { aud: baseUrl, nonce, iss: config.clientId }, { alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: holderPublicJwk });
        const url = `${baseUrl}/credential`;
        const issued = await request(context, url, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ credential_configuration_id: config.credentialConfigurationId, proofs: { jwt: [proof] } }) });
        if (!issued.body?.credential) throw new Error("External mock issuer did not return a credential");
        context.state.set(STATE.credential, issued.body.credential);
        return { exchanges: [exchange(this.id, "mock_issuer", "POST", url, issued, { credential_configuration_id: config.credentialConfigurationId, proof }, { credentialReturned: true, format: issued.body.format })], summary: { credentialReceived: true, format: "dc+sd-jwt", source: "external_non_inji_mock", issuerRepresentation: issuerRepresentation(issued.body.credential) } };
      }
      const credential = await issueMockSdJwt(holderPublicJwk as JWK, context);
      context.state.set(STATE.credential, credential);
      return {
        exchanges: [exchange(this.id, "mock_issuer", "POST", "mock://issuer/credential", { status: 200, body: {}, durationMs: 0 }, { credential_configuration_id: config.credentialConfigurationId, proof_type: "jwt" }, { credentialReturned: true, format: "dc+sd-jwt" })],
        summary: { credentialReceived: true, format: "dc+sd-jwt", source: "local_non_inji_mock", issuerRepresentation: issuerRepresentation(credential) },
      };
    }
    const accessToken = stateValue<string>(context, STATE.accessToken);
    let credentialNonce = stateValue<string>(context, STATE.credentialNonce);
    const url = `${config.certifyBaseUrl}/v1/certify/issuance/credential`;
    const attempts: DriverExchange[] = [];
    let result: HttpResult;
    let refreshed = false;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const proof = await createJwt(holderPrivateJwk, { aud: config.certifyBaseUrl, nonce: credentialNonce, iss: config.clientId }, { alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: holderPublicJwk });
      const body = { credential_configuration_id: config.credentialConfigurationId, proofs: { jwt: [proof] } };
      result = await request(context, url, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(body), allowStatuses: [400] });
      attempts.push(exchange(this.id, context.config.issuer, "POST", url, result, { credential_configuration_id: config.credentialConfigurationId, proof_type: "jwt", proof }, {
        credentialReturned: Boolean(result.body?.credential || result.body?.credentials),
        error: result.body?.error,
        c_nonce: result.body?.c_nonce,
      }));
      if (result.body?.error !== "invalid_nonce" || !result.body?.c_nonce || attempt === 2) break;
      credentialNonce = result.body.c_nonce;
      refreshed = true;
    }
    const credential = result!.body?.credential ?? result!.body?.credentials?.[0]?.credential ?? result!.body?.credentials?.[0];
    if (!credential) throw new Error(`Issuer did not return a credential${result!.body?.error ? `: ${result!.body.error}` : ""}`);
    context.state.set(STATE.credential, credential);
    const sdJwt = typeof credential === "string" ? credential.split("~", 1)[0] : null;
    const header = sdJwt ? JSON.parse(Buffer.from(sdJwt.split(".")[0] ?? "", "base64url").toString("utf8")) : null;
    const claims = sdJwt ? decodeJwtPayload(sdJwt) : null;
    return { exchanges: attempts, summary: { credentialReceived: true, nonceRefreshRequired: refreshed, format: config.credentialFormat,
      ...(sdJwt ? { issuerRepresentation: issuerRepresentation(credential), signingAlgorithm: header?.alg } : {}),
    } };
  }

  async store(context: DriverContext): Promise<DriverResult> {
    stateValue(context, STATE.credential);
    return { summary: { storedForRun: true } };
  }

  async present(context: DriverContext): Promise<DriverResult> {
    if ((context.config.tamper === "expired" || context.config.tamper === "wrong_type") && (context.config.issuer !== "mock_issuer" || context.config.format !== "vc_sd_jwt")) throw new Error("Semantic faults require controlled signed SD-JWT issuance");
    const config = await loadConfig(context);
    const issuedCredential = stateValue<any>(context, STATE.credential);
    const requestClaims = stateValue<JsonObject>(context, STATE.requestClaims);
    const holderPublicJwk = stateValue<JsonObject>(context, STATE.holderPublicJwk);
    const holderPrivateJwk = stateValue<JWK>(context, STATE.holderPrivateJwk);
    const holderKey = stateValue<any>(context, STATE.holderKey);
    let vpToken: any;
    let holderKeyMatchesCredential = false;
    if (config.credentialFormat === "dc+sd-jwt") {
      const issuerClaims = decodeJwtPayload(issuedCredential.split("~", 1)[0]);
      let boundPublicJwk = issuerClaims.cnf?.jwk;
      if (!boundPublicJwk && issuerClaims.cnf?.kid?.startsWith("did:jwk:")) {
        boundPublicJwk = JSON.parse(Buffer.from(issuerClaims.cnf.kid.slice("did:jwk:".length).split("#", 1)[0], "base64url").toString("utf8"));
      }
      holderKeyMatchesCredential = boundPublicJwk?.kty === holderPublicJwk.kty && boundPublicJwk?.crv === holderPublicJwk.crv && boundPublicJwk?.x === holderPublicJwk.x;
      if (!holderKeyMatchesCredential) throw new Error("Issued SD-JWT is not bound to the holder key");
      const credential = context.config.tamper && !signedVariant(context.config)
        ? applyCredentialTamper(issuedCredential, context.config.tamper, context.config.format) as string
        : issuedCredential;
      const keyBindingJwt = await createJwt(holderPrivateJwk, { aud: requestClaims.client_id, nonce: presentationNonce(requestClaims.nonce, context.config.tamper), sd_hash: sha256Base64url(credential) }, { alg: "EdDSA", typ: "kb+jwt" });
      vpToken = `${credential}${keyBindingJwt}`;
    } else {
      const holderId = issuedCredential.credentialSubject?.id;
      if (!holderId?.startsWith("did:jwk:")) throw new Error("Issued credential is not bound to the holder did:jwk");
      const boundPublicJwk = JSON.parse(Buffer.from(holderId.slice("did:jwk:".length).split("#", 1)[0], "base64url").toString("utf8"));
      holderKeyMatchesCredential = boundPublicJwk.kty === holderPublicJwk.kty && boundPublicJwk.crv === holderPublicJwk.crv && boundPublicJwk.x === holderPublicJwk.x;
      if (!holderKeyMatchesCredential) throw new Error("Issued JSON-LD credential is not bound to the holder key");
      const controller = `did:key:${holderKey.fingerprint()}`;
      const presentationKey = await Ed25519VerificationKey2020.from({ ...holderKey.export({ publicKey: true, privateKey: true }), controller, id: `${controller}#${holderKey.fingerprint()}` });
      const credential = context.config.tamper
        ? applyCredentialTamper(issuedCredential, context.config.tamper, context.config.format)
        : issuedCredential;
      vpToken = await jsigs.sign({ "@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiablePresentation"], holder: holderId, verifiableCredential: [credential] }, {
        suite: new Ed25519Signature2020({ key: presentationKey, canonizeOptions: { safe: false } }),
        purpose: new AuthenticationProofPurpose({ challenge: presentationNonce(requestClaims.nonce, context.config.tamper), domain: requestClaims.client_id }),
        documentLoader: jsonld.documentLoaders.node(),
      });
    }
    const form = new URLSearchParams({ state: requestClaims.state, vp_token: JSON.stringify({ credential: [vpToken] }) });
    if (context.config.verifier === "mock_verifier") {
      const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
      if (baseUrl) {
        const result = await request(context, requestClaims.response_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form, allowStatuses: [400, 500, 502, 503] });
        const diagnostic = safeFailure(result.body?.failure, "direct_post");
        if (result.status === 400) context.state.set(STATE.verifySubmissionRejection, { status: 400, errorCode: "invalid_request", ...(diagnostic ? { failure: diagnostic, diagnosticsVersion: 1 } : {}) });
        return { exchanges: [exchange(this.id, "mock_verifier", "POST", requestClaims.response_uri, result, {
          format: config.credentialFormat, holderProofType: "kb+jwt", holderKeyMatchesCredential, tamper: context.config.tamper,
        }, { accepted: result.body?.accepted === true, ...(diagnostic ? { failure: diagnostic, diagnosticsVersion: 1 } : {}) })], summary: { holderKeyMatchesCredential, submissionAccepted: result.body?.accepted === true, ...(result.status >= 500 || result.status !== 400 && result.body?.accepted !== true ? { outcome: "error", error: "VERIFIER_SUBMISSION_FAILED" } : {}) } };
      }
      context.state.set(STATE.mockVpToken, vpToken);
      return { exchanges: [exchange(this.id, "mock_verifier", "POST", "mock://verifier/direct-post", { status: 200, body: {}, durationMs: 0 }, {
        format: config.credentialFormat, holderProofType: "kb+jwt", holderKeyMatchesCredential, tamper: context.config.tamper,
      }, { accepted: true })], summary: { holderKeyMatchesCredential, submissionAccepted: true } };
    }
    const result = await request(context, requestClaims.response_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form, allowStatuses: [400, 500, 502, 503] });
    const rejection = result.status === 400 ? { status: result.status, errorCode: submissionErrorCode(result.body) } : null;
    if (rejection) context.state.set(STATE.verifySubmissionRejection, rejection);
    return {
      exchanges: [exchange(this.id, context.config.verifier, "POST", requestClaims.response_uri, result, {
        format: config.credentialFormat,
        holderProofType: config.credentialFormat === "dc+sd-jwt" ? "kb+jwt" : "Ed25519Signature2020",
        holderKeyMatchesCredential,
        tamper: context.config.tamper,
      }, { accepted: result.status < 300, ...(rejection ? { errorCode: rejection.errorCode } : {}) })],
      summary: { holderKeyMatchesCredential, submissionAccepted: result.status < 300, ...(result.status >= 500 ? { outcome: "error", error: "VERIFIER_SUBMISSION_FAILED" } : {}) },
    };
  }
}


class MockVerifierDriver implements VerifierDriver {
  readonly id = "mock_verifier" as const;

  async createRequest(context: DriverContext): Promise<DriverResult> {
    if (context.config.format !== "vc_sd_jwt") throw new Error("Mock verifier currently supports SD-JWT VC only");
    const policy = mockPolicy(context.config);
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/vp-request`;
      const body = { format: "dc+sd-jwt", ...(policy.profile === "mock-sdjwt-flat-v1" ? policy : {}) };
      const result = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!result.body?.requestId || !result.body?.claims?.response_uri || (policy.profile === "mock-sdjwt-flat-v1" && (result.body?.policy?.profile !== policy.profile || JSON.stringify(result.body?.policy?.requiredClaims) !== JSON.stringify(policy.requiredClaims)))) throw new Error("External mock verifier omitted the requested policy or state");
      context.state.set(STATE.mockVerifierRequestId, result.body.requestId);
      context.state.set(STATE.requestClaims, result.body.claims);
      return { exchanges: [exchange("playground", this.id, "POST", url, result, body, { requestCreated: true, responseMode: "direct_post", protocolProfile: policy.profile })], summary: { signedRequestReceived: false, protocolProfile: policy.profile, source: "external_non_inji_mock" } };
    }
    const requestClaims = { client_id: "mock-verifier", nonce: randomUUID(), state: randomUUID(), response_uri: "mock://verifier/direct-post" };
    context.state.set(STATE.requestClaims, requestClaims);
    return { exchanges: [exchange("playground", this.id, "POST", "mock://verifier/vp-request", { status: 201, body: {}, durationMs: 0 }, { format: "dc+sd-jwt" }, { requestCreated: true, responseMode: "direct_post" })], summary: { signedRequestReceived: false, protocolProfile: policy.profile, source: "local_non_inji_mock" } };
  }

  async pollStatus(context: DriverContext): Promise<DriverResult> {
    if (context.state.has(STATE.verifySubmissionRejection)) return { summary: { status: "SUBMISSION_REJECTED", attempts: 0 } };
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/status/${encodeURIComponent(stateValue<string>(context, STATE.mockVerifierRequestId))}`;
      const exchanges: DriverExchange[] = [], deadline = Date.now() + positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
      do {
        const result = await request(context, url, { allowStatuses: [400, 404, 410, 500, 502, 503] });
        const status = ["PENDING", "VP_SUBMITTED", "ERROR", "EXPIRED"].includes(result.body?.status) ? result.body.status : "UNAVAILABLE";
        exchanges.push(exchange("playground", this.id, "GET", url, result, {}, { status }));
        if (result.status === 200 && status === "VP_SUBMITTED") return { exchanges, summary: { status, attempts: exchanges.length } };
        if (result.status !== 200 || status !== "PENDING") return { exchanges, summary: { outcome: "error", error: "VERIFIER_NOT_SUBMITTED" } };
        if (Date.now() >= deadline) break;
        await wait(Math.min(Math.max(positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 50), 1), Math.max(deadline - Date.now(), 0)));
      } while (Date.now() <= deadline);
      return { exchanges, summary: { outcome: "error", error: "VERIFIER_SUBMISSION_TIMEOUT" } };
    }
    if (!context.state.has(STATE.mockVpToken)) throw new Error("Presentation was not submitted");
    return { exchanges: [exchange("playground", this.id, "GET", "mock://verifier/status", { status: 200, body: {}, durationMs: 0 }, {}, { status: "VP_SUBMITTED" })], summary: { status: "VP_SUBMITTED", attempts: 1 } };
  }

  async getResult(context: DriverContext): Promise<DriverResult> {
    const policy = mockPolicy(context.config);
    const rejection = context.state.get(STATE.verifySubmissionRejection) as JsonObject | undefined;
    if (rejection) return { summary: { outcome: "invalid", diagnosticsVersion: rejection.diagnosticsVersion, failure: safeFailure(rejection.failure, "direct_post"), resultSource: "direct_post_rejection", protocolProfile: policy.profile } };
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/result/${encodeURIComponent(stateValue<string>(context, STATE.mockVerifierRequestId))}`;
      const exchanges: DriverExchange[] = [], deadline = Date.now() + positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
      do {
        const result = await request(context, url, { allowStatuses: [202, 400, 404, 409, 410, 500, 502, 503] });
        const summary = result.status === 202 ? { status: "VERIFYING" } : result.status === 200 ? mockResult(result.body) : { outcome: "error", error: "VERIFIER_RESULT_UNAVAILABLE" };
        exchanges.push(exchange("playground", this.id, "GET", url, result, {}, summary));
        if (result.status !== 202) return { exchanges, summary: { ...summary, protocolProfile: policy.profile } };
        if (Date.now() >= deadline) break;
        await wait(Math.min(Math.max(positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 50), 1), Math.max(deadline - Date.now(), 0)));
      } while (Date.now() <= deadline);
      return { exchanges, summary: { outcome: "error", error: "VERIFIER_RESULT_TIMEOUT", protocolProfile: policy.profile } };
    }
    const result = await verifyPresentation(stateValue<string>(context, STATE.mockVpToken), stateValue<{ client_id: string; nonce: string }>(context, STATE.requestClaims), policy);
    return { exchanges: [exchange("playground", this.id, "POST", "mock://verifier/vp-results", { status: 200, body: {}, durationMs: 0 }, { includeClaims: false }, result)], summary: { ...result, protocolProfile: policy.profile } };
  }
}

class CollabVerifierDriver implements VerifierDriver {
  readonly id = "inji_verify" as const;

  async createRequest(context: DriverContext): Promise<DriverResult> {
    const config = await loadConfig(context);
    const url = `${config.verifyBaseUrl}/v2/vp-request`;
    const defaultLdpTypes = ["https://www.w3.org/ns/credentials#VerifiableCredential", "https://inji.github.io/inji-config/contexts/farmer-context.json#FarmerCredential"];
    let ldpTypes = defaultLdpTypes;
    if (context.config.wallet === "inji_web_assisted" && process.env.VERIFY_LDP_TYPE_VALUES_JSON) {
      let configured: unknown;
      try { configured = JSON.parse(process.env.VERIFY_LDP_TYPE_VALUES_JSON); } catch { throw new Error("VERIFY_LDP_TYPE_VALUES_INVALID"); }
      if (!Array.isArray(configured) || configured.length < 1 || configured.length > 8 ||
        !configured.every((value) => typeof value === "string" && value.length > 0 && value.length <= 512 && /^https:\/\//.test(value))) {
        throw new Error("VERIFY_LDP_TYPE_VALUES_INVALID");
      }
      ldpTypes = configured;
    }
    const body = {
      clientId: process.env.VERIFY_CLIENT_ID ?? "decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify",
      nonce: `playground-${config.credentialFormat === "dc+sd-jwt" ? "sdjwt" : "jsonld"}-${Date.now()}`,
      dcqlQuery: { credentials: [{ id: "credential", format: config.credentialFormat, meta: config.credentialFormat === "dc+sd-jwt"
        ? { vct_values: [config.credentialConfigurationId] }
        : { type_values: [ldpTypes] } }] },
      responseCodeValidationRequired: false,
    };
    const created = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!created.body?.requestUri || !created.body?.transactionId || !created.body?.requestId) {
      throw new Error("Inji Verify did not return a request URI, request id, and transaction id");
    }
    const requestObject = await request(context, created.body.requestUri, { headers: { accept: "application/oauth-authz-req+jwt" } });
    const requestClaims = decodeJwtPayload(requestObject.body);
    context.state.set(STATE.verifyTransactionId, created.body.transactionId);
    context.state.set("assisted.presentationUrl", `openid4vp://authorize?request_uri=${encodeURIComponent(created.body.requestUri)}`);
    context.state.set(STATE.verifyRequestId, created.body.requestId);
    context.state.set(STATE.requestClaims, requestClaims);
    return {
      exchanges: [
        exchange("playground", this.id, "POST", url, created, body, { requestUriIssued: true, requestIdIssued: true, transactionIdIssued: true }),
        exchange(context.config.wallet, this.id, "GET", created.body.requestUri, requestObject, { accept: "application/oauth-authz-req+jwt" }, { signedRequestReceived: true, responseMode: requestClaims.response_mode }),
      ],
      summary: { signedRequestReceived: true, queryLanguage: "DCQL" },
    };
  }

  async pollStatus(context: DriverContext): Promise<DriverResult> {
    const rejection = context.state.get(STATE.verifySubmissionRejection) as { status: number; errorCode: string } | undefined;
    if (rejection) {
      return { summary: { status: "SUBMISSION_REJECTED", submissionHttpStatus: rejection.status, errorCode: rejection.errorCode, attempts: 0 } };
    }
    const config = await loadConfig(context);
    const requestId = stateValue<string>(context, STATE.verifyRequestId);
    const intervalMs = positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 1_000);
    const timeoutMs = positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
    const url = `${config.verifyBaseUrl}/vp-request/${encodeURIComponent(requestId)}/status`;
    const exchanges: DriverExchange[] = [];
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const result = await request(context, url, { headers: { accept: "application/json" } });
      const status = result.body?.status ?? result.body?.response?.status;
      exchanges.push(exchange("playground", this.id, "GET", url, result, {}, { status }));
      if (status === "VP_SUBMITTED") {
        return { exchanges, summary: { status, attempts: exchanges.length } };
      }
      if (["EXPIRED", "CANCELLED", "ERROR", "FAILED"].includes(status)) {
        throw new Error(`Inji Verify presentation reached terminal status ${status}`);
      }
      if (Date.now() - startedAt >= timeoutMs) break;
      await wait(intervalMs);
    }

    throw new Error(`Timed out waiting for Inji Verify presentation status after ${timeoutMs}ms`);
  }

  async getResult(context: DriverContext): Promise<DriverResult> {
    const rejection = context.state.get(STATE.verifySubmissionRejection) as { status: number; errorCode: string } | undefined;
    if (rejection) {
      return { summary: { outcome: "invalid", failureDetail: rejection.errorCode, submissionHttpStatus: rejection.status, resultSource: "direct_post_rejection", protocolProfile: "collab-dcql" } };
    }
    const config = await loadConfig(context);
    const transactionId = stateValue<string>(context, STATE.verifyTransactionId);
    const url = `${config.verifyBaseUrl}/v2/vp-results/${encodeURIComponent(transactionId)}`;
    const body = { includeClaims: false, skipStatusChecks: true };
    const result = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), allowStatuses: [400, 404, 500] });
    const credentialResult = result.body?.credentialResults?.[0];
    if (result.status !== 200 || typeof result.body?.allChecksSuccessful !== "boolean") {
      const summary = { outcome: "error", error: "VERIFIER_RESULT_UNAVAILABLE", protocolProfile: "collab-dcql" };
      return { exchanges: [exchange("playground", this.id, "POST", url, result, { includeClaims: false }, summary)], summary };
    }
    const valid = result.body.allChecksSuccessful === true;
    return {
      exchanges: [exchange("playground", this.id, "POST", url, result, body, {
        allChecksSuccessful: result.body?.allChecksSuccessful,
        credentialChecksSuccessful: credentialResult?.allChecksSuccessful,
        credentialProofValid: credentialResult?.schemaAndSignatureCheck?.valid,
        holderProofValid: credentialResult?.holderProofCheck?.valid,
        ...(valid ? {} : { errorCode: submissionErrorCode(result.body) }),
      })],
      summary: { outcome: valid ? "valid" : "invalid", protocolProfile: "collab-dcql", allChecksSuccessful: result.body?.allChecksSuccessful === true,
        ...(valid ? {} : { failureDetail: credentialResult?.schemaAndSignatureCheck?.valid === false
          ? "Verifier rejected the credential schema or issuer signature"
          : credentialResult?.holderProofCheck?.valid === false
            ? "Verifier rejected the holder proof"
            : "Verifier returned an invalid result" }),
      },
    };
  }
}

export function createCollabDrivers(config?: RunConfig): DriverSet {
  return { issuer: config?.issuer === "mock_issuer" ? new MockIssuerDriver() : new CollabIssuerDriver(), wallet: new CollabWalletDriver(), verifier: config?.verifier === "mock_verifier" ? new MockVerifierDriver() : new CollabVerifierDriver() };
}
