import { test, expect, type Page } from "@playwright/test";
import type { RunSummary } from "@playground/shared";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const canary = "PRIVATE_PHASE3_CANARY";
const run = (id: string): RunSummary => ({
  id, parentRunId: null, config: { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "mock_verifier", format: "vc_sd_jwt", flow: "cross_device", tamper: null, scenarioId: null },
  status: "passed", expectedOutcome: "valid", actualOutcome: "valid", proofType: "kb+jwt", algorithm: "EdDSA",
  serviceVersions: { issuer: id === a ? "fixture/1" : "fixture/2", wallet: "fixture/1", verifier: "fixture/1" },
  protocolProfile: id === a ? "fixture-v1" : "legacy-mock-v1", createdAt: "2026-10-26T00:00:00Z", startedAt: null, finishedAt: "2026-10-26T00:01:00Z",
});
async function fixtures(page: Page, options: { denyB?: boolean; empty?: boolean } = {}) {
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/v1/runs" || path === "/api/v1/matrix") return json({ items: options.empty ? [] : [run(a), run(b)] });
    if (path === "/api/v1/wallet-evidence") return json({ schemaVersion: 1, items: [] });
    const match = path.match(/^\/api\/v1\/runs\/([0-9a-f-]+)(.*)$/);
    if (!match) return route.continue();
    const [, id, suffix] = match;
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

test("shareable comparison, filters and selected run survive reload and browser navigation", async ({ page }) => {
  await fixtures(page);
  await page.goto("/");
  await page.getByLabel("Filter issuer version").selectOption("fixture/1");
  await page.getByLabel("Compare run A").selectOption(a);
  await page.getByLabel("Compare run B").selectOption(b);
  const comparison = page.getByRole("region", { name: "Run comparison", exact: true });
  await expect(comparison).toContainText("legacy-mock-v1");
  await expect(comparison).toContainText("succeeded");
  await expect(comparison).toContainText("skipped");
  await page.getByRole("button", { name: "Open run 11111111" }).click();
  await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Latest matrix", exact: true }).click();
  const link = await page.getByRole("link", { name: "Share this view" }).getAttribute("href");
  expect(link).toContain(`compareA=${a}`);
  expect(link).toContain(`run=${a}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toBeVisible();
  await expect(page.getByLabel("Filter issuer version")).toHaveValue("fixture/1");
  await expect(page.getByLabel("Compare run B")).toHaveValue(b);
  await expect(comparison).toContainText("legacy-mock-v1");
  await page.getByLabel("Filter status").selectOption("failed");
  await expect(page.getByText("No runs match these filters.")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Filter status")).toHaveValue("");
  await page.goForward();
  await expect(page.getByLabel("Filter status")).toHaveValue("failed");
  await page.getByLabel("Compare run B").selectOption("");
  await expect(comparison).toContainText("Select two recorded runs");
  await page.goBack();
  await expect(comparison).toContainText("legacy-mock-v1");
});

test("malformed URLs are canonicalized and values/withheld names never enter DOM, links or storage", async ({ page }) => {
  await fixtures(page);
  await page.goto(`/?run=${a}&compareA=${a}&compareB=${b}&status=passed&status=failed&wallet=android&token=${canary}&request_uri=${canary}&state=${canary}#${canary}`);
  await expect(page.getByRole("region", { name: "Run comparison", exact: true })).toContainText("given_name");
  await expect(page).not.toHaveURL(new RegExp(canary));
  await expect(page.getByLabel("Filter status")).toHaveValue("");
  await expect(page.getByLabel("Filter wallet")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(canary);
  await expect(page.locator("body")).not.toContainText("secret_name");
  await page.getByText("Projected structure details", { exact: true }).first().click();
  await expect(page.locator("body")).not.toContainText(canary);
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(canary);
  expect(await page.getByRole("link", { name: "Share this view" }).getAttribute("href")).not.toMatch(/token|state|request_uri|android/);
});

test("inaccessible links preserve API access decisions and never show a previous verdict or error body", async ({ page }) => {
  await fixtures(page, { denyB: true });
  await page.goto(`/?run=${a}`);
  await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open run 22222222" }).click();
  await expect(page.getByRole("alert")).toContainText("Run unavailable");
  await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toHaveCount(0);
  await page.getByLabel("Compare run A").selectOption(a);
  await page.getByLabel("Compare run B").selectOption(b);
  await expect(page.getByRole("region", { name: "Run comparison", exact: true })).toContainText("Comparison unavailable");
  await expect(page.locator("body")).not.toContainText(canary);
  await page.goBack();
  await expect(page.getByLabel("Compare run B")).toHaveValue("");
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Run 11111111", exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("alert")).toContainText("Run unavailable");
});

test("empty archives and invalid IDs do not trigger run reads", async ({ page }) => {
  await fixtures(page, { empty: true });
  const reads: string[] = [];
  page.on("request", request => { if (/\/api\/v1\/runs\//.test(request.url())) reads.push(request.url()); });
  await page.goto("/?run=../../private&compareA=bad&compareB=bad&format=unknown");
  await expect(page.getByText("No runs match these filters.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Run comparison", exact: true })).toContainText("Select two recorded runs");
  expect(reads).toEqual([]);
  await expect(page).not.toHaveURL(/private|bad|unknown/);
});

test("existing connected fixture journey still completes and resumes from its shared run URL", async ({ page }) => {
  // Real local BFF fixture driver; no hosted wallet, login or browser auth state.
  await page.goto("/");
  await page.getByRole("button", { name: "W3C VC JSON-LD" }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Inji Web/ }) }).click();
  const panel = page.getByRole("region", { name: "Connected assisted journey" });
  await panel.getByRole("button", { name: "Start connected fixture" }).click();
  await panel.getByRole("button", { name: "Inject fixture issuance", exact: true }).click();
  await panel.getByRole("button", { name: "Inject fixture storage confirmation" }).click();
  await panel.getByRole("button", { name: "Inject fixture presentation", exact: true }).click();
  await expect(panel).toContainText("Verifier outcome: valid");
  expect(new URL(page.url()).searchParams.get("run")).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(panel).toContainText("Verifier outcome: valid");
  await expect(panel).toContainText("Fixture simulation");
});
