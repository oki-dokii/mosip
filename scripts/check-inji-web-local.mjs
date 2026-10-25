// Browser check for synthetic local Inji Web login and persisted wallet unlock.
// Requires pnpm stage:web-local. A generated passcode stays in owner-only temp storage.
import { randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const passcodePath = join(runtime, 'synthetic-wallet-passcode');
const origin = 'http://127.0.0.1:18093';

async function passcode() {
  try { return (await readFile(passcodePath, 'utf8')).trim(); }
  catch {
    const value = String(randomInt(100000, 1000000));
    await writeFile(passcodePath, value, { mode: 0o600 });
    return value;
  }
}
async function journey(browser, pin) {
  const page = await browser.newPage();
  const walletStatuses = [];
  let stage = 'LOGIN';
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.includes('/v1/mimoto/wallets')) walletStatuses.push(response.status());
  });
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByText('Continue With Google').click();
    stage = 'PASSCODE_PAGE';
    await page.getByText(/Set your passcode to get started|Enter Your Passcode to Continue/).waitFor({ timeout: 20_000 });
    const setup = await page.getByText('Set your passcode to get started').isVisible().catch(() => false);
    if (setup) {
      for (let index = 0; index < 6; index++) {
        await page.getByTestId('input-passcode').nth(index).fill(pin[index]);
        await page.getByTestId('input-confirm-passcode').nth(index).fill(pin[index]);
      }
    } else {
      for (let index = 0; index < 6; index++) await page.locator('input[type=password]').nth(index).fill(pin[index]);
    }
    stage = 'WALLET_UNLOCK';
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByText('Stored Cards').waitFor({ timeout: 20_000 });
    if (new URL(page.url()).pathname !== '/user/home' || !walletStatuses.includes(200)) throw new Error('WALLET_HOME_OR_API_MISSING');
    return { login: setup ? 'new_synthetic_wallet' : 'existing_synthetic_wallet', walletApiHttp200: true, homeVisible: true };
  } catch {
    throw new Error(`LOCAL_WEB_${stage}_FAILED`);
  } finally { await page.close(); }
}
async function warmupJourney(browser, pin) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return { ...(await journey(browser, pin)), attempts: attempt }; }
    catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const pin = await passcode();
    const first = await warmupJourney(browser, pin);
    const second = await warmupJourney(browser, pin);
    if (second.login !== 'existing_synthetic_wallet') throw new Error('WALLET_NOT_PERSISTED');
    console.log(JSON.stringify({
      observedAt: new Date().toISOString(), profile: 'local_official_inji_web_mimoto_synthetic_idp',
      first, freshBrowserSession: second, result: 'LOCAL_WEB_WALLET_PASS',
      issuerCatalogConfigured: false, credentialIssuanceObserved: false, presentationObserved: false,
    }, null, 2));
  } finally { await browser.close(); }
}

main().catch(error => {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_WEB_WALLET_CHECK_FAILED');
  process.exitCode = 1;
});
