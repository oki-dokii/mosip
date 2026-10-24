import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const evidence = new URL("../../../submission/evidence/person2/", import.meta.url);
const bffUrl = `http://127.0.0.1:${process.env.PLAYGROUND_BROWSER_BFF_PORT ?? "4000"}`;

test("assisted fixture supports keyboard completion and accessibility", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "W3C VC JSON-LD" }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Inji Web/ }) }).click();
  await page.getByRole("button", { name: "Start assisted fixture run" }).click();
  const panel = page.getByRole("region", { name: "Assisted Inji Web fixture journey" });
  await expect(panel).toContainText("A1 blocked");
  await panel.getByRole("link", { name: "Open wallet", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Open credential offer" })).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(panel).toContainText("storage is still unconfirmed");
  await panel.getByRole("button", { name: "Simulate wallet storage confirmation" }).click();
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => (window as any).axe.run(document.querySelector('[aria-label="Assisted Inji Web fixture journey"]'), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  await mkdir(evidence, { recursive: true });
  await writeFile(new URL("accessibility.json", evidence), JSON.stringify({ scope: "Assisted fixture panel including color contrast", violations: result.violations, passes: result.passes.map((item: any) => item.id) }, null, 2));
  expect(result.violations).toEqual([]);
  await panel.screenshot({ path: new URL("assisted-fixture.png", evidence).pathname });
  await panel.getByRole("button", { name: "Simulate presentation observation" }).click();
  await panel.getByRole("button", { name: "Simulate valid verifier result" }).click();
  await expect(panel).toContainText("Simulated verifier result: valid");
});

test("independent mock happy path and synthetic capture remain safe in browser/API", async ({ page, request }) => {
  await page.goto("/");
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Mock Issuer/i }) }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Mock Verifier/i }) }).click();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/runs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run flow" }).click();
  const { runId } = await (await responsePromise).json();
  await expect(page.getByText("✓ Valid — expected result matched")).toBeVisible({ timeout: 20_000 });
  const wrapper = JSON.parse(await readFile(new URL("../../bff/src/capture/fixtures/four-service.synthetic.har.json", import.meta.url), "utf8"));
  wrapper.runId = runId; // Rebase the synthetic envelope to this test run.
  // A synthetic VC variant exercises useful public names and unknown-name withholding.
  wrapper.har.log.entries[1].response.content.text = JSON.stringify({ credential: {
    type: ["VerifiableCredential", "FarmerCredential", "portrait", "farmer_id"], issuer: "https://issuer.example/issuer",
    credentialSubject: { name: "CANARY_PERSON", portrait: "CANARY_PORTRAIT", farmer_id: "CANARY_ID" },
  } });
  await page.getByLabel("Synthetic capture JSON").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(wrapper)) });
  await page.getByRole("button", { name: "Import synthetic capture" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Synthetic capture imported" })).toBeVisible();
  await expect(page.getByText("STORE: not_observable")).toBeVisible();
  const exchanges = await (await request.get(`${bffUrl}/api/v1/runs/${runId}/exchanges`)).json();
  expect(JSON.stringify(exchanges)).not.toContain("CANARY");
  const observed = exchanges.items.find((exchange: any) => exchange.request?.capture?.ruleId === "certify-credential");
  expect(observed).toBeTruthy();
  await page.getByRole("button").filter({ hasText: "browser" }).filter({ hasText: "certify" }).click();
  await expect(page.getByRole("region", { name: "Response public evidence" })).toContainText("FarmerCredential");
  expect(await page.locator("body").textContent()).not.toContain("CANARY");
  await mkdir(evidence, { recursive: true });
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => (window as any).axe.run({ include: ['[aria-label="Browser capture coverage"]', '[aria-label="Request public evidence"]', '[aria-label="Response public evidence"]'] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  await writeFile(new URL("capture-accessibility.json", evidence), JSON.stringify({ scope: "Capture coverage and public evidence including contrast", violations: result.violations, passes: result.passes.map((item: any) => item.id) }, null, 2));
  expect(result.violations).toEqual([]);
  await page.getByRole("region", { name: "Response public evidence" }).screenshot({ path: new URL("public-evidence.png", evidence).pathname });
  await page.getByRole("region", { name: "Browser capture coverage" }).screenshot({ path: new URL("capture-coverage.png", evidence).pathname });
});

test("connected assisted API journey completes, cancels and reloads coverage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "W3C VC JSON-LD" }).click();
  await page.locator("label").filter({ has: page.getByRole("radio", { name: /Inji Web/ }) }).click();
  const panel = page.getByRole("region", { name: "Connected assisted journey" });
  await panel.getByRole("button", { name: "Start connected fixture" }).click();
  await panel.getByRole("button", { name: "Inject fixture issuance", exact: true }).click();
  await panel.getByRole("button", { name: "Inject fixture storage confirmation" }).click();
  await panel.getByRole("button", { name: "Inject fixture presentation", exact: true }).click();
  await expect(panel).toContainText("Verifier outcome: valid");
  await page.reload();
  await page.getByRole("button", { name: /Open run / }).first().click();
  await expect(panel).toContainText("Verifier outcome: valid");
  await panel.getByRole("button", { name: "Start connected fixture" }).click();
  await panel.getByRole("button", { name: "Cancel backend-assisted run" }).click();
  await expect(panel).toContainText("cancelled");
  await page.getByRole("button", { name: "Latest matrix" }).click();
  await expect(page.getByRole("region", { name: "Supported combinations" })).toContainText("not_tested");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => (window as any).axe.run(document.querySelector('[aria-label="Connected assisted journey"]'), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  expect(result.violations).toEqual([]);
  await writeFile(new URL("connected-accessibility.json", evidence), JSON.stringify({ scope: "Connected assisted journey", violations: result.violations, passes: result.passes.map((item: any) => item.id) }, null, 2));
  await panel.screenshot({ path: new URL("connected-assisted.png", evidence).pathname });
});

test("real-wallet observations appear in compatibility and portable reports without becoming runs", async ({ page, request }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Observed real-wallet compatibility" });
  await expect(panel.getByRole("heading", { name: "Inji Web (real wallet) · JSON-LD" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Inji Wallet Android (real wallet) · SD-JWT" })).toBeVisible();
  await expect(panel).toContainText("Persistent storage · user confirmed:");
  await expect(panel).toContainText("Managed run: none");
  const report = await (await request.get(`${bffUrl}/api/v1/wallet-evidence/report?format=json`)).json();
  expect(report.items).toHaveLength(2);
  expect(report.items.every((item: any) => item.managedRunId === null && item.managedValidation === "pending")).toBe(true);
  await page.getByRole("button", { name: "Latest matrix", exact: true }).click();
  await expect(page.getByRole("region", { name: "Supported combinations" })).toContainText("Related manual Web observation: Valid");
  const csv = await (await request.get(`${bffUrl}/api/v1/matrix/export?format=csv`)).text();
  expect(csv).toContain("manual_wallet_observation");
  expect(csv).toContain("inji_mobile");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () => (window as any).axe.run(document.querySelector('[aria-labelledby="wallet-evidence-title"]'), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
  expect(result.violations).toEqual([]);
  await mkdir(evidence, { recursive: true });
  await writeFile(new URL("wallet-evidence-accessibility.json", evidence), JSON.stringify({ scope: "Real-wallet evidence catalog", violations: result.violations, passes: result.passes.map((item: any) => item.id) }, null, 2));
  await panel.screenshot({ path: new URL("wallet-evidence-catalog.png", evidence).pathname });
});
