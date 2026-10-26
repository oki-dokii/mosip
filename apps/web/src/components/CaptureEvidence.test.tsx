// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PublicEvidence } from "./PublicEvidence";
import { CaptureCoverage } from "./CaptureCoverage";
import { api } from "../lib/api";
import { coverage, publicView } from "../lib/captureEvidence";

const totals = { withheldNames: 2, truncatedItems: 3, unsupportedKinds: 1 };
const view = { schemaVersion: 1, authenticity: "not_verified", items: [{ kind: "verifiable_credential", summary: { types: ["FarmerCredential"] } }], ...totals };
vi.mock("../lib/api", () => ({ api: { importCapture: vi.fn(), captureCoverage: vi.fn(async () => ({})) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("refreshes coverage when live bridge exchanges arrive outside the upload control", async () => {
  const row = { stepKey: "PRESENT_SUBMIT", state: "missing", count: 0, reason: "Not yet observed", projection: totals };
  vi.mocked(api.captureCoverage).mockResolvedValueOnce({ coverage: [row] }).mockResolvedValueOnce({ coverage: [{ ...row, state: "captured", count: 1, reason: "Live bridge observation" }] });
  const { rerender } = render(<CaptureCoverage runId="run" exchangeCount={0} onImported={vi.fn()} />);
  await screen.findByText("PRESENT_SUBMIT: missing");
  rerender(<CaptureCoverage runId="run" exchangeCount={1} onImported={vi.fn()} />);
  expect(await screen.findByText("PRESENT_SUBMIT: captured")).toBeTruthy();
  expect(api.importCapture).not.toHaveBeenCalled();
});
it("renders public names, authenticity, counters, capture reason and unknown timing", () => {
  render(<PublicEvidence label="Request" value={{ publicView: view, capture: { schemaVersion: 1, ruleId: "certify-credential", why: "Explicit credential endpoint", redactionCount: 4, timingKnown: false } }} />);
  expect(screen.getByText(/FarmerCredential/)).toBeTruthy();
  expect(screen.getByText(/Authenticity: not_verified/)).toBeTruthy();
  expect(screen.getByText(/Withheld names: 2/)).toBeTruthy();
  expect(screen.getByText(/Redacted paths: 4/)).toBeTruthy();
  expect(screen.getByText(/timing unknown/)).toBeTruthy();
});
it("explains unsupported formats and rejects absent/malformed/versioned envelopes", () => {
  const { rerender } = render(<PublicEvidence label="Response" value={{ publicView: { ...view, items: [] } }} />);
  expect(screen.getByText("Format not decoded")).toBeTruthy();
  rerender(<PublicEvidence label="Response" value={{ publicView: { ...view, schemaVersion: 2 } }} />);
  expect(screen.getByText(/unavailable or unsupported/)).toBeTruthy();
  for (const value of [null, [], { ...view, unsupportedKinds: -1 }, { ...view, authenticity: "verified" }, { ...view, items: [{ kind: "unknown", summary: {} }] }]) expect(publicView(value)).toBeNull();
  expect(coverage([{ stepKey: "STORE", state: "failed", count: 0, reason: "", projection: totals }])).toBeNull();
});
it("renders server coverage without turning gaps into failures and notifies refresh", async () => {
  vi.mocked(api.importCapture).mockResolvedValue({ coverage: [
    { stepKey: "ISSUE_CREDENTIAL", state: "captured", count: 1, reason: "Browser request observed", projection: totals },
    { stepKey: "STORE", state: "not_observable", count: 0, reason: "Wallet-local operation", projection: totals },
    { stepKey: "PRESENT_SUBMIT", state: "missing", count: 0, reason: "No matching traffic", projection: totals },
  ] });
  const refreshed = vi.fn();
  render(<CaptureCoverage runId="run" onImported={refreshed} />);
  const file = { size: 30, text: async () => JSON.stringify({ runId: "run", har: { log: { entries: [] } } }) };
  fireEvent.change(screen.getByLabelText(/Synthetic capture JSON/), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Import synthetic capture" }));
  expect(await screen.findByText("PRESENT_SUBMIT: missing")).toBeTruthy();
  expect(screen.getByText("STORE: not_observable")).toBeTruthy();
  expect(screen.getByText(/Withheld names: 6/)).toBeTruthy();
  expect(screen.getByText(/Missing is an observation gap/)).toBeTruthy();
  expect(refreshed).toHaveBeenCalledOnce();
});
it.each(["wrong-run", "oversized", "malformed", "server-error"])("handles %s imports without exposing bodies", async (mode) => {
  vi.mocked(api.importCapture).mockRejectedValue(new Error("CANARY_UPSTREAM_BODY"));
  render(<CaptureCoverage runId="run" onImported={vi.fn()} />);
  const file = { size: mode === "oversized" ? 2_000_001 : 10, text: async () => mode === "malformed" ? "CANARY_RAW_BODY" : JSON.stringify({ runId: mode === "wrong-run" ? "other" : "run" }) };
  fireEvent.change(screen.getByLabelText(/Synthetic capture JSON/), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Import synthetic capture" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/rejected/));
  expect(document.body.textContent).not.toMatch(/CANARY/);
  if (mode !== "server-error") expect(api.importCapture).not.toHaveBeenCalled();
});

it("does not overwrite imported coverage with an older delayed initial read", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api.captureCoverage).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const row = { stepKey: "ISSUE_CREDENTIAL", state: "captured", count: 1, reason: "New import", projection: totals };
  vi.mocked(api.importCapture).mockResolvedValueOnce({ coverage: [row] });
  render(<CaptureCoverage runId="run" onImported={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Synthetic capture JSON/), { target: { files: [{ size: 20, text: async () => JSON.stringify({ runId: "run" }) }] } });
  fireEvent.click(screen.getByRole("button", { name: "Import synthetic capture" }));
  await screen.findByText("ISSUE_CREDENTIAL: captured");
  await act(async () => { resolve({ coverage: [{ ...row, state: "missing", count: 0, reason: "Old snapshot" }] }); });
  expect(screen.getByText("ISSUE_CREDENTIAL: captured")).toBeTruthy();
  expect(screen.queryByText("Old snapshot")).toBeNull();
});
it("keeps canonical server observations separate from missing browser traffic", async () => {
  vi.mocked(api.captureCoverage).mockResolvedValueOnce({ coverage: [{ stepKey: "PRESENT_SUBMIT", state: "missing", count: 0, reason: "No browser traffic", projection: totals }], serverHops: [
    { ruleId: "verify-submit", state: "observed", actorFrom: "mimoto", actorTo: "verify", exchangeIds: ["7c40f6a3-7a7e-43b7-806c-67d7bfeec00e"] },
    { ruleId: "verify-request-fetch", state: "not_observed", actorFrom: "mimoto", actorTo: "verify", exchangeIds: [] },
  ] });
  render(<CaptureCoverage runId="run" onImported={vi.fn()} />);
  expect(await screen.findByText("verify-submit: observed")).toBeTruthy();
  expect(screen.getByText("PRESENT_SUBMIT: missing")).toBeTruthy();
  expect(screen.getByText("verify-request-fetch: not_observed")).toBeTruthy();
  expect(screen.getByText("7c40f6a3-7a7e-43b7-806c-67d7bfeec00e")).toBeTruthy();
  expect(screen.getByText(/An observed HTTP exchange does not establish/)).toBeTruthy();
});
