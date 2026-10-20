import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { Ed25519Signature2020 } from "@digitalbazaar/ed25519-signature-2020";
import { Ed25519VerificationKey2020 } from "@digitalbazaar/ed25519-verification-key-2020";
import jsonld from "jsonld";
import jsigs from "jsonld-signatures";
import { importJWK, SignJWT } from "jose";

const { AuthenticationProofPurpose } = jsigs.purposes;

const AUTH = process.env.ESIGNET_BASE_URL ?? "https://esignet-mock.collab.mosip.net/v1/esignet";
const CERTIFY = process.env.CERTIFY_BASE_URL
  ?? process.env.FARMER_CERTIFY_BASE_URL
  ?? "https://injicertify-farmer.collab.mosip.net";
const VERIFY = process.env.VERIFY_BASE_URL ?? "https://injiverify.collab.mosip.net/v1/verify";
const POSTMAN_ENV_PATH = process.env.OFFICIAL_POSTMAN_ENV_PATH;
const CREDENTIAL_CONFIGURATION_ID = process.env.CREDENTIAL_CONFIGURATION_ID ?? "FarmerCredential_VCDM2.0";
const CREDENTIAL_SCOPE = process.env.CREDENTIAL_SCOPE ?? "mock_identity_vc_ldp";
const CREDENTIAL_FORMAT = process.env.CREDENTIAL_FORMAT ?? "ldp_vc";
const IS_SD_JWT = CREDENTIAL_FORMAT === "dc+sd-jwt";
const MOCK_OTP = process.env.MOCK_OTP;

if (!POSTMAN_ENV_PATH) {
  throw new Error("Set OFFICIAL_POSTMAN_ENV_PATH to the official inji-certify mock environment JSON");
}
if (!MOCK_OTP) {
  throw new Error("Set MOCK_OTP to the official public Collab mock OTP");
}

const environment = JSON.parse(await readFile(POSTMAN_ENV_PATH, "utf8"));
const values = Object.fromEntries(environment.values.map(({ key, value }) => [key, value]));
const clientId = values.clientId;
const redirectUri = values.redirectionUrl;
const individualId = values.individual_id;
const clientPrivateJwk = JSON.parse(values.privateKey_jwk);

if (!clientId || !redirectUri || !individualId || !clientPrivateJwk.d) {
  throw new Error("Official environment is missing the test client, identity, redirect URI, or private JWK");
}

let cookie = "";

function sha256Base64url(value) {
  return createHash("sha256").update(value).digest("base64url");
}

async function createJwt(privateJwk, payload, header = {}) {
  const now = Math.floor(Date.now() / 1000);
  const algorithm = header.alg ?? "RS256";
  const protectedHeader = {
    typ: "JWT",
    alg: algorithm,
    ...(privateJwk.kid ? { kid: privateJwk.kid } : {}),
    ...header,
  };
  const key = await importJWK(privateJwk, algorithm);
  return new SignJWT(payload)
    .setProtectedHeader(protectedHeader)
    .setIssuedAt(now - 5)
    .setNotBefore(now - 5)
    .setExpirationTime(now + 600)
    .setJti(randomUUID())
    .sign(key);
}

async function request(url, options = {}) {
  const { allowStatuses = [], ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(url, { ...fetchOptions, headers, signal: AbortSignal.timeout(20_000) });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length) cookie = setCookies.map((item) => item.split(";", 1)[0]).join("; ");
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok && !allowStatuses.includes(response.status)) {
    const safeError = body && typeof body === "object"
      ? {
          error: body.error,
          errorCode: body.errorCode,
          error_description: body.error_description,
          errorMessage: body.errorMessage,
        }
      : {};
    throw new Error(`${fetchOptions.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(safeError)}`);
  }
  return { status: response.status, body };
}

function authHeaders(csrfToken, oauthDetailsKey, oauthDetailsHash) {
  return {
    "content-type": "application/json",
    "x-xsrf-token": csrfToken,
    ...(oauthDetailsKey ? { "oauth-details-key": oauthDetailsKey } : {}),
    ...(oauthDetailsHash ? { "oauth-details-hash": oauthDetailsHash } : {}),
  };
}

