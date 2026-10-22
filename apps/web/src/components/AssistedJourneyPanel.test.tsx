// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAssistedFixture } from "../lib/assistedFixture";
import { AssistedJourneyPanel } from "./AssistedJourneyPanel";
import { RoleSelector } from "./RoleSelector";

let fixture: ReturnType<typeof createAssistedFixture>;
beforeEach(() => { vi.useFakeTimers(); fixture = createAssistedFixture("fixture-run"); });
afterEach(() => { cleanup(); fixture.journey.dispose(); if (vi.isFakeTimers()) expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
it("renders truthful instructions and a valid completion only after the verifier result", () => {
  render(<React.StrictMode><AssistedJourneyPanel fixture={fixture} /></React.StrictMode>);
  expect(screen.getByRole("status").textContent).toMatch(/Waiting for issuance evidence/);
  expect(screen.getByText(/A1 blocked/)).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toMatch(/60 seconds/);
  act(() => vi.advanceTimersByTime(101));
  click("Simulate issuance observation");
  expect(screen.getByRole("timer").textContent).toMatch(/60 seconds/);
  expect(screen.getByRole("status").textContent).toMatch(/storage is still unconfirmed/);
  click("Simulate wallet storage confirmation");
  expect(screen.getByText(/not a usable live QR/)).toBeTruthy();
  click("Simulate presentation observation");
  expect(screen.getByRole("status").textContent).toMatch(/Waiting for the normalized/);
  click("Simulate valid verifier result");
  expect(screen.getByRole("status").textContent).toMatch(/Simulated verifier result: valid/);
  expect(screen.queryByRole("button", { name: "Cancel assisted run" })).toBeNull();
});
it("renders invalid as a verifier result, separate from observation errors", () => {
  render(<AssistedJourneyPanel fixture={fixture} />);
  click("Simulate issuance observation"); click("Simulate wallet storage confirmation"); click("Simulate presentation observation"); click("Simulate invalid verifier result");
  expect(screen.getByRole("status").textContent).toMatch(/Simulated verifier result: invalid/);
});
it.each(["cancel", "timeout", "error"])("shows %s without claiming credential rejection", (reason) => {
  render(<AssistedJourneyPanel fixture={fixture} />);
  if (reason === "cancel") click("Cancel assisted run");
  if (reason === "error") click("Simulate observation error");
  if (reason === "timeout") act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole("status").textContent).toMatch(/No verifier verdict|Verification was not established/);
  expect(screen.queryByText(/Simulated verifier result:/)).toBeNull();
});
it("supports keyboard cancellation", async () => {
  vi.useRealTimers();
  const user = userEvent.setup();
  render(<AssistedJourneyPanel fixture={fixture} />);
  await user.tab(); await user.tab(); await user.tab(); await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel assisted run" }));
  await user.keyboard("{Enter}");
  expect(screen.getByRole("status").textContent).toMatch(/cancelled/i);
});
it("labels the real wallets and disables unavailable SD-JWT presentation", () => {
  const onChange = vi.fn();
  render(<RoleSelector role="wallet" label="Wallet" value="reference_wallet" onChange={onChange} options={[
    { id: "reference_wallet", name: "Reference Wallet", kind: "reference", description: "Automated, code-level driver" },
    { id: "inji_web_assisted", name: "Inji Web (Assisted)", kind: "inji", description: "SD-JWT Web presentation unavailable", disabled: true },
  ]} />);
  expect((screen.getByRole("radio", { name: /Inji Web/ }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText("Automated, code-level driver")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Inji Web/ }).getAttribute("aria-describedby")).toBeTruthy();
});

it("renders fixture wallet, offer and verifier actions without advancing checkpoints", () => {
  vi.useRealTimers();
  render(<AssistedJourneyPanel fixture={fixture} />);
  const wallet = screen.getByRole("link", { name: "Open wallet" });
  const offer = screen.getByRole("link", { name: "Open credential offer" });
  expect(wallet.getAttribute("href")).toBe(`#${fixture.target}-wallet`);
  expect(offer.getAttribute("href")).toBe(`#${fixture.target}-offer`);
  fireEvent.click(wallet); fireEvent.click(offer);
  expect(fixture.journey.getSnapshot().stage).toBe("issuance");
  click("Simulate issuance observation"); click("Simulate wallet storage confirmation");
  expect(screen.queryByRole("link", { name: "Open wallet" })).toBeNull();
  expect(screen.getByRole("link", { name: /Open verifier request/ }).getAttribute("href")).toBe(`#${fixture.target}-request`);
  click("Cancel assisted run");
  expect(screen.queryByRole("navigation", { name: "Wallet journey actions" })).toBeNull();
});
it("accepts transient configured HTTPS actions and renders absent or unsafe actions unavailable", () => {
  vi.useRealTimers();
  const { rerender } = render(<AssistedJourneyPanel fixture={fixture} actions={{ walletUrl: "https://wallet.example/", offerUrl: "javascript:alert(1)" }} />);
  expect(screen.getByRole("link", { name: "Open wallet" }).getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("link", { name: "Open credential offer" })).toBeNull();
  expect(screen.getByText("Open credential offer: unavailable")).toBeTruthy();
  rerender(<AssistedJourneyPanel fixture={fixture} actions={{}} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.getByText("Open wallet: unavailable")).toBeTruthy();
});
