import { test, expect } from "@playwright/test";
import { loadProfile } from "./profile";
import { assertCardSurvivesRefresh, loginAndUnlock, restrictToLocalProfile, selectIssuer } from "./helpers";

const syntheticPin = "730194"; // Offline fixture only; never a deployed wallet passcode.
async function fixture(context: Parameters<typeof restrictToLocalProfile>[0], options = { cardPersists: true, unlockStatus: 200 }) {
  const profile = await loadProfile();
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/unlock")) return route.fulfill({ status: options.unlockStatus, contentType: "application/json", body: "{}" });
    let body = "<h1>Offline synthetic wallet fixture</h1>";
    if (url.pathname === "/") body += '<a href="/login">Continue With Google</a>';
    if (url.pathname === "/login") body += `<h1>Enter Your Passcode to Continue</h1><form>${Array.from({ length: 6 }, () => '<input type="password" maxlength="1">').join("")}<button>Submit</button></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/v1/mimoto/wallets/fixture-wallet/unlock',{method:'POST'});if(r.ok)location.href='/user/home'}</script>`;
    if (url.pathname === "/user/home") body += `<nav>Stored Cards</nav><a href="/issuers/Person2LocalJsonLd"><h3>${profile.jsonLd.issuerLabel}</h3></a>`;
    if (url.pathname.startsWith("/issuers/")) body += `<a href="/user/credentials"><h3>${profile.jsonLd.credentialLabel}</h3></a>`;
    if (url.pathname === "/user/credentials" && options.cardPersists) body += `<h3>${profile.jsonLd.credentialLabel}</h3>`;
    return route.fulfill({ status: 200, contentType: "text/html", body });
  });
  await restrictToLocalProfile(context, profile);
  return profile;
}

test("offline helper fixture: unlock, select issuer and confirm card after reload", async ({ page, context }) => {
  const profile = await fixture(context);
  expect(await loginAndUnlock(page, profile, syntheticPin)).toEqual({ login: "existing_synthetic_wallet", walletUnlockHttp: 200, homeVisible: true });
  await selectIssuer(page, profile.jsonLd.issuerLabel, profile.jsonLd.credentialLabel);
  expect(await assertCardSurvivesRefresh(page, profile.walletOrigin, profile.jsonLd.credentialLabel)).toEqual({ storageAfterRefresh: true, provenance: "browser_observation" });
});

test("offline helper fixture: a rejected unlock emits only a stage code", async ({ page, context }) => {
  const profile = await fixture(context, { cardPersists: true, unlockStatus: 403 });
  await expect(loginAndUnlock(page, profile, syntheticPin)).rejects.toThrow("PERSON2_LOCAL_UNLOCK_FAILED");
});

test("offline helper fixture: missing catalog is a named blocker", async ({ page, context }) => {
  const profile = await fixture(context);
  await page.goto(profile.walletOrigin + "/user/home");
  await expect(selectIssuer(page, "Unavailable issuer", "Unavailable credential")).rejects.toThrow("PERSON2_LOCAL_CATALOG_SELECTION_FAILED");
});

test("offline helper fixture: a card disappearing after reload fails persistence", async ({ page, context }) => {
  const profile = await fixture(context, { cardPersists: false, unlockStatus: 200 });
  await page.goto(profile.walletOrigin + "/user/credentials");
  await page.setContent(`<h3>${profile.jsonLd.credentialLabel}</h3>`);
  await expect(assertCardSurvivesRefresh(page, profile.walletOrigin, profile.jsonLd.credentialLabel)).rejects.toThrow("PERSON2_LOCAL_STORAGE_REFRESH_FAILED");
});

test("offline helper fixture: hosted login redirects are blocked before leaving loopback", async ({ page, context }) => {
  await fixture(context);
  await expect(page.goto("https://injiweb.collab.mosip.net/")).rejects.toThrow();
});
