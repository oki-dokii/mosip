import type { Page } from "@playwright/test";
import type { RunSummary } from "@playground/shared";

export const a = "11111111-1111-4111-8111-111111111111";
export const b = "22222222-2222-4222-8222-222222222222";
export const canary = "PRIVATE_PHASE3_CANARY";
export const run = (id: string): RunSummary => ({
  id, parentRunId: null, config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: null },
  status: "passed", expectedOutcome: "valid", actualOutcome: "valid", proofType: "kb+jwt", algorithm: "EdDSA",
  serviceVersions: { issuer: id === a ? "fixture/1" : "fixture/2", wallet: "fixture/1", verifier: "fixture/1" },
  protocolProfile: id === a ? "fixture-v1" : "legacy-mock-v1", createdAt: "2026-10-26T00:00:00Z", startedAt: null, finishedAt: "2026-10-26T00:01:00Z",
});
export async function fixtures(page: Page, options: { denyB?: boolean; empty?: boolean } = {}) {
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/v1/runs" || path === "/api/v1/matrix") return json({ items: options.empty ? [] : [run(a), run(b)] });
    if (path === "/api/v1/wallet-evidence") return json({ schemaVersion: 1, items: [] });
    const match = path.match(/^\/api\/v1\/runs\/([0-9a-f-]+)(.*)$/);
    if (!match) return route.continue();
    const id = match[1]!;
    const suffix = match[2] ?? "";
    if (options.denyB && id === b) return json({ message: canary }, 403);
    if (!suffix) return json(run(id));
    if (suffix === "/steps") return json({ items: [{ id: `${id}-step`, runId: id, seq: 1, stepKey: "issue", title: "Issue credential", status: id === a ? "succeeded" : "skipped", summary: null }] });
    if (suffix === "/exchanges") return json({ items: [{ id: `${id}-exchange`, runId: id, stepId: `${id}-step`, seq: 1, actorFrom: "wallet", actorTo: "certify", method: "POST", url: "http://127.0.0.1/credential", status: 200, durationMs: 5, redactions: [], request: null,
      response: { body: { credentialSubject: { secret_name: canary } }, publicView: { schemaVersion: 1, authenticity: "not_verified", withheldNames: 1, truncatedItems: 0, unsupportedKinds: 0, items: [{ kind: "sd_jwt", summary: { claimNames: ["given_name", "secret_name"], disclosureNames: ["family_name"], value: canary } }] } },
    }] });
    if (suffix === "/sequence") return json({ mermaid: "sequenceDiagram\n wallet->>certify: POST credential", markers: [] });
    if (suffix === "/capture/coverage") return json({ coverage: [] });
    return route.continue();
  });
}
