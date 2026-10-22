import { generateKeyPairSync } from "node:crypto";
import type { Server } from "node:http";
import { compactVerify, decodeJwt, exportJWK, importJWK, SignJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { createMockIssuer } from "./app.js";
import { loadIssuerSigner } from "./signing.js";
const servers: Server[] = [];
const time = 2_000_000_000;
async function start(options: { enableTestCases?: boolean; capacity?: number; now?: () => number } = {}) {
  let base = "";
  const signer = await loadIssuerSigner({ issuerUrl: "http://127.0.0.1" });
  const server = createMockIssuer({ signer, now: () => time, publicBaseUrl: () => base, ...options }); servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("listener unavailable"); base = `http://127.0.0.1:${address.port}`;
  const token = (variant?: string) => fetch(`${base}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code", "pre-authorized_code": "public-test-code", ...(variant ? { mock_case: variant } : {}) }) });
  const credential = async (grant: { c_nonce: string; access_token: string }, privateJwk = false, extra = {}) => {
    const holder = generateKeyPairSync("ed25519"), jwk = await exportJWK(privateJwk ? holder.privateKey : holder.publicKey);
    const proof = await new SignJWT({ aud: base, nonce: grant.c_nonce, iat: time }).setProtectedHeader({ alg: "EdDSA", jwk }).sign(holder.privateKey);
    return fetch(`${base}/credential`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${grant.access_token}` }, body: JSON.stringify({ credential_configuration_id: "MockVerifiableCredential_SD_JWT", proofs: { jwt: [proof] }, ...extra }) });
  };
  return { base, token, credential, signer };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }))); });
describe("grant-bound signed credential variants", () => {
  it.each(["valid", "expired", "wrong_type", "missing_holder_binding"])("issues signature-valid %s without payload mutation", async (variant) => {
    const app = await start({ enableTestCases: true });
    const grant = await app.token(variant).then((r) => r.json()), result = await app.credential(grant);
    expect(result.status).toBe(200);
    const { credential } = await result.json(), jwt = credential.split("~")[0];
    const issuerJwk = JSON.parse(Buffer.from(app.signer.issuer.slice(8), "base64url").toString("utf8"));
    // Only assert booleans so a failure cannot print full signed tokens.
    let signatureValid = false; try { await compactVerify(jwt, await importJWK(issuerJwk, "EdDSA")); signatureValid = true; } catch { /* assertion below */ }
    expect(signatureValid).toBe(true);
    const claims = decodeJwt(jwt);
    expect(variant === "expired" ? claims.exp! < time && claims.nbf! <= time : claims.exp! > time && claims.nbf! <= time).toBe(true);
    expect(claims.vct).toBe(variant === "wrong_type" ? "UnexpectedCredential" : "MockVerifiableCredential_SD_JWT");
    expect(Boolean(claims.cnf)).toBe(variant !== "missing_holder_binding");
    expect(credential.split("~").length).toBe(4);
  });
  it("rejects fault selection by default and leaves ordinary issuance working", async () => {
    const app = await start(); expect((await app.token("expired")).status).toBe(400);
    const result = await app.credential(await app.token().then((r) => r.json()));
    expect(result.status).toBe(200); const body = await result.json(); expect(body.credential.split("~").length).toBe(3);
  });
  it("rejects private holder material and consumes the one-attempt grant", async () => {
    const app = await start(), grant = await app.token().then((r) => r.json());
    expect((await app.credential(grant, true)).status).toBe(400);
    expect((await app.credential(grant)).status).toBe(401);
  });
  it("bounds grants and expires them at the exact boundary", async () => {
    let current = time;
    const app = await start({ now: () => current, capacity: 1 });
    const grant = await app.token().then((r) => r.json()); expect((await app.token()).status).toBe(503);
    current += 60; expect((await app.credential(grant)).status).toBe(401); expect((await app.token()).status).toBe(200);
  });
  it("rejects duplicate grant selectors", async () => {
    const app = await start({ enableTestCases: true });
    expect((await fetch(`${app.base}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "mock_case=valid&mock_case=expired" })).status).toBe(400);
  });
  it("rechecks grant expiry after the credential body has arrived", async () => {
    let late = false, reads = 0;
    const app = await start({ now: () => !late || ++reads === 1 ? time : time + 60 });
    const grant = await app.token().then((r) => r.json());
    late = true;
    expect((await app.credential(grant)).status).toBe(401);
  });
});
