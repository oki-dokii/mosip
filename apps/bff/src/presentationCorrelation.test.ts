import { expect, it } from "vitest";
import type { Exchange } from "@playground/shared";
import { matchesPresentation, webPresentationLink } from "./presentationCorrelation.js";
import { maskedValue, runCorrelationKey } from "./redaction.js";
it("requires the same run-scoped verifier state tag and origin, withholding raw state", () => {
  const state = "synthetic-verifier-request-state-000000000001";
  const tag = maskedValue(state, "$.request.body.state", runCorrelationKey("run1"));
  const exchange = { url: "https://verify.example/direct-post/{id}", request: { body: { state: tag } } } as unknown as Exchange;
  expect(tag).not.toContain(state);
  expect(matchesPresentation(exchange, tag, "https://verify.example/api")).toBe(true);
  expect(matchesPresentation(exchange, undefined, "https://verify.example")).toBe(false);
  expect(matchesPresentation(exchange, "[REDACTED]", "https://verify.example")).toBe(false);
  expect(matchesPresentation(exchange, maskedValue(state, "$.request.body.state", runCorrelationKey("other-run")), "https://verify.example")).toBe(false);
  expect(matchesPresentation(exchange, tag, "https://other.example")).toBe(false);
  expect(matchesPresentation({ ...exchange, request: { body: { state: "[REDACTED]" } } }, tag, "https://verify.example")).toBe(false);
});

it("requires an explicitly configured HTTPS Web handoff with an encoded request reference", () => {
  const request = "openid4vp://authorize?request_uri=https%3A%2F%2Fverify.example%2Frequest%3Fa%3D1%26b%3D2";
  const link = webPresentationLink("https://wallet.example/present?request_uri={request_uri}", request);
  expect(new URL(link!).searchParams.get("request_uri")).toBe("https://verify.example/request?a=1&b=2");
  expect(webPresentationLink(undefined, request)).toBeNull();
  expect(webPresentationLink("javascript:{request_uri}", request)).toBeNull();
  expect(webPresentationLink("https://wallet.example/", request)).toBeNull();
});
