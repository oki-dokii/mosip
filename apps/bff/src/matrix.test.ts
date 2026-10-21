import { describe, expect, it } from "vitest";
import type { RunSummary } from "@playground/shared";
import { latestMatrix, renderMatrixCsv, renderMatrixMarkdown } from "./matrix.js";

function run(id: string, createdAt: string, tamper: RunSummary["config"]["tamper"] = null): RunSummary {
  return {
    id, parentRunId: null,
    config: { issuer: "inji_certify", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", flow: "cross_device", tamper, scenarioId: null },
    status: "passed", expectedOutcome: tamper ? "invalid" : "valid", actualOutcome: tamper ? "invalid" : "valid",
    proofType: "kb+jwt", algorithm: "EdDSA", createdAt, startedAt: createdAt, finishedAt: createdAt,
  };
}

describe("interoperability matrix", () => {
  it("keeps the newest run for each complete combination", () => {
    expect(latestMatrix([run("old", "2026-01-01T00:00:00Z"), run("fault", "2026-01-02T00:00:00Z", "expired"), run("new", "2026-01-03T00:00:00Z")]).map((item) => item.id)).toEqual(["new", "fault"]);
  });

  it("exports portable CSV and Markdown", () => {
    expect(renderMatrixCsv([run("new", "2026-01-03T00:00:00Z")])).toContain('"new","inji_certify"');
    expect(renderMatrixMarkdown([run("new", "2026-01-03T00:00:00Z")])).toContain("| inji_certify | reference_wallet |");
  });
});
