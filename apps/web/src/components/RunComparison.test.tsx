// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RunSummary } from "@playground/shared";
import { RunComparison } from "./RunComparison";
import { api } from "../lib/api";
vi.mock("../lib/api", () => ({ api: { run: vi.fn(), steps: vi.fn(), exchanges: vi.fn() } }));
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
export const record = (id: string): RunSummary => ({ id, parentRunId: null, config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: null }, status: "passed", actualOutcome: "valid", expectedOutcome: "valid", proofType: "kb+jwt", algorithm: "EdDSA", createdAt: "2026-10-26T00:00:00Z", startedAt: null, finishedAt: null, protocolProfile: "fixture-v1", serviceVersions: { issuer: "fixture/1", wallet: "fixture/1", verifier: "fixture/1" } });
beforeEach(() => {
  vi.mocked(api.run).mockImplementation(async id => { const next = record(id); if (id === b) { next.protocolProfile = "collab-dcql"; delete next.serviceVersions; } return next; });
  vi.mocked(api.steps).mockResolvedValue({ items: [] });
  vi.mocked(api.exchanges).mockResolvedValue({ items: [] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("compares configurations, versions, provenance and normalized verdicts without inventing missing structure", async () => {
  render(<RunComparison a={a} b={b} />);
  expect(await screen.findByText("collab-dcql")).toBeTruthy();
  expect(screen.getByText("fixture-v1")).toBeTruthy();
  expect(screen.getByText(/Managed run; Fixture simulation/)).toBeTruthy();
  expect(screen.getByText(/Wallet evidence unverified/)).toBeTruthy();
  expect(screen.getAllByText(/Unavailable: no supported publicView/)).toHaveLength(2);
  expect(screen.getByText("No steps recorded.")).toBeTruthy();
  expect(screen.getAllByText("valid")).toHaveLength(4);
});
it("handles empty/same selection without requests and hides prior results on inaccessible selection", async () => {
  const { rerender } = render(<RunComparison a="" b="" />);
  expect(screen.getByText("Select two recorded runs to compare.")).toBeTruthy();
  rerender(<RunComparison a={a} b={a} />);
  expect(api.run).not.toHaveBeenCalled();
  rerender(<RunComparison a={a} b={b} />);
  await screen.findByText("collab-dcql");
  vi.mocked(api.run).mockRejectedValue(new Error("private credential canary"));
  rerender(<RunComparison a={b} b={a} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("collab-dcql")).toBeNull();
  expect(document.body.textContent).not.toContain("canary");
  vi.mocked(api.run).mockImplementation(async id => record(id));
  fireEvent.click(screen.getByRole("button", { name: "Retry comparison" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(await screen.findAllByText("fixture-v1")).toHaveLength(2);
});
it("suppresses a response belonging to another run", async () => {
  vi.mocked(api.run).mockResolvedValue(record(b));
  render(<RunComparison a={a} b={b} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Recorded verifier verdict")).toBeNull();
});
