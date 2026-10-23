import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { RunConfig } from "@playground/shared";
import { prepareHarImport } from "../capture/har.js";
import { collectLiveObservations } from "../capture/live-bridge-cli.js";
import { prepareLiveObservation } from "../capture/live-bridge.js";
import { createSteps } from "../orchestrator.js";
import { matchesPresentation } from "../presentationCorrelation.js";
import { maskedValue, runCorrelationKey } from "../redaction.js";
import { MemoryRunRepository } from "../store.js";
import { InjiWebAssistedDriver, type AssistedObservation } from "./injiWebAssisted.js";

// Synthetic consumer checks; neither mode claims hosted traffic was observed.
it.each([
  { mimeType: "application/json", bridge: false },
  { mimeType: "application/x-www-form-urlencoded", bridge: false },
  { mimeType: "application/json", bridge: true },
  { mimeType: "application/x-www-form-urlencoded", bridge: true },
])(
  "consumes persisted capture exchanges ($mimeType, bridge=$bridge)",
  async ({ mimeType, bridge }) => {
    const id = randomUUID();
    const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
    const repository = new MemoryRunRepository();
    const steps = createSteps(id);
    await repository.create({ run: { id, parentRunId: null, config, status: "running", expectedOutcome: "valid", actualOutcome: null, proofType: "Ed25519Signature2020", algorithm: "EdDSA", createdAt: new Date().toISOString(), startedAt: null, finishedAt: null }, steps, exchanges: [] });
    const origins = new Map([["https://wallet.example", "mimoto"], ["https://issuer.example", "certify"], ["https://verifier.example", "verify"]] as const);
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
    const observedAt = Date.now();
    const importEntry = async (url: string, body: Record<string, string>, contentType = "application/json") => {
      const record = (await repository.get(id))!;
      const input = { runId: id, har: { log: { entries: [{ startedDateTime: new Date(observedAt + occurrence++ * 1000).toISOString(), time: 1, request: { method: "POST", url, headers: [], postData: { mimeType: contentType, text: contentType === "application/json" ? JSON.stringify(body) : new URLSearchParams(body).toString() } }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: JSON.stringify({ credential: secret }) } } }] } } };
      const result = bridge
        ? { exchanges: collectLiveObservations(input, origins).observations.map(observation => prepareLiveObservation(observation, record, origins)) }
        : prepareHarImport(input, record, origins, true);
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
      const issued = await importEntry(bridge ? "https://wallet.example/v1/mimoto/credential/synthetic-id" : "https://issuer.example/credential", { proof: secret });
      expect((await issuance).summary).toMatchObject({ exchangeId: issued.id, downstreamCertifyObserved: !bridge });
      if (bridge) expect(issued.request).toMatchObject({ source: "live_bridge", capture: { ruleId: "mimoto-download", downstreamCertifyObserved: false } });
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
