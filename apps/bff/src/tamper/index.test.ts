import { describe, expect, it } from "vitest";
import { applyCredentialTamper, presentationNonce } from "./index.js";

function jwt(payload: object, signature = "signature") {
  return `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

describe("tamper engine", () => {
  it("corrupts an SD-JWT issuer signature", () => {
    const original = `${jwt({ vct: "Example" })}~disclosure~`;
    expect(applyCredentialTamper(original, "bad_signature", "vc_sd_jwt")).not.toBe(original);
  });

  it("removes one SD-JWT disclosure", () => {
    const original = `${jwt({ vct: "Example" })}~first~second~`;
    expect((applyCredentialTamper(original, "missing_disclosure", "vc_sd_jwt") as string).split("~"))
      .toEqual([jwt({ vct: "Example" }), "second", ""]);
  });

  it("rewrites the SD-JWT expiry into the past", () => {
    const changed = applyCredentialTamper(`${jwt({ exp: 4_102_444_800 })}~disclosure~`, "expired", "vc_sd_jwt") as string;
    const payload = JSON.parse(Buffer.from(changed.split("~")[0]!.split(".")[1]!, "base64url").toString("utf8"));
    expect(payload.exp).toBe(1);
  });

  it("does not mutate the original JSON-LD credential", () => {
    const original = { type: ["VerifiableCredential", "FarmerCredential"], credentialSubject: { id: "did:jwk:test" } };
    const changed = applyCredentialTamper(original, "wrong_type", "ldp_vc") as typeof original;
    expect(changed.type).toEqual(["VerifiableCredential", "UnexpectedCredential"]);
    expect(original.type).toEqual(["VerifiableCredential", "FarmerCredential"]);
  });

  it("uses a mismatched nonce for replay simulation", () => {
    expect(presentationNonce("fresh", "replay_nonce")).toBe("replayed-fresh");
    expect(presentationNonce("fresh", null)).toBe("fresh");
  });
});
