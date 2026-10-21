import { randomUUID } from "node:crypto";
import type { RunSummary } from "@playground/shared";
import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { createSteps } from "../orchestrator.js";
import { prepareHarImport } from "./har.js";
import { decodePublicProtocol } from "./public-view.js";
import { adversarialCorpus, credentialCanaries, harEntry } from "./fixtures/adversarial.js";

const origins = new Map([["https://issuer.example", "certify"], ["https://verifier.example", "verify"]] as const);
function importEntry(entry: unknown) {
  const run = { id: randomUUID(), status: "passed" } as RunSummary;
  return prepareHarImport({ runId: run.id, har: { log: { entries: [entry] } } }, { run, steps: createSteps(run.id), exchanges: [] }, origins);
}

describe("permanent adversarial HAR corpus", () => {
  for (const specimen of adversarialCorpus()) {
    it(specimen.name, () => {
      const result = importEntry(specimen.entry);
      expect(result.exchanges).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("CANARY_");
      expect(JSON.stringify(result).length).toBeLessThan(20_000);
      if (specimen.name === "gzip-bytes" || specimen.name === "compressed-expansion") {
        // HAR commonly exports decompressed text. Compressed bytes stay opaque, never inflated.
        expect(result.exchanges[0]?.response).toMatchObject({ body: "[REDACTED: malformed JSON]" });
      }
    });
  }
  it("decodes a signed SD-JWT and full VC without exposing subject, disclosure, or token values", async () => {
    const { token, jwt, publicKey, vc, forbidden } = await credentialCanaries();
    await jwtVerify(jwt, publicKey); // Ensure the test isn't just malformed-token rejection.
    const body = { credential: token, vp_token: token, credentials: [vc] };
    const projection = decodePublicProtocol(body, origins);
    expect(projection.items.map((item) => item.kind)).toContain("sd_jwt");
    expect(projection.items.map((item) => item.kind)).toContain("verifiable_credential");
    const captured = importEntry(harEntry(body));
    for (const secret of forbidden) {
      expect(JSON.stringify(projection)).not.toContain(secret);
      expect(JSON.stringify(captured)).not.toContain(secret);
    }
  });
});
