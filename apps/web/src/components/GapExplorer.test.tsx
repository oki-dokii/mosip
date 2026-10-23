// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GapExplorer } from "./GapExplorer";

it("presents evidence-backed findings without promoting them to confirmed upstream defects", () => {
  render(<GapExplorer />);
  expect(screen.getByRole("heading", { name: "What the evidence has revealed" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText(/No upstream issue has been filed/)).toBeTruthy();
  expect(screen.getByText(/An unreported service version or missing wallet account/)).toBeTruthy();
  const links = screen.getAllByRole("link");
  expect(links.some((link) => link.getAttribute("href")?.endsWith("/GAPS.md"))).toBe(true);
  expect(links.every((link) => link.getAttribute("href")?.startsWith("https://github.com/oki-dokii/mosip/blob/main/"))).toBe(true);
});
