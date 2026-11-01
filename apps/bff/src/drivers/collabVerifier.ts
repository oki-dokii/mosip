import { randomUUID } from "node:crypto";
import type { DriverContext, DriverExchange, DriverResult, VerifierDriver } from "./types.js";
import { verifyPresentation } from "@playground/mock-verifier";
import { mockPolicy, safeFailure } from "../protocol.js";
import { type JsonObject, STATE, stateValue, positiveInteger, submissionErrorCode, wait, decodeJwtPayload, loadConfig, mockResult, request, exchange } from "./collabCommon.js";

export class MockVerifierDriver implements VerifierDriver {
  readonly id = "mock_verifier" as const;

  async createRequest(context: DriverContext): Promise<DriverResult> {
    if (context.config.format !== "vc_sd_jwt") throw new Error("Mock verifier currently supports SD-JWT VC only");
    const policy = mockPolicy(context.config);
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/vp-request`;
      const body = { format: "dc+sd-jwt", ...(policy.profile === "mock-sdjwt-flat-v1" ? policy : {}) };
      const result = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!result.body?.requestId || !result.body?.claims?.response_uri || (policy.profile === "mock-sdjwt-flat-v1" && (result.body?.policy?.profile !== policy.profile || JSON.stringify(result.body?.policy?.requiredClaims) !== JSON.stringify(policy.requiredClaims)))) throw new Error("External mock verifier omitted the requested policy or state");
      context.state.set(STATE.mockVerifierRequestId, result.body.requestId);
      context.state.set(STATE.requestClaims, result.body.claims);
      return { exchanges: [exchange("playground", this.id, "POST", url, result, body, { requestCreated: true, responseMode: "direct_post", protocolProfile: policy.profile })], summary: { signedRequestReceived: false, protocolProfile: policy.profile, source: "external_non_inji_mock" } };
    }
    const requestClaims = { client_id: "mock-verifier", nonce: randomUUID(), state: randomUUID(), response_uri: "mock://verifier/direct-post" };
    context.state.set(STATE.requestClaims, requestClaims);
    return { exchanges: [exchange("playground", this.id, "POST", "mock://verifier/vp-request", { status: 201, body: {}, durationMs: 0 }, { format: "dc+sd-jwt" }, { requestCreated: true, responseMode: "direct_post" })], summary: { signedRequestReceived: false, protocolProfile: policy.profile, source: "local_non_inji_mock" } };
  }

  async pollStatus(context: DriverContext): Promise<DriverResult> {
    if (context.state.has(STATE.verifySubmissionRejection)) return { summary: { status: "SUBMISSION_REJECTED", attempts: 0 } };
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/status/${encodeURIComponent(stateValue<string>(context, STATE.mockVerifierRequestId))}`;
      const exchanges: DriverExchange[] = [], deadline = Date.now() + positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
      do {
        const result = await request(context, url, { allowStatuses: [400, 404, 410, 500, 502, 503] });
        const status = ["PENDING", "VP_SUBMITTED", "ERROR", "EXPIRED"].includes(result.body?.status) ? result.body.status : "UNAVAILABLE";
        exchanges.push(exchange("playground", this.id, "GET", url, result, {}, { status }));
        if (result.status === 200 && status === "VP_SUBMITTED") return { exchanges, summary: { status, attempts: exchanges.length } };
        if (result.status !== 200 || status !== "PENDING") return { exchanges, summary: { outcome: "error", error: "VERIFIER_NOT_SUBMITTED" } };
        if (Date.now() >= deadline) break;
        await wait(Math.min(Math.max(positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 50), 1), Math.max(deadline - Date.now(), 0)));
      } while (Date.now() <= deadline);
      return { exchanges, summary: { outcome: "error", error: "VERIFIER_SUBMISSION_TIMEOUT" } };
    }
    if (!context.state.has(STATE.mockVpToken)) throw new Error("Presentation was not submitted");
    return { exchanges: [exchange("playground", this.id, "GET", "mock://verifier/status", { status: 200, body: {}, durationMs: 0 }, {}, { status: "VP_SUBMITTED" })], summary: { status: "VP_SUBMITTED", attempts: 1 } };
  }

  async getResult(context: DriverContext): Promise<DriverResult> {
    const policy = mockPolicy(context.config);
    const rejection = context.state.get(STATE.verifySubmissionRejection) as JsonObject | undefined;
    if (rejection) return { summary: { outcome: "invalid", diagnosticsVersion: rejection.diagnosticsVersion, failure: safeFailure(rejection.failure, "direct_post"), resultSource: "direct_post_rejection", protocolProfile: policy.profile } };
    const baseUrl = process.env.MOCK_VERIFIER_BASE_URL;
    if (baseUrl) {
      const url = `${baseUrl}/result/${encodeURIComponent(stateValue<string>(context, STATE.mockVerifierRequestId))}`;
      const exchanges: DriverExchange[] = [], deadline = Date.now() + positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
      do {
        const result = await request(context, url, { allowStatuses: [202, 400, 404, 409, 410, 500, 502, 503] });
        const summary = result.status === 202 ? { status: "VERIFYING" } : result.status === 200 ? mockResult(result.body) : { outcome: "error", error: "VERIFIER_RESULT_UNAVAILABLE" };
        exchanges.push(exchange("playground", this.id, "GET", url, result, {}, summary));
        if (result.status !== 202) return { exchanges, summary: { ...summary, protocolProfile: policy.profile } };
        if (Date.now() >= deadline) break;
        await wait(Math.min(Math.max(positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 50), 1), Math.max(deadline - Date.now(), 0)));
      } while (Date.now() <= deadline);
      return { exchanges, summary: { outcome: "error", error: "VERIFIER_RESULT_TIMEOUT", protocolProfile: policy.profile } };
    }
    const result = await verifyPresentation(stateValue<string>(context, STATE.mockVpToken), stateValue<{ client_id: string; nonce: string }>(context, STATE.requestClaims), policy);
    return { exchanges: [exchange("playground", this.id, "POST", "mock://verifier/vp-results", { status: 200, body: {}, durationMs: 0 }, { includeClaims: false }, result)], summary: { ...result, protocolProfile: policy.profile } };
  }
}

