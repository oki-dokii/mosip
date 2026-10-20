import { generateKeyPairSync, sign } from "node:crypto";

const CERTIFY = process.env.CERTIFY_BASE_URL ?? "https://injicertify-mock.collab.mosip.net";
const VERIFY = process.env.VERIFY_BASE_URL ?? "https://injiverify.collab.mosip.net/v1/verify";
const MIMOTO = process.env.MIMOTO_BASE_URL ?? "https://injiweb.collab.mosip.net/v1/mimoto";

const syntheticClaims = {
  UIN: "9999999999",
  email: "playground@example.invalid",
  phone: "0000000000",
  vcVer: "1.0",
  gender: "Unspecified",
  region: "Test Region",
  fullName: "Synthetic Playground User",
  postalCode: "000000",
  dateOfBirth: "2000-01-01",
  addressLine1: "Synthetic Test Address",
};

async function request(url, options = {}) {
  const { allowStatuses = [], ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  if (!response.ok && !allowStatuses.includes(response.status)) {
    throw new Error(`${fetchOptions.method ?? "GET"} ${url} returned ${response.status}: ${body.slice(0, 500)}`);
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createProofJwt(audience, nonce) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const header = { alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, nonce, iat: now, exp: now + 300 };
  const unsigned = `${base64url(header)}.${base64url(payload)}`;
  const signature = sign(null, Buffer.from(unsigned), privateKey).toString("base64url");
  return `${unsigned}.${signature}`;
}

function offerIdFrom(uri) {
  const parsed = new URL(uri);
  const value = parsed.searchParams.get("credential_offer_uri");
  if (!value) throw new Error("Credential offer URI did not contain credential_offer_uri");
  return value.split("/").at(-1);
}

async function runCertifySpike() {
  const metadata = await request(`${CERTIFY}/.well-known/openid-credential-issuer`);
  const configurationId = "MockVerifiableCredential_SD_JWT";
  const configuration = metadata.body.credential_configurations_supported?.[configurationId];
  if (!configuration) throw new Error(`${configurationId} is not advertised by Certify`);

  const offerStart = await request(`${CERTIFY}/v1/certify/pre-authorized-data`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      credential_configuration_id: configurationId,
      claims: syntheticClaims,
      expires_in: 300,
    }),
  });

  const offerId = offerIdFrom(offerStart.body.credential_offer_uri);
  const offer = await request(`${CERTIFY}/v1/certify/credential-offer-data/${offerId}`);
  const preAuthorizedCode = offer.body.grants?.["urn:ietf:params:oauth:grant-type:pre-authorized_code"]?.["pre-authorized_code"];
  if (!preAuthorizedCode) throw new Error("Credential offer did not contain a pre-authorized code");

  const tokenForm = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code",
    "pre-authorized_code": preAuthorizedCode,
  });
  const token = await request(`${CERTIFY}/v1/certify/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenForm,
  });
  if (!token.body.access_token) throw new Error("Token response did not contain an access token");

  const nonce = await request(metadata.body.nonce_endpoint, { method: "POST" });
  const proofJwt = createProofJwt(metadata.body.credential_issuer, nonce.body.c_nonce);
  const credential = await request(metadata.body.credential_endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.body.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      credential_configuration_id: configurationId,
      proofs: { jwt: [proofJwt] },
    }),
    allowStatuses: [401],
  });

  return {
    metadataStatus: metadata.status,
    configurationId,
    format: configuration.format,
    offerStatus: offer.status,
    tokenStatus: token.status,
    tokenResponseIncludesNonce: Boolean(token.body.c_nonce),
    nonceStatus: nonce.status,
    credentialStatus: credential.status,
    credentialReturned: Boolean(credential.body?.credential || credential.body?.credentials),
    credentialFailure: credential.status === 401 ? "fresh_pre_authorized_token_rejected" : null,
  };
}

async function runVerifySpike() {
  const openapi = await request(`${VERIFY}/v3/api-docs`);
  const v2Available = Boolean(openapi.body.paths?.["/v2/vp-request"]);
  if (!v2Available) throw new Error("Verify does not advertise POST /v2/vp-request");

  const created = await request(`${VERIFY}/v2/vp-request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: "decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify",
      nonce: `playground-${Date.now()}`,
      dcqlQuery: {
        credentials: [
          {
            id: "mock_identity",
            format: "dc+sd-jwt",
            meta: { vct_values: ["MockVerifiableCredential_SD_JWT"] },
          },
        ],
      },
      responseCodeValidationRequired: false,
    }),
  });

  const requestObject = await request(created.body.requestUri, {
    headers: { accept: "application/oauth-authz-req+jwt" },
  });

  return {
    openapiStatus: openapi.status,
    apiGeneration: "v2 + DCQL",
    createStatus: created.status,
    requestIdPrefix: String(created.body.requestId).split("_")[0],
    requestObjectStatus: requestObject.status,
    requestObjectIsJwt: typeof requestObject.body === "string" && requestObject.body.split(".").length === 3,
    statusEndpointUsesLongPolling: true,
  };
}

async function runMimotoSpike() {
  const openapi = await request(`${MIMOTO}/v3/api-docs`);
  const catalog = await request(`${MIMOTO}/issuers`);
  const issuers = catalog.body.response?.issuers ?? [];
  const issuerIds = issuers.map((issuer) => issuer.issuer_id);
  const candidateId = issuerIds.includes("Farmer") ? "Farmer" : issuerIds[0];
  const candidate = candidateId
    ? await request(`${MIMOTO}/issuers/${encodeURIComponent(candidateId)}/configuration`)
    : null;

  return {
    openapiStatus: openapi.status,
    catalogStatus: catalog.status,
    issuerCount: issuerIds.length,
    issuerIds,
    mockCertifyOnboarded: issuers.some(
      (issuer) => issuer.credential_issuer_host === CERTIFY || issuer.issuer_id === "Mock",
    ),
    candidateId,
    candidateFormats: (candidate?.body.response?.credentials_supported ?? []).map((item) => item.name),
    candidateGrantTypes: candidate?.body.response?.grant_types_supported ?? [],
  };
}

const result = {
  ranAt: new Date().toISOString(),
  certify: await runCertifySpike(),
  mimoto: await runMimotoSpike(),
  verify: await runVerifySpike(),
};

console.log(JSON.stringify(result, null, 2));
