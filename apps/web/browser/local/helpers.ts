import type { BrowserContext, Page } from "@playwright/test";
import { localOrigin, type LocalProfile } from "./profile";

export async function restrictToLocalProfile(context: BrowserContext, profile: LocalProfile) {
  const allowed = new Set([profile.walletOrigin, profile.idpOrigin, profile.mimotoOrigin, profile.certifyOrigin, profile.verifyOrigin].map(localOrigin));
  await context.route("**/*", route => {
    try { if (allowed.has(new URL(route.request().url()).origin)) return route.fallback(); } catch { /* Fail closed without printing URLs. */ }
    return route.abort("blockedbyclient");
  });
}

export async function loginAndUnlock(page: Page, profile: LocalProfile, pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("PERSON2_SYNTHETIC_PASSCODE_INVALID");
  let stage = "LOGIN";
  try {
    await page.goto(localOrigin(profile.walletOrigin), { waitUntil: "domcontentloaded" });
    await page.getByText("Continue With Google", { exact: true }).click();
    stage = "UNLOCK";
    // Phase 1 intentionally requires the wallet provisioned by Person 4's checker.
    // Creating/resetting a wallet or accepting new account terms is not a helper action.
    await page.getByRole("heading", { name: "Enter Your Passcode to Continue", exact: true }).waitFor();
    const inputs = page.locator("input[type=password]");
    if (await inputs.count() !== 6) throw new Error();
    for (let index = 0; index < 6; index++) await inputs.nth(index).fill(pin[index]!);
    const unlocked = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === profile.walletOrigin && /^\/v1\/mimoto\/wallets(?:\/[^/]+)?\/unlock\/?$/.test(url.pathname) && response.request().method() === "POST";
    }, { timeout: 4_000 });
    const [response] = await Promise.all([unlocked, page.getByRole("button", { name: "Submit", exact: true }).click()]);
    if (response.status() !== 200) throw new Error();
    await page.getByText("Stored Cards", { exact: true }).first().waitFor();
    if (new URL(page.url()).pathname !== "/user/home") throw new Error();
    return { login: "existing_synthetic_wallet" as const, walletUnlockHttp: 200, homeVisible: true };
  } catch { throw new Error(`PERSON2_LOCAL_${stage}_FAILED`); }
}

export async function selectIssuer(page: Page, issuerLabel: string, credentialLabel: string) {
  try {
    await page.getByRole("heading", { name: issuerLabel, exact: true }).click();
    await page.getByRole("heading", { name: credentialLabel, exact: true }).waitFor();
    await page.getByRole("heading", { name: credentialLabel, exact: true }).click();
  } catch { throw new Error("PERSON2_LOCAL_CATALOG_SELECTION_FAILED"); }
}

export async function assertCardSurvivesRefresh(page: Page, walletOrigin: string, credentialLabel: string) {
  try {
    const origin = localOrigin(walletOrigin);
    if (new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== "/user/credentials") throw new Error();
    await page.getByText(credentialLabel, { exact: true }).first().waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(credentialLabel, { exact: true }).first().waitFor();
    if (new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== "/user/credentials") throw new Error();
    return { storageAfterRefresh: true, provenance: "browser_observation" as const };
  } catch { throw new Error("PERSON2_LOCAL_STORAGE_REFRESH_FAILED"); }
}
