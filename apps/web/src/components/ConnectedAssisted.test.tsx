// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectedAssisted } from "./ConnectedAssisted";
import { api } from "../lib/api";
import type { RunConfig } from "@playground/shared";
vi.mock("../lib/api", () => ({ api: { assistedCapabilities: vi.fn(async () => ({ liveAvailable: false })), assistedStatus: vi.fn() } }));
const config: RunConfig = { issuer: "inji_certify", wallet: "inji_web_assisted", verifier: "inji_verify", format: "ldp_vc", flow: "cross_device", tamper: null, scenarioId: null };
function snapshot(id: string, status: string): any { return { run: { id, status, actualOutcome: status === "passed" ? "valid" : null, serviceVersions: { wallet: "fixture/1" } }, steps: [], actions: {}, deadlineAt: null }; }
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("never overlaps status reads and stops after a terminal response", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(api.assistedStatus).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce(snapshot("run", "passed"));
  render(<ConnectedAssisted config={config} onRun={vi.fn()} resumeId="run" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(api.assistedStatus).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(snapshot("run", "running")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(screen.getByRole("status").textContent).toContain("Verifier outcome: valid");
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(api.assistedStatus).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it("ignores responses from an earlier selected run", async () => {
  let resolve!: (value: any) => void;
  vi.mocked(api.assistedStatus).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce(snapshot("new", "passed"));
  const { rerender } = render(<ConnectedAssisted config={config} onRun={vi.fn()} resumeId="old" />);
  await act(async () => { rerender(<ConnectedAssisted config={config} onRun={vi.fn()} resumeId="new" />); });
  await act(async () => { resolve(snapshot("old", "running")); });
  expect(screen.getByRole("status").textContent).toContain("Backend run: new");
  expect(screen.getByRole("status").textContent).toContain("Verifier outcome: valid");
});
