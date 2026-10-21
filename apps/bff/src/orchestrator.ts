import { randomUUID } from "node:crypto";
import type { Exchange, RunConfig, RunStep } from "@playground/shared";
import type { Server } from "socket.io";
import { redact } from "./redaction.js";
import type { RunRepository } from "./store.js";

const STEP_DEFINITIONS = [
  ["INIT", "Initialize run"],
  ["ISSUE_OFFER", "Discover issuer and create offer"],
  ["ISSUE_TOKEN", "Authorize wallet and exchange token"],
  ["ISSUE_CREDENTIAL", "Issue holder-bound credential"],
  ["STORE", "Store credential for this run"],
  ["PRESENT_REQUEST", "Create signed presentation request"],
  ["PRESENT_SUBMIT", "Submit holder-bound presentation"],
  ["PRESENT_RESULT", "Verify credential and holder proof"],
  ["REPORT", "Build run result"],
] as const;

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function exchangeFor(step: RunStep, config: RunConfig, sequence: number): Omit<Exchange, "id" | "runId" | "stepId"> | null {
  const format = config.format === "ldp_vc" ? "ldp_vc" : "dc+sd-jwt";
  const templates: Record<string, Omit<Exchange, "id" | "runId" | "stepId" | "seq">> = {
    ISSUE_OFFER: {
      actorFrom: "reference_wallet",
      actorTo: "certify",
      method: "GET",
      url: "https://issuer.example/.well-known/openid-credential-issuer",
      status: 200,
      durationMs: 84,
      request: { accept: "application/json" },
      response: { credential_issuer: "https://issuer.example", format },
      redactions: [],
    },
    ISSUE_TOKEN: {
      actorFrom: "reference_wallet",
      actorTo: "esignet",
      method: "POST",
      url: "https://authorization.example/oauth/v2/token",
      status: 200,
      durationMs: 132,
      request: { grant_type: "authorization_code", code_verifier: "synthetic-secret" },
      response: { token_type: "Bearer", access_token: "synthetic-token", c_nonce: "synthetic-nonce" },
      redactions: [],
    },
    ISSUE_CREDENTIAL: {
      actorFrom: "reference_wallet",
      actorTo: "certify",
      method: "POST",
      url: "https://issuer.example/v1/certify/issuance/credential",
      status: 200,
      durationMs: 206,
      request: { credential_configuration_id: config.format === "ldp_vc" ? "FarmerCredential_VCDM2.0" : "MockVerifiableCredential_SD_JWT" },
      response: { credential_received: true, format, holder_bound: true },
      redactions: [],
    },
    PRESENT_REQUEST: {
      actorFrom: "playground",
      actorTo: "verify",
      method: "POST",
      url: "https://verifier.example/v2/vp-request",
      status: 201,
      durationMs: 91,
      request: { query_language: "DCQL", format },
      response: { request_object_signed: true, response_mode: "direct_post" },
      redactions: [],
    },
    PRESENT_SUBMIT: {
      actorFrom: "reference_wallet",
      actorTo: "verify",
      method: "POST",
      url: "https://verifier.example/v2/vp-submission/direct-post",
      status: 200,
      durationMs: 118,
      request: { format, holder_proof: config.format === "ldp_vc" ? "Ed25519Signature2020" : "kb+jwt" },
      response: { accepted: true },
      redactions: [],
    },
    PRESENT_RESULT: {
      actorFrom: "playground",
      actorTo: "verify",
      method: "POST",
      url: "https://verifier.example/v2/vp-results/{transactionId}",
      status: 200,
      durationMs: 164,
      request: { includeClaims: false, skipStatusChecks: true },
      response: { allChecksSuccessful: true, credentialProofValid: true, holderProofValid: true },
      redactions: [],
    },
  };
  const template = templates[step.stepKey];
  if (!template) return null;
  const request = redact(template.request);
  const response = redact(template.response);
  return {
    ...template,
    seq: sequence,
    request: request.value,
    response: response.value,
    redactions: [...request.redactions, ...response.redactions],
  };
}

export async function runDemo(runId: string, io: Server, repository: RunRepository, stepDelayMs = 110) {
  const record = await repository.get(runId);
  if (!record) return;
  const room = `run:${runId}`;
  const namespace = io.of("/runs");
  record.run.status = "running";
  record.run.startedAt = new Date().toISOString();
  await repository.updateRun(record.run);
  namespace.to(room).emit("run:created", { runId, config: record.run.config });
  let exchangeSequence = record.exchanges.length;

  for (const step of record.steps) {
    step.status = "running";
    await repository.updateStep(step);
    namespace.to(room).emit("step:started", step);
    await wait(stepDelayMs);
    const exchange = exchangeFor(step, record.run.config, exchangeSequence + 1);
    if (exchange) {
      const stored: Exchange = { ...exchange, id: randomUUID(), runId, stepId: step.id };
      await repository.addExchange(stored);
      exchangeSequence += 1;
      namespace.to(room).emit("exchange:recorded", {
        runId,
        exchangeId: stored.id,
        seq: stored.seq,
        actorFrom: stored.actorFrom,
        actorTo: stored.actorTo,
        method: stored.method,
        url: stored.url,
        status: stored.status,
        durationMs: stored.durationMs,
      });
    }
    step.status = "succeeded";
    step.summary = { completed: true };
    await repository.updateStep(step);
    namespace.to(room).emit("step:finished", step);
  }

  record.run.status = "passed";
  record.run.actualOutcome = "valid";
  record.run.finishedAt = new Date().toISOString();
  await repository.updateRun(record.run);
  namespace.to(room).emit("run:finished", {
    runId,
    status: record.run.status,
    expected: record.run.expectedOutcome,
    actual: record.run.actualOutcome,
  });
}

export function createSteps(runId: string): RunStep[] {
  return STEP_DEFINITIONS.map(([stepKey, title], index) => ({
    id: randomUUID(),
    runId,
    seq: index + 1,
    stepKey,
    title,
    status: "pending",
    summary: null,
  }));
}
