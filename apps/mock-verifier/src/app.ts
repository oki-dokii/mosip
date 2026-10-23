import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { failure, Rejection, type VerificationResult } from "./diagnostics.js";
import { InputError, object, parseJson, readInput, send } from "./http.js";
import { flatProfile, parsePolicy, type Policy } from "./profile.js";
import { verifyPresentation } from "./verify.js";

type Claims = { client_id: string; nonce: string; state: string; response_uri: string };
interface Challenge {
  claims: Claims; policy: Policy; expiresAt: number;
  status: "PENDING" | "SUBMITTED" | "COMPLETE" | "ERROR" | "EXPIRED";
  cleanupAt: number; result?: VerificationResult; verification?: Promise<void>;
}
export function createMockVerifier(options: {
  publicBaseUrl: () => string; now?: () => number; ttlSeconds?: number; capacity?: number;
  verify?: typeof verifyPresentation;
}) {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const requests = new Map<string, Challenge>(), states = new Map<string, string>();
  function sweep(time: number) {
    for (const [id, entry] of requests) {
      if (entry.status === "PENDING" && time >= entry.expiresAt) { entry.status = "EXPIRED"; entry.cleanupAt = entry.expiresAt + 300; }
      if (entry.status !== "SUBMITTED" && time >= entry.cleanupAt) { requests.delete(id); states.delete(entry.claims.state); }
    }
  }
  return createServer(async (request, response) => {
    try {
      const time = now(); sweep(time);
      if (request.method === "POST" && request.url === "/vp-request") {
        const policy = parsePolicy(await readInput(request, 65_536));
        const createdAt = now(); sweep(createdAt);
        if (requests.size >= (options.capacity ?? 1024)) throw new InputError(503, "capacity_exceeded");
        const id = randomUUID();
        const claims = Object.freeze({ client_id: "mock-verifier", nonce: randomUUID(), state: randomUUID(), response_uri: `${options.publicBaseUrl()}/direct-post` });
        const expiresAt = createdAt + (options.ttlSeconds ?? 120);
        requests.set(id, { claims, policy, expiresAt, cleanupAt: expiresAt + 300, status: "PENDING" }); states.set(claims.state, id);
        return send(response, 201, { requestId: id, claims, policy });
      }
      if (request.method === "POST" && request.url === "/direct-post") {
        const form = await readInput(request, 65_536);
        if (Object.hasOwn(form, "presentation_submission")) throw new Rejection("UNSUPPORTED_PRESENTATION_SUBMISSION");
        if (Object.keys(form).some((name) => name !== "state" && name !== "vp_token") || typeof form.state !== "string" || typeof form.vp_token !== "string") throw new Rejection("INVALID_VP_TOKEN");
        const envelope = parseJson(form.vp_token);
        if (!object(envelope) || Object.keys(envelope).length !== 1 || !Array.isArray(envelope.credential) || envelope.credential.length !== 1 || typeof envelope.credential[0] !== "string" || !envelope.credential[0] || Buffer.byteLength(envelope.credential[0]) > 32_768) throw new Rejection("INVALID_VP_TOKEN");
        const token = envelope.credential[0];
        const acceptedAt = now(); sweep(acceptedAt);
        const id = states.get(form.state), entry = id ? requests.get(id) : undefined;
        if (entry?.status === "EXPIRED") throw new Rejection("REQUEST_EXPIRED");
        if (!entry || entry.status !== "PENDING") throw new Rejection("INVALID_STATE");
        entry.status = "SUBMITTED"; // Claim synchronously before invoking asynchronous verification.
        entry.verification = Promise.resolve().then(() => (options.verify ?? verifyPresentation)(token, entry.claims, entry.policy, acceptedAt)).then((result) => {
          entry.result = result; entry.status = "COMPLETE"; entry.cleanupAt = now() + 300;
        }, () => { entry.status = "ERROR"; entry.cleanupAt = now() + 300; });
        return send(response, 200, { accepted: true });
      }
      const match = request.url?.match(/^\/(status|result)\/([0-9a-f-]+)$/);
      if (request.method === "GET" && match) {
        const entry = requests.get(match[2]!);
        if (!entry) throw new InputError(404, "not_found");
        if (match[1] === "status") return send(response, 200, { status: entry.status === "PENDING" ? "PENDING" : entry.status === "EXPIRED" ? "EXPIRED" : entry.status === "ERROR" ? "ERROR" : "VP_SUBMITTED" });
        if (entry.status === "EXPIRED") throw new InputError(410, "request_expired");
        if (entry.status === "PENDING") throw new InputError(409, "not_submitted");
        // Default clients historically expect a final GET response. Strict-profile clients poll 202.
        if (entry.status === "SUBMITTED" && entry.policy.profile !== flatProfile) await entry.verification;
        if (entry.status === "SUBMITTED") return send(response, 202, { status: "VERIFYING" });
        if (entry.status === "ERROR") throw new InputError(500, "verification_error");
        return send(response, 200, entry.result);
      }
      send(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof Rejection) send(response, 400, { error: error.code === "INVALID_STATE" ? "invalid_state" : "invalid_request", diagnosticsVersion: 1, failure: failure(error.code, "direct_post") });
      else if (error instanceof InputError) send(response, error.status, { error: error.code });
      else send(response, 500, { error: "verification_error" });
    }
  });
}
