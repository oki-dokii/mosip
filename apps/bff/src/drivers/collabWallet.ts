import { safeContextLoader } from "./outbound.js";
import { randomBytes } from "node:crypto";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Ed25519VerificationKey2020 } from "@digitalbazaar/ed25519-verification-key-2020";
import { type JWK } from "jose";
import jsigs from "jsonld-signatures";
import type { DriverContext, DriverExchange, DriverResult, WalletDriver } from "./types.js";
import { applyCredentialTamper, presentationNonce } from "../tamper/index.js";
import { safeFailure, signedVariant } from "../protocol.js";
import { type JsonObject, type HttpResult, STATE, stateValue, sha256Base64url, submissionErrorCode, decodeJwtPayload, createJwt, loadConfig, issueMockSdJwt, issuerRepresentation, request, exchange, authHeaders } from "./collabCommon.js";

const { AuthenticationProofPurpose } = jsigs.purposes;

export class CollabWalletDriver implements WalletDriver {
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
    if (sdJwt) decodeJwtPayload(sdJwt);
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
        documentLoader: safeContextLoader,
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
