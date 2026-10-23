import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { RunConfig } from "@playground/shared";
import { prepareHarImport } from "../capture/har.js";
import { createSteps } from "../orchestrator.js";
import { matchesPresentation } from "../presentationCorrelation.js";
import { maskedValue, runCorrelationKey } from "../redaction.js";
import { MemoryRunRepository } from "../store.js";
import { InjiWebAssistedDriver, type AssistedObservation } from "./injiWebAssisted.js";

// Synthetic same-process consumer check. This deliberately does not simulate a
// standalone-filter bridge or claim that hosted traffic is observable.
it.each(["application/json", "application/x-www-form-urlencoded"])(
  "consumes persisted capture exchanges with correlated %s presentation",
  async mimeType => {
    const id = randomUUID();
    const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
    const repository = new MemoryRunRepository();
    const steps = createSteps(id);
    await repository.create({ run: { id, parentRunId: null, config, status: "running", expectedOutcome: "valid", actualOutcome: null, proofType: "Ed25519Signature2020", algorithm: "EdDSA", createdAt: new Date().toISOString(), startedAt: null, finishedAt: null }, steps, exchanges: [] });
    const origins = new Map([["https://issuer.example", "certify"], ["https://verifier.example", "verify"]] as const);
    const state = "synthetic-request-state-0123456789abcdef";
    const secret = "CANARY_SYNTHETIC_CREDENTIAL";
    const expectedTag = maskedValue(state, "$.request.body.state", runCorrelationKey(id));
    const listeners = new Set<(event: AssistedObservation) => void>();
    let observations: AssistedObservation[] = [];
    const abort = new AbortController();
    const driver = new InjiWebAssistedDriver({ runId: id, stepIds: { ISSUE_CREDENTIAL: steps.find(s => s.stepKey === "ISSUE_CREDENTIAL")!.id, PRESENT_SUBMIT: steps.find(s => s.stepKey === "PRESENT_SUBMIT")!.id }, signal: abort.signal, source: {
      snapshot: () => observations,
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    }, presentationMatches: exchange => matchesPresentation(exchange, expectedTag, "https://verifier.example") });
    const context = { config, state: new Map() };
    let occurrence = 0;
    const importEntry = async (url: string, body: Record<string, string>, contentType = "application/json") => {
      const record = (await repository.get(id))!;
      const result = prepareHarImport({ runId: id, har: { log: { entries: [{ startedDateTime: new Date(Date.UTC(2026, 9, 23) + occurrence++ * 1000).toISOString(), time: 1, request: { method: "POST", url, headers: [], postData: { mimeType: contentType, text: contentType === "application/json" ? JSON.stringify(body) : new URLSearchParams(body).toString() } }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ credential: secret }) } } }] } } }, record, origins, true);
      expect(result.exchanges).toHaveLength(1);
      const exchange = result.exchanges[0]!;
      await repository.addExchange(exchange);
      observations = (await repository.get(id))!.exchanges.map(exchange => ({ kind: "exchange", exchange }));
      for (const event of observations) for (const listener of [...listeners]) listener(event);
      return exchange;
    };
    try {
      const issuance = driver.requestCredential(context);
      void issuance.catch(() => {});
      const issued = await importEntry("https://issuer.example/credential", { proof: secret });
      expect((await issuance).summary?.exchangeId).toBe(issued.id);
      const confirmation: AssistedObservation = { kind: "storage_confirmation", runId: id, issuanceExchangeId: issued.id, source: "wallet_confirmation" };
      observations.push(confirmation);
      expect((await driver.store(context)).summary?.confirmationSource).toBe("wallet_confirmation");
      const presentation = driver.present(context);
      void presentation.catch(() => {});
      await importEntry("https://verifier.example/direct-post", { state: "different-synthetic-request-state-0123456789", vp_token: secret }, mimeType);
      expect(listeners.size).toBe(1);
      const presented = await importEntry("https://verifier.example/direct-post", { state, vp_token: secret }, mimeType);
      expect((await presentation).summary).toMatchObject({ exchangeId: presented.id, verifierResultPending: true });
      expect(listeners.size).toBe(0);
      const persisted = (await repository.get(id))!;
      expect(persisted.exchanges).toHaveLength(3);
      expect(JSON.stringify(persisted)).not.toContain(state);
      expect(JSON.stringify(persisted)).not.toContain(secret);
      expect(persisted.run.actualOutcome).toBeNull();
    } finally {
      abort.abort();
    }
  },
);
