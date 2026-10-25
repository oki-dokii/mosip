import { afterEach, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Exchange } from "@playground/shared";
import fixture from "../../../../spikes/person2-web/local-profile.json";
import catalog from "../../../../spikes/person2-web/mimoto-issuers.template.json";
import { loadProfile, localOrigin, readSyntheticPasscode, validateProfile } from "./profile";
import { browserCaptureReferences } from "./capture-contract";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

it("keeps published endpoints and pins separate from unconfirmed JSON-LD integration", async () => {
  const profile = await loadProfile();
  expect(profile.walletOrigin).toBe("http://127.0.0.1:18093");
  expect(profile.versions).toEqual({ web: "0.17.0", mimoto: "0.22.0", certify: "1.0.0-alpha.1", verify: "0.18.2" });
  expect(profile.integrationReady).toBe(false);
  expect(profile.jsonLd.credentialConfigurationId).toBeNull();
  expect(profile.captureProxy).toBeNull();
});
it.each(["https://injiweb.collab.mosip.net", "http://localhost.evil.test", "http://127.0.0.2", "file:///tmp/test", "http://user:secret@127.0.0.1", "http://127.0.0.1/?state=private", "http://127.0.0.1/path"])("rejects noncanonical/nonlocal profile origins: %s", value => {
  expect(() => localOrigin(value)).toThrow("PERSON2_LOCAL_ORIGIN_INVALID");
});
it("allows explicit loopback port overrides but discards unknown payload fields", () => {
  const profile = validateProfile({ ...fixture, walletOrigin: "http://localhost:19093/", credential: "SYNTHETIC_CANARY_VALUE" });
  expect(profile.walletOrigin).toBe("http://localhost:19093");
  expect(JSON.stringify(profile)).not.toContain("SYNTHETIC_CANARY_VALUE");
  expect(() => validateProfile({ ...fixture, integrationReady: true })).toThrow("PERSON2_PHASE1_PROFILE_INVALID");
});
it("provides a disabled upstream-shaped catalog rather than an invented working issuer", () => {
  const issuer = catalog.issuers[0]!;
  expect(issuer).toMatchObject({ issuer_id: "Person2LocalJsonLd", protocol: "OpenId4VCI", enabled: "false" });
  for (const key of ["client_id", "client_alias", "token_endpoint", "credential_issuer_host", "wellknown_endpoint", "redirect_uri", "authorization_audience", "proxy_token_endpoint"] as const) expect(issuer[key]).toMatch(/^__PERSON4_[A-Z_]+__$/);
  expect(JSON.stringify(catalog)).not.toContain("collab.mosip.net");
});
it("reads only an existing private synthetic passcode outside the repository boundary", async () => {
  const dir = await mkdtemp(join(tmpdir(), "person2-profile-test-")); directories.push(dir);
  const root = join(dir, "repository"); await mkdir(root);
  const path = join(dir, "synthetic-pin"); await writeFile(path, "730194\n", { mode: 0o600 });
  expect(await readSyntheticPasscode(path, root)).toBe("730194");
  await chmod(path, 0o644);
  await expect(readSyntheticPasscode(path, root)).rejects.toThrow("PERSON2_PRIVATE_SYNTHETIC_PASSCODE_UNAVAILABLE");
  const inside = join(root, "synthetic-pin"); await writeFile(inside, "730194", { mode: 0o600 });
  await expect(readSyntheticPasscode(inside, root)).rejects.toThrow("PERSON2_PRIVATE_SYNTHETIC_PASSCODE_UNAVAILABLE");
  await expect(readSyntheticPasscode(join(dir, "missing"), root)).rejects.toThrow("PERSON2_PRIVATE_SYNTHETIC_PASSCODE_UNAVAILABLE");
});
it("consumes browser capture references without claiming server hops, storage or a verdict", () => {
  const runId = "11111111-1111-4111-a111-111111111111";
  const issuance: Exchange = { id: "22222222-2222-4222-a222-222222222222", runId, stepId: "33333333-3333-4333-a333-333333333333", seq: 1,
    actorFrom: "browser", actorTo: "mimoto", method: "POST", url: "http://127.0.0.1:18093/v1/mimoto/wallets/{id}/credentials", status: 200, durationMs: 2,
    request: { source: "live_bridge", capture: { ruleId: "mimoto-wallet-credential" }, body: "SYNTHETIC_CANARY_VALUE" }, response: null, redactions: [] };
  const output = browserCaptureReferences(runId, [issuance, { ...issuance, runId: "44444444-4444-4444-a444-444444444444" }]);
  expect(output.browserIssuanceExchangeIds).toEqual([issuance.id]);
  expect(output).toMatchObject({ downstreamCertify: "not_observed", downstreamVerify: "not_observed", storageConfirmed: false, verifierOutcome: "not_established" });
  expect(JSON.stringify(output)).not.toContain("SYNTHETIC_CANARY_VALUE");
});
