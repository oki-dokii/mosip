import type { RunConfig } from "@playground/shared";
import type { DriverContext, DriverResult, DriverSet, IssuerDriver, VerifierDriver, WalletDriver } from "./types.js";

function format(context: DriverContext) {
  return context.config.format === "ldp_vc" ? "ldp_vc" : "dc+sd-jwt";
}

class FixtureIssuerDriver implements IssuerDriver {
  constructor(readonly id: RunConfig["issuer"]) {}

  async createOffer(context: DriverContext): Promise<DriverResult> {
    return {
      exchanges: [{
        actorFrom: context.config.wallet,
        actorTo: context.config.issuer,
        method: "GET",
        url: "https://issuer.example/.well-known/openid-credential-issuer",
        status: 200,
        durationMs: 84,
        request: { accept: "application/json" },
        response: { credential_issuer: "https://issuer.example", format: format(context) },
      }],
    };
  }
}

class FixtureWalletDriver implements WalletDriver {
  constructor(readonly id: RunConfig["wallet"]) {}

  async authorize(context: DriverContext): Promise<DriverResult> {
    context.state.set("authorized", true);
    return {
      exchanges: [{
        actorFrom: this.id,
        actorTo: "esignet",
        method: "POST",
        url: "https://authorization.example/oauth/v2/token",
        status: 200,
        durationMs: 132,
        request: { grant_type: "authorization_code", code_verifier: "synthetic-secret" },
        response: { token_type: "Bearer", access_token: "synthetic-token", c_nonce: "synthetic-nonce" },
      }],
    };
  }

  async requestCredential(context: DriverContext): Promise<DriverResult> {
    if (!context.state.get("authorized")) throw new Error("Wallet must authorize before requesting a credential");
    context.state.set("credential", { format: format(context), holderBound: true });
    return {
      exchanges: [{
        actorFrom: this.id,
        actorTo: context.config.issuer,
        method: "POST",
        url: "https://issuer.example/v1/certify/issuance/credential",
        status: 200,
        durationMs: 206,
        request: {
          credential_configuration_id: context.config.format === "ldp_vc"
            ? "FarmerCredential_VCDM2.0"
            : "MockVerifiableCredential_SD_JWT",
        },
        response: { credential_received: true, format: format(context), holder_bound: true },
      }],
    };
  }

  async store(context: DriverContext): Promise<DriverResult> {
    if (!context.state.get("credential")) throw new Error("Wallet cannot store a missing credential");
    return { summary: { stored: true } };
  }

  async present(context: DriverContext): Promise<DriverResult> {
    if (!context.state.get("presentationRequest")) throw new Error("Wallet needs a presentation request");
    return {
      exchanges: [{
        actorFrom: this.id,
        actorTo: context.config.verifier,
        method: "POST",
        url: "https://verifier.example/v2/vp-submission/direct-post",
        status: 200,
        durationMs: 118,
        request: {
          format: format(context),
          holder_proof: context.config.format === "ldp_vc" ? "Ed25519Signature2020" : "kb+jwt",
        },
        response: { accepted: true },
      }],
    };
  }
}

class FixtureVerifierDriver implements VerifierDriver {
  constructor(readonly id: RunConfig["verifier"]) {}

  async createRequest(context: DriverContext): Promise<DriverResult> {
    context.state.set("presentationRequest", true);
    return {
      exchanges: [{
        actorFrom: "playground",
        actorTo: this.id,
        method: "POST",
        url: "https://verifier.example/v2/vp-request",
        status: 201,
        durationMs: 91,
        request: { query_language: "DCQL", format: format(context) },
        response: { request_object_signed: true, response_mode: "direct_post" },
      }],
    };
  }

  async pollStatus(_context: DriverContext): Promise<DriverResult> {
    return {
      exchanges: [{
        actorFrom: "playground",
        actorTo: this.id,
        method: "GET",
        url: "https://verifier.example/vp-request/{requestId}/status",
        status: 200,
        durationMs: 47,
        request: {},
        response: { status: "VP_SUBMITTED" },
      }],
      summary: { status: "VP_SUBMITTED", attempts: 1 },
    };
  }

  async getResult(_context: DriverContext): Promise<DriverResult> {
    return {
      exchanges: [{
        actorFrom: "playground",
        actorTo: this.id,
        method: "POST",
        url: "https://verifier.example/v2/vp-results/{transactionId}",
        status: 200,
        durationMs: 164,
        request: { includeClaims: false, skipStatusChecks: true },
        response: { allChecksSuccessful: true, credentialProofValid: true, holderProofValid: true },
      }],
      summary: { outcome: "valid" },
    };
  }
}

export function createFixtureDrivers(config: RunConfig): DriverSet {
  return {
    issuer: new FixtureIssuerDriver(config.issuer),
    wallet: new FixtureWalletDriver(config.wallet),
    verifier: new FixtureVerifierDriver(config.verifier),
  };
}
