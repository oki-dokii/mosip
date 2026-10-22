import { describe, expect, it } from "vitest";
import { decodePublicProtocol, publicViewForHarPart } from "./public-view.js";

const secret = "CANARY_MUST_NEVER_PERSIST";
const origins = new Map([["https://issuer.example", "certify"]]);
const jwt = (payload: unknown, head: unknown = { alg: "EdDSA", typ: "oauth-authz-req+jwt", kid: secret }) =>
  `${Buffer.from(JSON.stringify(head)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.c3ludGhldGlj`;
const summaries = (v: unknown) => decodePublicProtocol(v, origins);

describe("public protocol projection before storage", () => {
  it("projects offers without their codes, URI parameters, or unknown configuration names", () => {
    const result = summaries({ credential_offer: JSON.stringify({ credential_issuer: `https://issuer.example/${secret}?code=${secret}`, credential_configuration_ids: ["FarmerCredential_VCDM2.0", secret], grants: { "urn:ietf:params:oauth:grant-type:pre-authorized_code": { "pre-authorized_code": secret } } }) });
    expect(result.items[0]).toMatchObject({ kind: "credential_offer", summary: { configurations: ["FarmerCredential_VCDM2.0"], issuer: { origin: "https://issuer.example", path: "[REDACTED]" } } });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("projects Presentation Exchange and DCQL structure while withholding identifying filters and IDs", () => {
    const result = summaries({ presentation_definition: { id: secret, input_descriptors: [{ id: secret, format: { ldp_vc: {} }, constraints: { fields: [{ path: ["$.type", `$.${secret}`], filter: { type: "string", const: secret } }] } }] }, dcql_query: { credentials: [{ id: secret, format: "dc+sd-jwt", claims: [{ path: ["given_name"], values: [secret] }] }] } });
    expect(result.items.map(({ kind }) => kind)).toEqual(["presentation_definition", "dcql"]);
    expect(JSON.stringify(result)).toContain("given_name");
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("decodes request claims and proof headers without keys, certificates, nonces, or signed bytes", () => {
    const token = jwt({ iss: "did:web:issuer.example", nonce: secret, response_mode: "direct_post", presentation_definition: { input_descriptors: [] } });
    const result = summaries({ request: token, proof: { jwt: jwt({ nonce: secret }, { alg: "EdDSA", typ: "openid4vci-proof+jwt", jwk: { kty: "OKP", d: secret } }) } });
    expect(result.items.map(({ kind }) => kind)).toEqual(["request_object", "presentation_definition", "proof_jwt"]);
    expect(result.authenticity).toBe("not_verified");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it("projects SD-JWT claim and disclosure names without salts, values, signatures or key binding", () => {
    const disclosure = Buffer.from(JSON.stringify([secret, "given_name", secret])).toString("base64url");
    const token = `${jwt({ iss: "did:jwk:opaque", _sd: [secret], cnf: { jwk: { d: secret } }, [secret]: secret })}~${disclosure}~`;
    const result = summaries({ credential: token });
    expect(result.items[0]).toMatchObject({ kind: "sd_jwt", summary: { disclosureNames: ["given_name"], issuer: { didMethod: "jwk" } } });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(disclosure);
  });
  it("projects VC types, issuer method and verification booleans without the credential subject", () => {
    const result = summaries({ credential: { type: ["VerifiableCredential", "FarmerCredential", secret], issuer: `did:web:${secret}`, credentialSubject: { given_name: secret } }, allChecksSuccessful: false, holderProofValid: false, error: "invalid_proof", message: secret });
    expect(result.items.map(({ kind }) => kind)).toContain("verifiable_credential");
    expect(result.items.find(({ kind }) => kind === "verification_result")?.summary).toMatchObject({ holderProofValid: false, error: "invalid_proof" });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("handles base64, forms, malformed JWTs and bounded unknown input safely", () => {
    expect(publicViewForHarPart({ content: { text: "!!!", encoding: "base64" } }, origins).items).toEqual([]);
    expect(summaries("not.a.jwt").items).toEqual([]);
    const input = { credential_issuer: "https://issuer.example", credential_configuration_ids: ["FarmerCredential_VCDM2.0"] };
    expect(publicViewForHarPart({ content: { text: Buffer.from(JSON.stringify(input)).toString("base64"), encoding: "base64", mimeType: "application/json" } }, origins).items[0]?.kind).toBe("credential_offer");
    expect(publicViewForHarPart({ postData: { text: new URLSearchParams({ credential_offer: JSON.stringify(input) }).toString(), mimeType: "application/x-www-form-urlencoded" } }, origins).items[0]?.kind).toBe("credential_offer");
  });
  it("does not coerce malformed object-valued JWT headers or result fields", () => {
    const bad = { toString: "CANARY_INVALID" };
    expect(() => summaries({ request: jwt({ status: bad }, { alg: bad, typ: bad }), status: bad, error: bad })).not.toThrow();
    expect(JSON.stringify(summaries({ status: bad, error: bad }))).not.toContain("CANARY_INVALID");
  });

  it("counts withheld credential names, unsupported mDoc and clipped arrays without exposing names", () => {
    const projection = summaries({ credential: { type: ["VerifiableCredential", "FarmerCredential", "CANARY_SECRET_TYPE"],
      credentialSubject: { portrait: "CANARY_PORTRAIT", farmer_id: "CANARY_FARMER" } },
      format: "mso_mdoc", credentials: Array.from({ length: 40 }, () => ({ type: ["VerifiableCredential"] })) });
    expect(projection.withheldNames).toBeGreaterThanOrEqual(3);
    expect(projection.truncatedItems).toBeGreaterThanOrEqual(24);
    expect(projection.unsupportedKinds).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(projection)).not.toContain("CANARY_");
    expect(publicViewForHarPart({ content: { mimeType: "application/cbor", text: "CANARY_CBOR" } }, origins).unsupportedKinds).toBe(1);
  });

});