const csrf = await request(`${AUTH}/csrf/token`);
const csrfToken = cookie
  .split("; ")
  .find((item) => item.startsWith("XSRF-TOKEN="))
  ?.slice("XSRF-TOKEN=".length);
if (!csrfToken) throw new Error("eSignet did not set an XSRF-TOKEN cookie");

const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = sha256Base64url(codeVerifier);
const oauthDetails = await request(`${AUTH}/authorization/v2/oauth-details`, {
  method: "POST",
  headers: authHeaders(csrfToken),
  body: JSON.stringify({
    requestTime: new Date().toISOString(),
    request: {
      clientId,
      scope: CREDENTIAL_SCOPE,
      responseType: "code",
      redirectUri,
      display: "popup",
      prompt: "login",
      acrValues: "mosip:idp:acr:generated-code",
      nonce: randomBytes(18).toString("base64url"),
      state: randomBytes(12).toString("base64url"),
      claimsLocales: "en",
      codeChallenge,
      codeChallengeMethod: "S256",
    },
  }),
});

const oauthDetailsValue = oauthDetails.body.response;
const transactionId = oauthDetailsValue?.transactionId;
if (!transactionId) throw new Error("eSignet did not return a transaction id");
const oauthDetailsHash = sha256Base64url(JSON.stringify(oauthDetailsValue));

await request(`${AUTH}/authorization/send-otp`, {
  method: "POST",
  headers: authHeaders(csrfToken, transactionId, oauthDetailsHash),
  body: JSON.stringify({
    requestTime: new Date().toISOString(),
    request: {
      transactionId,
      individualId,
      otpChannels: ["email", "phone"],
      captchaToken: "dummy",
    },
  }),
});

await request(`${AUTH}/authorization/v3/authenticate`, {
  method: "POST",
  headers: authHeaders(csrfToken, transactionId, oauthDetailsHash),
  body: JSON.stringify({
    requestTime: new Date().toISOString(),
    request: {
      transactionId,
      individualId,
      challengeList: [{ authFactorType: "OTP", challenge: MOCK_OTP, format: "alpha-numeric" }],
    },
  }),
});

const authorization = await request(`${AUTH}/authorization/auth-code`, {
  method: "POST",
  headers: authHeaders(csrfToken, transactionId, oauthDetailsHash),
  body: JSON.stringify({
    requestTime: new Date().toISOString(),
    request: { transactionId, acceptedClaims: [], permittedAuthorizeScopes: [] },
  }),
});
const code = authorization.body.response?.code;
if (!code) throw new Error("eSignet did not return an authorization code");

