// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WalletEvidencePanel } from "./WalletEvidencePanel";
const evidence = (mobile: boolean) => ({ id: mobile ? "a2" : "a1", wallet: mobile ? "inji_mobile" : "inji_web", walletLabel: mobile ? "Inji Wallet Android (real wallet)" : "Inji Web (real wallet)", format: mobile ? "vc_sd_jwt" : "ldp_vc", credential: mobile ? "Mobile identity" : "Registration Receipt", observedDate: "2026-10-23", outcomeSource: mobile ? "correlated_verifier_response" : "verifier_ui", reviewStatus: mobile ? "recorded_manual_acceptance" : "pending_integrator_review", deployment: "Recorded deployment only", versions: { issuer: "unreported", wallet: "unreported", verifier: "unreported" }, checkpoints: [{ name: "Persistent storage", evidence: mobile ? "user_confirmed" : "observed", detail: "Recorded provenance" }], limitations: ["Managed validation pending"], artifacts: [] });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows real-wallet results, review, provenance, filters and report links", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 1, items: [evidence(false), evidence(true)] }) })));
  render(<WalletEvidencePanel />);
  expect(await screen.findByRole("heading", { name: "Inji Web (real wallet) · JSON-LD" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Inji Wallet Android (real wallet) · SD-JWT" })).toBeTruthy();
  expect(screen.getByText("A1 integrator review pending")).toBeTruthy();
  expect(screen.getByText("Persistent storage · user confirmed:")).toBeTruthy();
  expect(screen.getAllByText(/Managed run: none/)).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Evidence report · CSV" }).getAttribute("href")).toBe("/api/v1/wallet-evidence/report?format=csv");
  fireEvent.change(screen.getByRole("combobox", { name: "Wallet evidence" }), { target: { value: "inji_mobile" } });
  expect(screen.queryByRole("heading", { name: "Inji Web (real wallet) · JSON-LD" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Inji Wallet Android (real wallet) · SD-JWT" })).toBeTruthy();
});
it("withholds compatibility conclusions when evidence is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  render(<WalletEvidencePanel />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Real-wallet evidence is unavailable. No compatibility conclusion can be drawn.");
  expect(screen.queryByText(/Observed outcome: Valid/)).toBeNull();
});
