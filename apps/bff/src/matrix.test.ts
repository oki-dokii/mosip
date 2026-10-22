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
    expect(renderMatrixCsv([run("new", "2026-01-03T00:00:00Z")])).toContain('"unverified"');
    const markdown = renderMatrixMarkdown([run("new", "2026-01-03T00:00:00Z")]);
    expect(markdown).toContain("| inji_certify | reference_wallet |");
    const table = markdown.split("\n").filter((line) => line.startsWith("|"));
    expect(table).toHaveLength(3);
    expect(table.map((line) => line.split("|").length - 2)).toEqual([10, 10, 10]);
  });

  it("keeps fixture and live evidence in separate latest-result rows", () => {
    const fixture = { ...run("fixture", "2026-01-04T00:00:00Z"), serviceVersions: { issuer: "fixture/1", wallet: "fixture/1", verifier: "fixture/1" } };
    const live = { ...run("live", "2026-01-03T00:00:00Z"), serviceVersions: { issuer: "unreported", wallet: "reference-wallet/0.1", verifier: "unreported" } };
    expect(latestMatrix([fixture, live]).map((item) => item.id)).toEqual(["fixture", "live"]);
    expect(latestMatrix([fixture, live]).map((item) => item.evidenceTier)).toEqual(["fixture", "reference_wallet"]);
  });
});

it("reports an explicit server-owned untested grid with no invented run evidence", async () => {
  const { matrixCells } = await import("./matrix.js");
  const cells = matrixCells([]);
  expect(cells.length).toBe(6);
  expect(cells.every(cell => cell.status === "not_tested" && cell.runId === null && cell.testedAt === null)).toBe(true);
  expect(cells.filter(cell => cell.config.wallet === "inji_web_assisted").map(cell => cell.config.format)).toEqual(["ldp_vc"]);
});
