import type { DriverContext } from "./types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollabDrivers } from "./collab.js";

function context(): DriverContext {
  return {
    config: {
      issuer: "inji_certify",
      wallet: "reference_wallet",
      verifier: "inji_verify",
      format: "ldp_vc",
      flow: "cross_device",
      tamper: null,
      scenarioId: null,
    },
    state: new Map<string, unknown>([
      ["collab.config", {
        authBaseUrl: "https://auth.example",
        certifyBaseUrl: "https://issuer.example",
        verifyBaseUrl: "https://verify.example",
        postmanEnvironmentPath: "/unused",
        mockOtp: "unused",
        clientId: "client",
        redirectUri: "https://wallet.example/callback",
        individualId: "test-user",
        clientPrivateJwk: {},
        credentialConfigurationId: "FarmerCredential_VCDM2.0",
        credentialScope: "mock_identity_vc_ldp",
        credentialFormat: "ldp_vc",
      }],
      ["collab.verifyRequestId", "request-1"],
    ]),
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.VERIFY_POLL_INTERVAL_MS;
  delete process.env.VERIFY_POLL_TIMEOUT_MS;
});

describe("Collab verifier status polling", () => {
  it("records polls until Verify reports VP_SUBMITTED", async () => {
    process.env.VERIFY_POLL_INTERVAL_MS = "0";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ACTIVE" }))
      .mockResolvedValueOnce(jsonResponse({ status: "VP_SUBMITTED" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCollabDrivers().verifier.pollStatus(context());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.summary).toEqual({ status: "VP_SUBMITTED", attempts: 2 });
    expect(result.exchanges?.map((item) => item.response)).toEqual([
      { status: "ACTIVE" },
      { status: "VP_SUBMITTED" },
    ]);
  });

  it("stops when the configured polling deadline expires", async () => {
    process.env.VERIFY_POLL_INTERVAL_MS = "2";
    process.env.VERIFY_POLL_TIMEOUT_MS = "1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "ACTIVE" })));

    await expect(createCollabDrivers().verifier.pollStatus(context()))
      .rejects.toThrow("Timed out waiting for Inji Verify presentation status");
  });
});
