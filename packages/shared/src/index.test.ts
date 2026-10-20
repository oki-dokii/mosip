import { describe, expect, it } from "vitest";
import { runConfigSchema } from "./index.js";

describe("runConfigSchema", () => {
  it("applies safe walking-skeleton defaults", () => {
    const config = runConfigSchema.parse({
      issuer: "inji_certify",
      wallet: "reference_wallet",
      verifier: "inji_verify",
      format: "vc_sd_jwt",
    });

    expect(config.flow).toBe("cross_device");
    expect(config.tamper).toBeNull();
    expect(config.scenarioId).toBeNull();
  });
});
