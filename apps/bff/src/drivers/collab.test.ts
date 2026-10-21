import type { DriverContext } from "./types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCollabDrivers } from "./collab.js";
import { importJWK, jwtVerify } from "jose";

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

describe("local non-Inji issuer", () => {
  it("runs without the Certify OAuth test environment", async () => {
    const mockContext = context();
    mockContext.config.issuer = "mock_issuer";
    mockContext.config.verifier = "mock_verifier";
    mockContext.config.format = "vc_sd_jwt";
    mockContext.state.clear();
    const drivers = createCollabDrivers(mockContext.config);
    await drivers.issuer.createOffer(mockContext);
    await drivers.wallet.authorize(mockContext);
    await drivers.wallet.requestCredential(mockContext);
    await drivers.verifier.createRequest(mockContext);
    await drivers.wallet.present(mockContext);
    expect((await drivers.verifier.getResult(mockContext)).summary?.outcome).toBe("valid");
  });

  it("issues a signed holder-bound SD-JWT with a matching disclosure", async () => {
    const mockContext = context();
    mockContext.config.issuer = "mock_issuer";
    mockContext.config.format = "vc_sd_jwt";
    mockContext.state.set("collab.config", { ...(mockContext.state.get("collab.config") as object), credentialConfigurationId: "MockVerifiableCredential_SD_JWT", credentialFormat: "dc+sd-jwt" });
    const drivers = createCollabDrivers(mockContext.config);
    await drivers.issuer.createOffer(mockContext);
    await drivers.wallet.authorize(mockContext);
    await drivers.wallet.requestCredential(mockContext);
    const credential = mockContext.state.get("collab.credential") as string;
    const [jwt = "", disclosure] = credential.split("~");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
    const publicJwk = JSON.parse(Buffer.from(payload.iss.slice("did:jwk:".length), "base64url").toString("utf8"));
    await expect(jwtVerify(jwt, await importJWK(publicJwk, "EdDSA"))).resolves.toBeDefined();
    expect(payload.cnf.jwk.x).toBeDefined();
    expect(disclosure).toBeTruthy();
  });

  it("passes a signed presentation to the mock verifier and rejects a bad signature", async () => {
    for (const tamper of [null, "bad_signature"] as const) {
      const mockContext = context();
      mockContext.config.issuer = "mock_issuer";
      mockContext.config.verifier = "mock_verifier";
      mockContext.config.format = "vc_sd_jwt";
      mockContext.config.tamper = tamper;
      mockContext.state.set("collab.config", { ...(mockContext.state.get("collab.config") as object), credentialConfigurationId: "MockVerifiableCredential_SD_JWT", credentialFormat: "dc+sd-jwt" });
      const drivers = createCollabDrivers(mockContext.config);
      await drivers.issuer.createOffer(mockContext);
      await drivers.wallet.authorize(mockContext);
      await drivers.wallet.requestCredential(mockContext);
      await drivers.wallet.store(mockContext);
      await drivers.verifier.createRequest(mockContext);
      await drivers.wallet.present(mockContext);
      expect((await drivers.verifier.pollStatus(mockContext)).summary?.status).toBe("VP_SUBMITTED");
      expect((await drivers.verifier.getResult(mockContext)).summary?.outcome).toBe(tamper ? "invalid" : "valid");
    }
  });
});
