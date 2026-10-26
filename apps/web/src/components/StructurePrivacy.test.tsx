// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Exchange } from "@playground/shared";
import { Inspector } from "./Inspector";
import { publicStructure } from "../lib/publicStructure";
const projection = (items: unknown[]) => ({ body: { credentialSubject: { secret_name: "private-value" } }, publicView: { schemaVersion: 1, authenticity: "not_verified", withheldNames: 2, truncatedItems: 1, unsupportedKinds: 0, items } });
afterEach(cleanup);
it("shows only allowlisted names and shape, including inside expandable details", () => {
  const value = projection([{ kind: "sd_jwt", summary: { claimNames: ["given_name", "secret_name"], disclosureNames: ["family_name"], credential: "private-value", header: { alg: "EdDSA", token: "private-value" } } }, { kind: "dcql", summary: { credentials: [{ claims: [{ path: ["credentialSubject", "[REDACTED]", "email"] }, { path: ["credentialSubject", "birthdate"] }] }] } }]);
  render(<Inspector exchange={{ id: "e", runId: "r", stepId: "s", seq: 1, actorFrom: "wallet", actorTo: "verify", method: "POST", url: "https://verifier.example/present", status: 200, durationMs: 1, request: value, response: null, redactions: [] } as Exchange} />);
  expect(screen.getByText("given_name")).toBeTruthy();
  expect(screen.getByText("credentialSubject → birthdate")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/secret_name|private-value|→ email/);
  expect(screen.getByText(/Withheld names: 2/)).toBeTruthy();
  expect(screen.getByText(/Authenticity: not_verified/)).toBeTruthy();
});
it("explains unavailable JSON-LD names and rejects malformed or unrecognized projections", () => {
  const result = publicStructure(projection([{ kind: "verifiable_credential", summary: { types: ["FarmerCredential"], credentialSubject: { name: "private-value" } } }]));
  expect(JSON.stringify(result)).toContain("Claim names are unavailable");
  expect(JSON.stringify(result)).not.toContain("private-value");
  expect(publicStructure({ credential: "raw.token.value" })).toBeNull();
  expect(publicStructure(projection([{ kind: "unknown", summary: {} }]))).toBeNull();
});
it("renders canonical JSON-LD subject names and wildcard paths without reading bodies or values", () => {
  const value = projection([{ kind: "verifiable_credential", summary: { types: ["FarmerCredential"], subject: { names: ["fullName", "farmerID", "streetAddress"], paths: ["$.credentialSubject.fullName", "$.credentialSubject.address[*].streetAddress"], withheldNames: 2, truncatedItems: 3, fullName: "CANARY_PRIVATE_VALUE" } } }]);
  render(<Inspector exchange={{ id: "e", runId: "r", stepId: "s", seq: 1, actorFrom: "mimoto", actorTo: "certify", method: "POST", url: "https://issuer.example/credential", status: 200, durationMs: 1, request: null, response: value, redactions: [] } as Exchange} />);
  expect(screen.getByText("fullName, farmerID, streetAddress")).toBeTruthy();
  expect(screen.getByText("$.credentialSubject.fullName, $.credentialSubject.address[*].streetAddress")).toBeTruthy();
  expect(screen.getByText("Subject withheld names")).toBeTruthy();
  expect(screen.getByText("Subject truncated items")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/private-value|CANARY/);
  expect(screen.getByText(/HTTP status describes transport only/)).toBeTruthy();
});
it("withholds lookalikes, unknown segments and injected values even in expanded structure", () => {
  const result = publicStructure(projection([{ kind: "verifiable_credential", summary: { subject: { names: ["name", "nаme", "CANARY_NAME"], paths: ["$.credentialSubject.name", "$.credentialSubject.CANARY_PATH.email", "$.credentialSubject.address[0].name", "$.credentialSubject.name<script>"], withheldNames: 5, truncatedItems: 1 } } }]));
  expect(JSON.stringify(result)).toContain("$.credentialSubject.name");
  expect(JSON.stringify(result)).not.toMatch(/CANARY|nаme|script|\[0\]/);
});
it("distinguishes absent, empty and malformed JSON-LD projections", () => {
  const subject = { names: [], paths: [], withheldNames: 0, truncatedItems: 0 };
  expect(JSON.stringify(publicStructure(projection([{ kind: "verifiable_credential", summary: { subject } }])))).toContain("does not prove the credential has no claims");
  expect(JSON.stringify(publicStructure(projection([{ kind: "verifiable_credential", summary: { subject: { ...subject, withheldNames: -1 } } }])))).toContain("Claim names are unavailable");
});
