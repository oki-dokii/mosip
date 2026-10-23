import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { decodeProtectedHeader, exportJWK, importJWK, jwtVerify } from "jose";
import { configurationId, issueCredential, variants, type CredentialVariant } from "./credential.js";
import { decodeJson, InputError, object, readInput, send } from "./http.js";
import type { IssuerSigner } from "./signing.js";

export function createMockIssuer(options: { signer: IssuerSigner; publicBaseUrl: () => string; enableTestCases?: boolean; now?: () => number; capacity?: number }) {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const grants = new Map<string, { nonce: string; expiresAt: number; variant: CredentialVariant }>();
  return createServer(async (request, response) => {
    try {
      const time = now();
      for (const [id, grant] of grants) if (time >= grant.expiresAt) grants.delete(id);
      const base = options.publicBaseUrl();
      if (request.method === "GET" && request.url === "/.well-known/openid-credential-issuer") {
        return send(response, 200, { credential_issuer: base, token_endpoint: `${base}/token`, credential_endpoint: `${base}/credential`, credential_configurations_supported: { [configurationId]: { format: "dc+sd-jwt", vct: configurationId, credential_signing_alg_values_supported: [options.signer.algorithm], proof_types_supported: { jwt: { proof_signing_alg_values_supported: ["EdDSA"] } } } } });
      }
      if (request.method === "POST" && request.url === "/token") {
        const input = await readInput(request, 32_768);
        const createdAt = now();
        for (const [id, grant] of grants) if (createdAt >= grant.expiresAt) grants.delete(id);
        if (input.grant_type !== "urn:ietf:params:oauth:grant-type:pre-authorized_code" || input["pre-authorized_code"] !== "public-test-code") throw new InputError(400, "invalid_grant");
        if (Object.hasOwn(input, "mock_case") && (!options.enableTestCases || !variants.includes(input.mock_case as CredentialVariant))) throw new InputError(400, "unsupported_test_case");
        if (grants.size >= (options.capacity ?? 1024)) throw new InputError(503, "capacity_exceeded");
        const accessToken = randomUUID(), nonce = randomUUID();
        grants.set(accessToken, { nonce, expiresAt: createdAt + 60, variant: (input.mock_case as CredentialVariant | undefined) ?? "valid" });
        return send(response, 200, { access_token: accessToken, token_type: "Bearer", expires_in: 60, c_nonce: nonce });
      }
      if (request.method === "POST" && request.url === "/credential") {
        const accessToken = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
        const grant = grants.get(accessToken);
        grants.delete(accessToken); // One recognized grant permits one attempt, including failed proofs.
        if (!grant) throw new InputError(401, "invalid_token");
        const input = await readInput(request, 32_768);
        const proofTime = now();
        if (proofTime >= grant.expiresAt) throw new InputError(401, "invalid_token");
        const proofs = input.proofs;
        if (input.credential_configuration_id !== configurationId || !object(proofs) || Object.keys(proofs).length !== 1 || !Array.isArray(proofs.jwt) || proofs.jwt.length !== 1 || typeof proofs.jwt[0] !== "string") throw new InputError(400, "invalid_credential_request");
        const proof = proofs.jwt[0];
        if (proof.length > 16_384) throw new InputError(400, "invalid_proof");
        let holderPublicJwk;
        try {
          decodeJson(proof.split(".")[0] ?? ""); decodeJson(proof.split(".")[1] ?? "");
          const header = decodeProtectedHeader(proof), jwk = header.jwk;
          if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some((key) => Object.hasOwn(jwk, key))) throw new Error();
          const key = await importJWK(jwk, "EdDSA");
          const verified = await jwtVerify(proof, key, { audience: base, algorithms: ["EdDSA"], currentDate: new Date(proofTime * 1000) });
          if (verified.payload.nonce !== grant.nonce) throw new InputError(400, "invalid_nonce");
          const exported = await exportJWK(key);
          holderPublicJwk = { kty: exported.kty!, crv: exported.crv!, x: exported.x! };
        } catch (error) {
          if (error instanceof InputError && error.code === "invalid_nonce") throw error;
          throw new InputError(400, "invalid_proof");
        }
        const credential = await issueCredential({ signer: options.signer, holderPublicJwk, variant: grant.variant, now: proofTime, twoClaims: options.enableTestCases === true });
        return send(response, 200, { credential, format: "dc+sd-jwt" });
      }
      send(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof InputError) send(response, error.status, { error: error.code });
      else send(response, 500, { error: "issuer_error" });
    }
  });
}
