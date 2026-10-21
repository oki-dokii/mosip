import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.MOCK_VERIFIER_NO_LISTEN = "1";
  const module = await import("./server.js");
  server = module.mockVerifierServer;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.MOCK_VERIFIER_NO_LISTEN;
});

describe("standalone OpenID4VP mock verifier", () => {
  it("creates a request, tracks pending status, and rejects invalid submission state", async () => {
    const created = await fetch(`${baseUrl}/vp-request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format: "dc+sd-jwt" }) });
    expect(created.status).toBe(201);
    const request = await created.json();
    const status = await fetch(`${baseUrl}/status/${request.requestId}`).then((response) => response.json());
    expect(status.status).toBe("PENDING");
    const invalid = await fetch(`${baseUrl}/direct-post`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ state: "wrong", vp_token: "{}" }) });
    expect(invalid.status).toBe(400);
    const premature = await fetch(`${baseUrl}/result/${request.requestId}`);
    expect(premature.status).toBe(409);
  });
});
