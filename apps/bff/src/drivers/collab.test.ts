import type { DriverContext } from "./types.js";
import { readFileSync } from "node:fs";
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
  delete process.env.VERIFY_LDP_TYPE_VALUES_JSON;
});

describe("Collab verifier status polling", () => {
  it("never sends the eSignet cookie to Certify or Verify", async () => {
    const run = context();
    run.state.set("collab.cookie", "XSRF-TOKEN=synthetic-secret");
    run.state.set("collab.cookieOrigin", "https://auth.example");
    process.env.VERIFY_POLL_INTERVAL_MS = "0";
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ credential_configurations_supported: { "FarmerCredential_VCDM2.0": { format: "ldp_vc" } } }))
      .mockResolvedValueOnce(jsonResponse({ status: "VP_SUBMITTED" }));
    vi.stubGlobal("fetch", fetchMock);

    await createCollabDrivers().issuer.createOffer(run);
    await createCollabDrivers().verifier.pollStatus(run);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const sent = call[1] as RequestInit;
      expect(new Headers(sent.headers).has("cookie")).toBe(false);
    }
  });

  it("sends a scoped cookie only to its origin and disables redirect following", async () => {
    const run = context();
    run.state.set("collab.cookie", "XSRF-TOKEN=synthetic-secret");
    run.state.set("collab.cookieOrigin", "https://verify.example");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "VP_SUBMITTED" }));
    vi.stubGlobal("fetch", fetchMock);

    await createCollabDrivers().verifier.pollStatus(run);
    const sent = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(sent.headers).get("cookie")).toBe("XSRF-TOKEN=synthetic-secret");
    expect(sent.redirect).toBe("manual");
  });

  it("uses configured public JSON-LD types for an assisted Web request", async () => {
    process.env.VERIFY_LDP_TYPE_VALUES_JSON = JSON.stringify(["https://www.w3.org/ns/credentials#VerifiableCredential", "https://example.org/land#RegistrationReceipt"]);
    const run = context(); run.config.wallet = "inji_web_assisted";
    const claims = Buffer.from(JSON.stringify({ state: "synthetic-state-0123456789abcdef0123456789", response_mode: "direct_post" })).toString("base64url");
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ requestUri: "https://verify.example/request/one", transactionId: "transaction", requestId: "request" }))
      .mockResolvedValueOnce(new Response(`e30.${claims}.signature`, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createCollabDrivers().verifier.createRequest(run);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const sent = JSON.parse(firstCall[1].body);
    expect(sent.dcqlQuery.credentials[0].meta.type_values).toEqual([["https://www.w3.org/ns/credentials#VerifiableCredential", "https://example.org/land#RegistrationReceipt"]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("finishes an HTTP 400 direct-post rejection without polling or requesting a missing result", async () => {
    const run = context();
    run.config.issuer = "mock_issuer";
    run.config.format = "vc_sd_jwt";
    run.config.tamper = "replay_nonce";
    run.state.set("collab.config", { ...(run.state.get("collab.config") as object), credentialConfigurationId: "MockVerifiableCredential_SD_JWT", credentialFormat: "dc+sd-jwt" });
    const drivers = createCollabDrivers(run.config);
    await drivers.issuer.createOffer(run);
    await drivers.wallet.authorize(run);
    await drivers.wallet.requestCredential(run);
    run.state.set("collab.requestClaims", {
      client_id: "did:web:verify.example", nonce: "expected-nonce", state: "test-state",
      response_uri: "https://verify.example/direct-post",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_request", error_description: "Bearer should-not-be-saved" }), {
      status: 400, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const submitted = await drivers.wallet.present(run);
    const status = await drivers.verifier.pollStatus(run);
    const result = await drivers.verifier.getResult(run);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submitted.exchanges?.[0]?.status).toBe(400);
    expect(submitted.exchanges?.[0]?.response).toEqual({ accepted: false, errorCode: "invalid_request" });
    expect(status.summary).toMatchObject({ status: "SUBMISSION_REJECTED", attempts: 0, errorCode: "invalid_request" });
    expect(result.summary).toMatchObject({ outcome: "invalid", failureDetail: "invalid_request", resultSource: "direct_post_rejection" });
  });

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
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ status: "ACTIVE" }))));

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

describe("Certify issuer discovery against recorded Collab configuration pairs", () => {
  const record = JSON.parse(readFileSync(new URL("../../../../spikes/fixtures/collab-contracts-2026-10-20.json", import.meta.url), "utf8"));
  const pairs = Object.values(record.certify.credentialConfigurations) as {id: string; format: string}[];
  it.each(pairs)("checks the advertised format for $id before reporting support", async ({id, format}) => {
    const run = context();
    Object.assign(run.state.get("collab.config") as object, { credentialConfigurationId: id, credentialFormat: format });
    const reply = (advertised: unknown) => jsonResponse({credential_configurations_supported: {[id]: {format: advertised}}});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(format))
      .mockResolvedValueOnce(reply(format === "ldp_vc" ? "dc+sd-jwt" : "ldp_vc")).mockResolvedValueOnce(reply(undefined)));
    const issuer = createCollabDrivers().issuer;
    await expect(issuer.createOffer(run)).resolves.toMatchObject({summary: {credentialConfigurationId: id, format}});
    for (let i = 0; i < 2; i++) await expect(issuer.createOffer(run)).rejects.toThrow("ISSUER_METADATA_FORMAT_MISMATCH");
  });
});
