import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { filterHar } from "./filter.js";
import { decodePublicProtocol } from "./public-view.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/four-service.synthetic.har.json", import.meta.url), "utf8"));
const origins = new Map([["https://issuer.example", "certify"]] as const);
it("withholds randomly generated credential values in the decoder and filter", () => {
  for (let depth = 0; depth < 32; depth++) {
    const secret = randomUUID();
    let value: unknown = secret;
    for (let level = 0; level < depth; level++) value = level % 2 ? { name: value } : [value];
    const credential = {type:["VerifiableCredential"], credentialSubject:{fullName:value}};
    const view = decodePublicProtocol({credential},origins);
    expect(JSON.stringify(view)).not.toContain(secret);
    const entry = structuredClone(fixture.har.log.entries.find((e: {request:{url:string}}) => e.request.url.startsWith("https://issuer.example")));
    entry.response.content = {mimeType:"application/json",text:JSON.stringify({credential})};
    const filtered = filterHar({log:{entries:[entry]}},fixture.runId,origins);
    expect(filtered.report.outputEntries).toBe(1);
    expect(JSON.stringify(filtered)).not.toContain(secret);
  }
});
