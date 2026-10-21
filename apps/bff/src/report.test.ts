import type { RunRecord } from "./store.js";
import { describe, expect, it } from "vitest";
import { buildReport, renderMarkdown } from "./report.js";
import { buildSequence } from "./sequence.js";

const record: RunRecord = {
  run: {
    id: "00000000-0000-4000-8000-000000000001",
    parentRunId: null,
    config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: null },
    status: "passed",
    expectedOutcome: "valid",
    actualOutcome: "valid",
    proofType: "kb+jwt",
    algorithm: "EdDSA",
    createdAt: "2026-10-21T00:00:00.000Z",
    startedAt: "2026-10-21T00:00:01.000Z",
    finishedAt: "2026-10-21T00:00:02.000Z",
  },
  steps: [{ id: "step-1", runId: "00000000-0000-4000-8000-000000000001", seq: 1, stepKey: "ISSUE_TOKEN", title: "Issue token", status: "succeeded", summary: null }],
  exchanges: [{
    id: "exchange-1", runId: "00000000-0000-4000-8000-000000000001", stepId: "step-1", seq: 1,
    actorFrom: "reference_wallet", actorTo: "esignet", method: "POST", url: "https://authorization.example/token", status: 200, durationMs: 12,
    request: { code: "[REDACTED]" }, response: { access_token: "[REDACTED]" }, redactions: ["$.code", "$.access_token"],
  }],
};

describe("run artifacts", () => {
  it("renders a self-contained sanitized Markdown report", () => {
    const markdown = renderMarkdown(buildReport(record));
    expect(markdown).toContain("Expected outcome: **valid**");
    expect(markdown).toContain("Evidence: **Wallet evidence unverified**");
    expect(markdown).toContain('"access_token": "[REDACTED]"');
    expect(markdown).toContain("`$.access_token`");
  });

  it("builds Mermaid with exchange-to-step markers", () => {
    const result = buildSequence(record.exchanges);
    expect(result.mermaid).toContain("reference_wallet");
    expect(result.mermaid).toContain("POST https://authorization.example/token [200]");
    expect(result.markers).toEqual([{ exchangeId: "exchange-1", stepId: "step-1", line: 4 }]);
  });
});
