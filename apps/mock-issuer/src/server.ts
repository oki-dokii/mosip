import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exportJWK, importJWK, jwtVerify, SignJWT, type JWK } from "jose";

const configurationId = "MockVerifiableCredential_SD_JWT";
const port = Number(process.env.MOCK_ISSUER_PORT ?? 4101);
const publicBaseUrl = process.env.MOCK_ISSUER_PUBLIC_URL ?? `http://127.0.0.1:${port}`;
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicJwk = await exportJWK(publicKey);
const issuerDid = `did:jwk:${Buffer.from(JSON.stringify(publicJwk)).toString("base64url")}`;
const grants = new Map<string, { nonce: string; expiresAt: number }>();

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 32_768) throw new Error("Request too large");
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return request.headers["content-type"]?.includes("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(text))
    : JSON.parse(text || "{}");
}

export const mockIssuerServer = createHttpServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/.well-known/openid-credential-issuer") {
      return send(response, 200, { credential_issuer: publicBaseUrl, token_endpoint: `${publicBaseUrl}/token`, credential_endpoint: `${publicBaseUrl}/credential`, credential_configurations_supported: { [configurationId]: { format: "dc+sd-jwt", vct: configurationId, credential_signing_alg_values_supported: ["EdDSA"], proof_types_supported: { jwt: { proof_signing_alg_values_supported: ["EdDSA"] } } } } });
    }
    if (request.method === "POST" && request.url === "/token") {
      const input = await body(request);
      if (input.grant_type !== "urn:ietf:params:oauth:grant-type:pre-authorized_code" || input["pre-authorized_code"] !== "public-test-code") return send(response, 400, { error: "invalid_grant" });
      const accessToken = randomUUID();
      const nonce = randomUUID();
      grants.set(accessToken, { nonce, expiresAt: Date.now() + 60_000 });
      return send(response, 200, { access_token: accessToken, token_type: "Bearer", expires_in: 60, c_nonce: nonce });
    }
    if (request.method === "POST" && request.url === "/credential") {
      const accessToken = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
      const grant = grants.get(accessToken);
      grants.delete(accessToken);
      if (!grant || grant.expiresAt < Date.now()) return send(response, 401, { error: "invalid_token" });
      const input = await body(request);
      const proof = input.proofs?.jwt?.[0];
      if (input.credential_configuration_id !== configurationId || typeof proof !== "string") return send(response, 400, { error: "invalid_credential_request" });
      const header = JSON.parse(Buffer.from(proof.split(".")[0] ?? "", "base64url").toString("utf8"));
      const holderJwk = header.jwk as JWK | undefined;
      if (!holderJwk) return send(response, 400, { error: "invalid_proof" });
      await jwtVerify(proof, await importJWK(holderJwk, "EdDSA"), { audience: publicBaseUrl, algorithms: ["EdDSA"] });
      const proofClaims = JSON.parse(Buffer.from(proof.split(".")[1] ?? "", "base64url").toString("utf8"));
      if (proofClaims.nonce !== grant.nonce) return send(response, 400, { error: "invalid_nonce" });
      const disclosure = Buffer.from(JSON.stringify([randomBytes(16).toString("base64url"), "given_name", "Test"])).toString("base64url");
      const digest = createHash("sha256").update(disclosure).digest("base64url");
      const now = Math.floor(Date.now() / 1000);
      const jwt = await new SignJWT({ iss: issuerDid, vct: configurationId, cnf: { jwk: holderJwk }, _sd_alg: "sha-256", _sd: [digest], iat: now, nbf: now - 5, exp: now + 3600 })
        .setProtectedHeader({ alg: "EdDSA", typ: "vc+sd-jwt", kid: `${issuerDid}#0` }).sign(privateKey);
      return send(response, 200, { credential: `${jwt}~${disclosure}~`, format: "dc+sd-jwt" });
    }
    send(response, 404, { error: "not_found" });
  } catch {
    send(response, 400, { error: "invalid_request" });
  }
});

if (process.env.MOCK_ISSUER_NO_LISTEN !== "1") {
  mockIssuerServer.listen(port, "127.0.0.1", () => console.log(`Mock issuer listening on http://127.0.0.1:${port}`));
}
