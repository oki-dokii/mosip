import { describe, expect, it } from "vitest";
import { applyCredentialTamper, presentationNonce } from "./index.js";

function jwt(payload: object, signature = "signature") {
  return `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

describe("tamper engine", () => {
  it("corrupts an SD-JWT issuer signature", () => {
    const original = `${jwt({ vct: "Example" })}~disclosure~`;
    const changed = applyCredentialTamper(original, "bad_signature", "vc_sd_jwt") as string;
    const signature = (value: string) => Buffer.from(value.split("~")[0]!.split(".")[2]!, "base64url");
    expect(signature(changed).equals(signature(original))).toBe(false);
  });

  it("removes one SD-JWT disclosure", () => {
    const original = `${jwt({ vct: "Example" })}~first~second~`;
    expect((applyCredentialTamper(original, "missing_disclosure", "vc_sd_jwt") as string).split("~"))
      .toEqual([jwt({ vct: "Example" }), "second", ""]);
  });

  it.each(["expired", "wrong_type"] as const)("refuses unsigned %s payload mutations", (kind) => {
    expect(() => applyCredentialTamper(`${jwt({ exp: 4_102_444_800 })}~disclosure~`, kind, "vc_sd_jwt")).toThrow("signed at issuance");
    expect(() => applyCredentialTamper({ type: ["VerifiableCredential"] }, kind, "ldp_vc")).toThrow("signed at issuance");
  });

  it("uses a mismatched nonce for replay simulation", () => {
    expect(presentationNonce("fresh", "replay_nonce")).toBe("replayed-fresh");
    expect(presentationNonce("fresh", null)).toBe("fresh");
  });
});
