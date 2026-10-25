import { test, expect } from "@playwright/test";
import { a, b, canary, fixtures } from "./fixtures/recordedRuns";


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