export class CollabVerifierDriver implements VerifierDriver {
  readonly id = "inji_verify" as const;

  async createRequest(context: DriverContext): Promise<DriverResult> {
    const config = await loadConfig(context);
    const url = `${config.verifyBaseUrl}/v2/vp-request`;
    const defaultLdpTypes = ["https://www.w3.org/ns/credentials#VerifiableCredential", "https://inji.github.io/inji-config/contexts/farmer-context.json#FarmerCredential"];
    let ldpTypes = defaultLdpTypes;
    if (context.config.wallet === "inji_web_assisted" && process.env.VERIFY_LDP_TYPE_VALUES_JSON) {
      let configured: unknown;
      try { configured = JSON.parse(process.env.VERIFY_LDP_TYPE_VALUES_JSON); } catch { throw new Error("VERIFY_LDP_TYPE_VALUES_INVALID"); }
      if (!Array.isArray(configured) || configured.length < 1 || configured.length > 8 ||
        !configured.every((value) => typeof value === "string" && value.length > 0 && value.length <= 512 && value.startsWith('https://'))) {
        throw new Error("VERIFY_LDP_TYPE_VALUES_INVALID");
      }
      ldpTypes = configured;
    }
    const body = {
      clientId: process.env.VERIFY_CLIENT_ID ?? "decentralized_identifier:did:web:injiverify.collab.mosip.net:v1:verify",
      nonce: `playground-${config.credentialFormat === "dc+sd-jwt" ? "sdjwt" : "jsonld"}-${Date.now()}`,
      dcqlQuery: { credentials: [{ id: "credential", format: config.credentialFormat, meta: config.credentialFormat === "dc+sd-jwt"
        ? { vct_values: [config.credentialConfigurationId] }
        : { type_values: [ldpTypes] } }] },
      responseCodeValidationRequired: false,
    };
    const created = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!created.body?.requestUri || !created.body?.transactionId || !created.body?.requestId) {
      throw new Error("Inji Verify did not return a request URI, request id, and transaction id");
    }
    const requestObject = await request(context, created.body.requestUri, { headers: { accept: "application/oauth-authz-req+jwt" } });
    const requestClaims = decodeJwtPayload(requestObject.body);
    context.state.set(STATE.verifyTransactionId, created.body.transactionId);
    context.state.set("assisted.presentationUrl", `openid4vp://authorize?request_uri=${encodeURIComponent(created.body.requestUri)}`);
    context.state.set(STATE.verifyRequestId, created.body.requestId);
    context.state.set(STATE.requestClaims, requestClaims);
    return {
      exchanges: [
        exchange("playground", this.id, "POST", url, created, body, { requestUriIssued: true, requestIdIssued: true, transactionIdIssued: true }),
        exchange(context.config.wallet, this.id, "GET", created.body.requestUri, requestObject, { accept: "application/oauth-authz-req+jwt" }, { signedRequestReceived: true, responseMode: requestClaims.response_mode }),
      ],
      summary: { signedRequestReceived: true, queryLanguage: "DCQL" },
    };
  }

  async pollStatus(context: DriverContext): Promise<DriverResult> {
    const rejection = context.state.get(STATE.verifySubmissionRejection) as { status: number; errorCode: string } | undefined;
    if (rejection) {
      return { summary: { status: "SUBMISSION_REJECTED", submissionHttpStatus: rejection.status, errorCode: rejection.errorCode, attempts: 0 } };
    }
    const config = await loadConfig(context);
    const requestId = stateValue<string>(context, STATE.verifyRequestId);
    const intervalMs = positiveInteger(process.env.VERIFY_POLL_INTERVAL_MS, 1_000);
    const timeoutMs = positiveInteger(process.env.VERIFY_POLL_TIMEOUT_MS, 120_000);
    const url = `${config.verifyBaseUrl}/vp-request/${encodeURIComponent(requestId)}/status`;
    const exchanges: DriverExchange[] = [];
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const result = await request(context, url, { headers: { accept: "application/json" } });
      const status = result.body?.status ?? result.body?.response?.status;
      exchanges.push(exchange("playground", this.id, "GET", url, result, {}, { status }));
      if (status === "VP_SUBMITTED") {
        return { exchanges, summary: { status, attempts: exchanges.length } };
      }
      if (["EXPIRED", "CANCELLED", "ERROR", "FAILED"].includes(status)) {
        throw new Error(`Inji Verify presentation reached terminal status ${status}`);
      }
      if (Date.now() - startedAt >= timeoutMs) break;
      await wait(intervalMs);
    }

    throw new Error(`Timed out waiting for Inji Verify presentation status after ${timeoutMs}ms`);
  }

  async getResult(context: DriverContext): Promise<DriverResult> {
    const rejection = context.state.get(STATE.verifySubmissionRejection) as { status: number; errorCode: string } | undefined;
    if (rejection) {
      return { summary: { outcome: "invalid", failureDetail: rejection.errorCode, submissionHttpStatus: rejection.status, resultSource: "direct_post_rejection", protocolProfile: "collab-dcql" } };
    }
    const config = await loadConfig(context);
    const transactionId = stateValue<string>(context, STATE.verifyTransactionId);
    const url = `${config.verifyBaseUrl}/v2/vp-results/${encodeURIComponent(transactionId)}`;
    const body = { includeClaims: false, skipStatusChecks: true };
    const result = await request(context, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), allowStatuses: [400, 404, 500] });
    const credentialResult = result.body?.credentialResults?.[0];
    if (result.status !== 200 || typeof result.body?.allChecksSuccessful !== "boolean") {
      const summary = { outcome: "error", error: "VERIFIER_RESULT_UNAVAILABLE", protocolProfile: "collab-dcql" };
      return { exchanges: [exchange("playground", this.id, "POST", url, result, { includeClaims: false }, summary)], summary };
    }
    const valid = result.body.allChecksSuccessful === true;
    return {
      exchanges: [exchange("playground", this.id, "POST", url, result, body, {
        allChecksSuccessful: result.body?.allChecksSuccessful,
        credentialChecksSuccessful: credentialResult?.allChecksSuccessful,
        credentialProofValid: credentialResult?.schemaAndSignatureCheck?.valid,
        holderProofValid: credentialResult?.holderProofCheck?.valid,
        ...(valid ? {} : { errorCode: submissionErrorCode(result.body) }),
      })],
      summary: { outcome: valid ? "valid" : "invalid", protocolProfile: "collab-dcql", allChecksSuccessful: result.body?.allChecksSuccessful === true,
        ...(valid ? {} : { failureDetail: credentialResult?.schemaAndSignatureCheck?.valid === false
          ? "Verifier rejected the credential schema or issuer signature"
          : credentialResult?.holderProofCheck?.valid === false
            ? "Verifier rejected the holder proof"
            : "Verifier returned an invalid result" }),
      },
    };
  }
}