const tokenAudience = `${AUTH}/oauth/v2/token`;
const clientAssertion = await createJwt(clientPrivateJwk, { sub: clientId, iss: clientId, aud: tokenAudience });
const tokenForm = new URLSearchParams({
  code,
  client_id: clientId,
  redirect_uri: redirectUri,
  grant_type: "authorization_code",
  client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  client_assertion: clientAssertion,
  code_verifier: codeVerifier,
});
const token = await request(`${AUTH}/oauth/v2/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: tokenForm,
});
const accessToken = token.body.access_token;
const cNonce = token.body.c_nonce;
if (!accessToken || !cNonce) throw new Error("eSignet token response omitted access_token or c_nonce");
const accessTokenClaims = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
const nonceResponse = await request(`${CERTIFY}/v1/certify/nonce`, {
  method: "POST",
  headers: { authorization: `Bearer ${accessToken}` },
});
const credentialNonce = nonceResponse.body?.c_nonce ?? cNonce;

const holderKey = await Ed25519VerificationKey2020.generate();
const holderPublicJwk = holderKey.toJwk({ publicKey: true });
const holderPrivateJwk = holderKey.toJwk({ publicKey: true, privateKey: true });
// The suite keeps the 32-byte seed plus public key; RFC 8037 JWK uses only the seed.
holderPrivateJwk.d = Buffer.from(holderPrivateJwk.d, "base64url").subarray(0, 32).toString("base64url");
async function createCredentialProof(nonce) {
  return createJwt(holderPrivateJwk, {
    aud: CERTIFY,
    nonce,
    iss: clientId,
  }, {
    alg: "EdDSA",
    typ: "openid4vci-proof+jwt",
    jwk: holderPublicJwk,
  });
}

async function requestCredential(nonce) {
  return request(`${CERTIFY}/v1/certify/issuance/credential`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      credential_configuration_id: CREDENTIAL_CONFIGURATION_ID,
      proofs: { jwt: [await createCredentialProof(nonce)] },
    }),
    allowStatuses: [400],
  });
}

const initialCredential = await requestCredential(credentialNonce);
const refreshedNonce = initialCredential.body?.error === "invalid_nonce"
  ? initialCredential.body?.c_nonce
  : null;
const credential = refreshedNonce ? await requestCredential(refreshedNonce) : initialCredential;
const issuedCredential = credential.body?.credential
  ?? credential.body?.credentials?.[0]?.credential
  ?? credential.body?.credentials?.[0];

let verification = null;
if (issuedCredential) {
  const verifyRequest = await request(`${VERIFY}/v2/vp-request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: "decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify",
      nonce: `playground-${IS_SD_JWT ? "sdjwt" : "jsonld"}-${Date.now()}`,
      dcqlQuery: {
        credentials: [{
          id: "credential",
          format: CREDENTIAL_FORMAT,
          meta: IS_SD_JWT
            ? { vct_values: [CREDENTIAL_CONFIGURATION_ID] }
            : {
                type_values: [[
                  "https://www.w3.org/ns/credentials#VerifiableCredential",
                  "https://inji.github.io/inji-config/contexts/farmer-context.json#FarmerCredential",
                ]],
              },
        }],
      },
      responseCodeValidationRequired: false,
    }),
  });
  const requestObject = await request(verifyRequest.body.requestUri, {
    headers: { accept: "application/oauth-authz-req+jwt" },
  });
  const requestClaims = JSON.parse(Buffer.from(requestObject.body.split(".")[1], "base64url").toString("utf8"));
  let holderKeyMatchesCredential;
  let vpToken;
  if (IS_SD_JWT) {
    const issuerJwt = issuedCredential.split("~", 1)[0];
    const issuerClaims = JSON.parse(Buffer.from(issuerJwt.split(".")[1], "base64url").toString("utf8"));
    let boundPublicJwk = issuerClaims.cnf?.jwk;
    if (!boundPublicJwk && issuerClaims.cnf?.kid?.startsWith("did:jwk:")) {
      boundPublicJwk = JSON.parse(Buffer.from(
        issuerClaims.cnf.kid.slice("did:jwk:".length).split("#", 1)[0],
        "base64url",
      ).toString("utf8"));
    }
    holderKeyMatchesCredential = boundPublicJwk?.kty === holderPublicJwk.kty
      && boundPublicJwk?.crv === holderPublicJwk.crv
      && boundPublicJwk?.x === holderPublicJwk.x;
    if (!holderKeyMatchesCredential) {
      throw new Error("Issued SD-JWT is not bound to the holder key");
    }
    const sdHash = createHash("sha256").update(issuedCredential).digest("base64url");
    const keyBindingJwt = await createJwt(holderPrivateJwk, {
      aud: requestClaims.client_id,
      nonce: requestClaims.nonce,
      sd_hash: sdHash,
    }, { alg: "EdDSA", typ: "kb+jwt" });
    vpToken = `${issuedCredential}${keyBindingJwt}`;
  } else {
    const holderId = issuedCredential.credentialSubject?.id;
    if (!holderId?.startsWith("did:jwk:")) {
      throw new Error("Issued credential is not bound to the holder did:jwk");
    }
    const boundPublicJwk = JSON.parse(Buffer.from(
      holderId.slice("did:jwk:".length).split("#", 1)[0],
      "base64url",
    ).toString("utf8"));
    holderKeyMatchesCredential = boundPublicJwk.kty === holderPublicJwk.kty
      && boundPublicJwk.crv === holderPublicJwk.crv
      && boundPublicJwk.x === holderPublicJwk.x;
    if (!holderKeyMatchesCredential) {
      throw new Error("Issued JSON-LD credential is not bound to the holder key");
    }
    const presentationController = `did:key:${holderKey.fingerprint()}`;
    const presentationKey = await Ed25519VerificationKey2020.from({
      ...holderKey.export({ publicKey: true, privateKey: true }),
      controller: presentationController,
      id: `${presentationController}#${holderKey.fingerprint()}`,
    });
    const unsignedVp = {
      "@context": ["https://www.w3.org/ns/credentials/v2"],
      type: ["VerifiablePresentation"],
      holder: holderId,
      verifiableCredential: [issuedCredential],
    };
    vpToken = await jsigs.sign(unsignedVp, {
      // The live Farmer VC currently contains a rendering hint that its JSON-LD
      // context does not define. MOSIP's verifier ignores that non-RDF property.
      suite: new Ed25519Signature2020({ key: presentationKey, canonizeOptions: { safe: false } }),
      purpose: new AuthenticationProofPurpose({
        challenge: requestClaims.nonce,
        domain: requestClaims.client_id,
      }),
      documentLoader: jsonld.documentLoaders.node(),
    });
  }
  const submissionForm = new URLSearchParams({
    state: requestClaims.state,
    vp_token: JSON.stringify({ credential: [vpToken] }),
  });
  const submission = await request(requestClaims.response_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: submissionForm,
    allowStatuses: [400],
  });
  const result = await request(`${VERIFY}/v2/vp-results/${encodeURIComponent(verifyRequest.body.transactionId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ includeClaims: false, skipStatusChecks: true }),
    allowStatuses: [400, 404, 500],
  });
  const credentialResult = result.body?.credentialResults?.[0];
  verification = {
    createStatus: verifyRequest.status,
    requestObjectStatus: requestObject.status,
    holderKeyMatchesCredential,
    holderProofType: IS_SD_JWT ? "kb+jwt" : vpToken.proof?.type,
    holderProofChallengeMatches: IS_SD_JWT || vpToken.proof?.challenge === requestClaims.nonce,
    holderProofDomainMatches: IS_SD_JWT || vpToken.proof?.domain === requestClaims.client_id,
    submissionStatus: submission.status,
    submissionErrorCode: submission.body?.errorCode,
    submissionError: submission.body?.error,
    submissionErrorDescription: submission.body?.error_description ?? submission.body?.errorMessage,
    resultStatus: result.status,
    allChecksSuccessful: result.body?.allChecksSuccessful,
    credentialChecksSuccessful: credentialResult?.allChecksSuccessful,
    credentialProofValid: credentialResult?.schemaAndSignatureCheck?.valid,
    holderProofValid: credentialResult?.holderProofCheck?.valid,
    resultKeys: result.body && typeof result.body === "object" ? Object.keys(result.body) : [],
    resultErrorCode: result.body?.errorCode,
    resultErrorMessage: result.body?.errorMessage,
  };
}

console.log(JSON.stringify({
  csrfStatus: csrf.status,
  oauthDetailsStatus: oauthDetails.status,
  tokenStatus: token.status,
  tokenIncludesNonce: Boolean(cNonce),
  tokenClaimNonceMatchesResponse: accessTokenClaims.c_nonce === cNonce,
  tokenIssuerConfigured: Boolean(accessTokenClaims.iss),
  tokenAudienceConfigured: Boolean(accessTokenClaims.aud),
  nonceEndpointStatus: nonceResponse.status,
  nonceEndpointMatchesTokenNonce: credentialNonce === cNonce,
  credentialStatus: credential.status,
  nonceRefreshRequired: Boolean(refreshedNonce),
  credentialReturned: Boolean(credential.body?.credential || credential.body?.credentials),
  credentialError: credential.body?.error,
  verification,
}, null, 2));
