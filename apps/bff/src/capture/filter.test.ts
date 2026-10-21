import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterHar } from "./filter.js";
import { prepareHarImport } from "./har.js";
import { createSteps } from "../orchestrator.js";
import type { RunSummary } from "@playground/shared";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/four-service.synthetic.har.json", import.meta.url), "utf8"));
const origins = new Map([["https://wallet.example", "mimoto"], ["https://issuer.example", "certify"], ["https://identity.example", "esignet"], ["https://verifier.example", "verify"]] as const);

describe("local safe HAR filter", () => {
  it("removes hundreds of background calls, reconstructs sanitized bytes, and remains importable", () => {
    const background = Array.from({ length: 250 }, () => ({ request: { method: "GET", url: "https://background.example/tracker?code=CANARY_BACKGROUND" } }));
    const input = { log: { entries: [...background, ...fixture.har.log.entries] } };
    const filtered = filterHar(input, fixture.runId, origins);
    expect(filtered.har.log.entries).toHaveLength(4);
    expect(filtered.report.skippedReasons).toEqual({ background_origin: 250, untagged: 1 });
    expect(JSON.stringify(filtered)).not.toContain("CANARY_");
    const run = { id: fixture.runId, status: "passed" } as RunSummary;
    const prepared = prepareHarImport(filtered, { run, steps: createSteps(run.id), exchanges: [] }, origins);
    expect(prepared.exchanges).toHaveLength(4);
    expect(JSON.stringify(prepared)).not.toContain("CANARY_");
  });
  it("fails closed on oversized input lists and outputs that would exceed one import", () => {
    expect(() => filterHar({ log: { entries: new Array(20_001) } }, fixture.runId, origins)).toThrow(/INVALID_HAR/);
    const entry = fixture.har.log.entries[1];
    const entries = Array.from({ length: 101 }, (_, i) => ({ ...entry, startedDateTime: new Date(i).toISOString() }));
    expect(() => filterHar({ log: { entries } }, fixture.runId, origins)).toThrow(/SPLIT_REQUIRED/);
  });
});
