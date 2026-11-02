import type { DriverContext, DriverResult, IssuerDriver } from "./types.js";
import { loadConfig, request, exchange } from "./collabCommon.js";

export class MockIssuerDriver implements IssuerDriver {
  readonly id = "mock_issuer" as const;

  async createOffer(context: DriverContext): Promise<DriverResult> {
    if (context.config.format !== "vc_sd_jwt") throw new Error("Mock issuer currently supports SD-JWT VC only");
    const baseUrl = process.env.MOCK_ISSUER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/.well-known/openid-credential-issuer`;
      const result = await request(context, url);
      if (!result.body?.credential_configurations_supported?.MockVerifiableCredential_SD_JWT) throw new Error("External mock issuer does not advertise the SD-JWT configuration");
      return { exchanges: [exchange(context.config.wallet, this.id, "GET", url, result, {}, {
        credential_issuer: result.body.credential_issuer, credential_configuration_id: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt",
      })], summary: { credentialConfigurationId: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt", source: "external_non_inji_mock" } };
    }
    return {
      exchanges: [exchange(context.config.wallet, this.id, "GET", "mock://issuer/.well-known/openid-credential-issuer", { status: 200, body: {}, durationMs: 0 }, {}, {
        credential_issuer: "mock://issuer", credential_configuration_id: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt",
      })],
      summary: { credentialConfigurationId: "MockVerifiableCredential_SD_JWT", format: "dc+sd-jwt", source: "local_non_inji_mock" },
    };
  }
}

export class CollabIssuerDriver implements IssuerDriver {
  readonly id = "inji_certify" as const;

  async createOffer(context: DriverContext): Promise<DriverResult> {
    const config = await loadConfig(context);
    const url = `${config.certifyBaseUrl}/.well-known/openid-credential-issuer`;
    const result = await request(context, url, { headers: { accept: "application/json" } });
    const configurations = result.body?.credential_configurations_supported ?? {};
    if (!configurations[config.credentialConfigurationId]) {
      throw new Error(`Issuer does not advertise ${config.credentialConfigurationId}`);
    }
    if (configurations[config.credentialConfigurationId].format !== config.credentialFormat) {
      throw new Error("ISSUER_METADATA_FORMAT_MISMATCH");
    }
    return {
      exchanges: [exchange(context.config.wallet, this.id, "GET", url, result, { accept: "application/json" }, {
        credential_issuer: result.body?.credential_issuer,
        credential_configuration_id: config.credentialConfigurationId,
        format: config.credentialFormat,
        supported: true,
      })],
      summary: { credentialConfigurationId: config.credentialConfigurationId, format: config.credentialFormat },
    };
  }
}
