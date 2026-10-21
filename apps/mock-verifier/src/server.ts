import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { verifyPresentation } from "./verify.js";

const port = Number(process.env.MOCK_VERIFIER_PORT ?? 4102);
const publicBaseUrl = process.env.MOCK_VERIFIER_PUBLIC_URL ?? `http://127.0.0.1:${port}`;
const requests = new Map<string, { claims: { client_id: string; nonce: string; state: string; response_uri: string }; token: string | null }>();

function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function input(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 65_536) throw new Error("Request too large");
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return request.headers["content-type"]?.includes("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(text))
    : JSON.parse(text || "{}");
}

export const mockVerifierServer = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/vp-request") {
      const body = await input(request);
      if (body.format !== "dc+sd-jwt") return send(response, 400, { error: "unsupported_format" });
      const id = randomUUID();
      const claims = { client_id: "mock-verifier", nonce: randomUUID(), state: randomUUID(), response_uri: `${publicBaseUrl}/direct-post` };
      requests.set(id, { claims, token: null });
      return send(response, 201, { requestId: id, claims });
    }
    if (request.method === "POST" && request.url === "/direct-post") {
      const form = await input(request);
      const entry = [...requests.values()].find((item) => item.claims.state === form.state);
      if (!entry || entry.token) return send(response, 400, { error: "invalid_state" });
      const vpToken = JSON.parse(form.vp_token ?? "{}");
      const token = vpToken.credential?.[0];
      if (typeof token !== "string") return send(response, 400, { error: "invalid_vp_token" });
      entry.token = token;
      return send(response, 200, { accepted: true });
    }
    const status = request.url?.match(/^\/status\/([0-9a-f-]+)$/);
    if (request.method === "GET" && status) {
      const entry = requests.get(status[1] ?? "");
      return entry ? send(response, 200, { status: entry.token ? "VP_SUBMITTED" : "PENDING" }) : send(response, 404, { error: "not_found" });
    }
    const result = request.url?.match(/^\/result\/([0-9a-f-]+)$/);
    if (request.method === "GET" && result) {
      const entry = requests.get(result[1] ?? "");
      if (!entry) return send(response, 404, { error: "not_found" });
      if (!entry.token) return send(response, 409, { error: "not_submitted" });
      try { return send(response, 200, await verifyPresentation(entry.token, entry.claims)); }
      catch (error) { return send(response, 200, { outcome: "invalid", failureDetail: error instanceof Error ? error.message : "Verification failed" }); }
    }
    send(response, 404, { error: "not_found" });
  } catch {
    send(response, 400, { error: "invalid_request" });
  }
});

if (process.env.MOCK_VERIFIER_NO_LISTEN !== "1") {
  mockVerifierServer.listen(port, "127.0.0.1", () => console.log(`Mock verifier listening on http://127.0.0.1:${port}`));
}
