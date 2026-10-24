import { expect, it } from "vitest";
import type { RunConfig } from "@playground/shared";
import { snapshotVersions } from "./versions.js";

const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
it("keeps the assisted wallet's unknown release distinct from the automated Reference Wallet", () => {
  expect(snapshotVersions(config, "collab").wallet).toBe("unreported");
  expect(snapshotVersions({ ...config, wallet: "reference_wallet" }, "collab").wallet).toBe("reference-wallet/0.1.0");
  expect(snapshotVersions(config, "fixture").wallet).toBe("fixture/1");
});
