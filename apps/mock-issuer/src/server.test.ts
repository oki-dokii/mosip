import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportJWK, jwtVerify, SignJWT } from "jose";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.MOCK_ISSUER_NO_LISTEN = "1";
  const module = await import("./server.js");
  server = module.mockIssuerServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.MOCK_ISSUER_NO_LISTEN;
});

describe("standalone OpenID4VCI mock issuer", () => {
  it("advertises SD-JWT, rejects an invalid grant, and issues a holder-bound signed credential", async () => {
    const metadata = await fetch(`${baseUrl}/.well-known/openid-credential-issuer`).then((response) => response.json());
    expect(metadata.credential_configurations_supported.MockVerifiableCredential_SD_JWT.format).toBe("dc+sd-jwt");
    const invalid = await fetch(`${baseUrl}/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant_type: "invalid" }) });
    expect(invalid.status).toBe(400);

    const token = await fetch(`${baseUrl}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code", "pre-authorized_code": "public-test-code" }) }).then((response) => response.json());
    const holder = generateKeyPairSync("ed25519");
    const holderJwk = await exportJWK(holder.publicKey);
    const proof = await new SignJWT({ aud: "http://127.0.0.1:4101", nonce: token.c_nonce }).setProtectedHeader({ alg: "EdDSA", jwk: holderJwk }).sign(holder.privateKey);
    const issued = await fetch(`${baseUrl}/credential`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token.access_token}` }, body: JSON.stringify({ credential_configuration_id: "MockVerifiableCredential_SD_JWT", proofs: { jwt: [proof] } }) });
    expect(issued.status).toBe(200);
    const { credential } = await issued.json();
    const issuerJwt = credential.split("~")[0];
    const claims = JSON.parse(Buffer.from(issuerJwt.split(".")[1], "base64url").toString("utf8"));
    const issuerJwk = JSON.parse(Buffer.from(claims.iss.slice("did:jwk:".length), "base64url").toString("utf8"));
    const { importJWK } = await import("jose");
    await expect(jwtVerify(issuerJwt, await importJWK(issuerJwk, "EdDSA"))).resolves.toBeDefined();
    expect(claims.cnf.jwk.x).toBe(holderJwk.x);
    const replay = await fetch(`${baseUrl}/credential`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token.access_token}` }, body: JSON.stringify({ credential_configuration_id: "MockVerifiableCredential_SD_JWT", proofs: { jwt: [proof] } }) });
    expect(replay.status).toBe(401);
  });
});
