// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { api } from "./lib/api";
import { AssistedJourney } from "./lib/assistedJourney";

vi.mock("./lib/api", () => ({ api: {
  assistedCapabilities: vi.fn(async () => ({ liveAvailable: false })),
  metadata: vi.fn(async () => ({
    issuers: [{ id: "inji_certify", name: "Inji Certify", kind: "inji" }],
    wallets: [{ id: "reference_wallet", name: "Reference Wallet", kind: "reference" }, { id: "inji_web_assisted", name: "Inji Web", kind: "inji" }],
    verifiers: [{ id: "inji_verify", name: "Inji Verify", kind: "inji" }],
    formats: [{ id: "ldp_vc", name: "JSON-LD", proofType: "Ed25519Signature2020", algorithm: "EdDSA" }, { id: "vc_sd_jwt", name: "SD-JWT", proofType: "kb+jwt", algorithm: "EdDSA" }],
  })),
  scenarios: vi.fn(async () => ({ items: [] })), health: vi.fn(async () => ({ driverMode: "fixture", storage: "memory" })),
  runs: vi.fn(async () => ({ items: [] })), matrix: vi.fn(async () => ({ items: [] })),
  createRun: vi.fn(async () => { throw new Error("network unavailable"); }),
} }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ schemaVersion: 1, items: [] }) }))); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
async function configure() {
  render(<React.StrictMode><App /></React.StrictMode>);
  await screen.findByRole("button", { name: "JSON-LD" });
  click("JSON-LD");
  fireEvent.click(screen.getByRole("radio", { name: /Inji Web/ }));
}
it("starts an isolated fixture rather than calling the automated BFF wallet path", async () => {
  await configure();
  click("Start assisted fixture run");
  expect(screen.getByRole("region", { name: "Assisted Inji Web fixture journey" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Simulate issuance observation" })).toBeTruthy();
  expect(api.createRun).not.toHaveBeenCalled();
  const dispose = vi.spyOn(AssistedJourney.prototype, "dispose");
  click("Cancel assisted run"); click("Start assisted fixture run");
  expect(dispose).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Simulate issuance observation" })).toBeTruthy();
  dispose.mockClear(); cleanup();
  expect(dispose).toHaveBeenCalled();
});
it("blocks an unsupported format after selection and re-enables JSON-LD", async () => {
  await configure();
  click("SD-JWT");
  expect((screen.getByRole("button", { name: "Start assisted fixture run" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toMatch(/SD-JWT Web presentation is unavailable/);
  click("JSON-LD");
  expect((screen.getByRole("button", { name: "Start assisted fixture run" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.change(screen.getByRole("combobox", { name: "Fault" }), { target: { value: "bad_signature" } });
  expect((screen.getByRole("button", { name: "Start assisted fixture run" }) as HTMLButtonElement).disabled).toBe(true);
});
it("preserves the Reference Wallet route and displays start errors", async () => {
  render(<App />);
  const start = await screen.findByRole("button", { name: "Run flow" });
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(start);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Could not start the run. Please try again.");
  expect(api.createRun).toHaveBeenCalledWith(expect.objectContaining({ wallet: "reference_wallet" }));
});
