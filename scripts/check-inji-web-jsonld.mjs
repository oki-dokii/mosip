// Drive the real local Web wallet with only synthetic identity data.
// This command prints route statuses and public UI checkpoints, never codes,
// cookies, full credentials, presentation tokens or response bodies.
import { createRequire } from 'node:module';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const runtime = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');
const origin = 'http://127.0.0.1:18093';
const issuedRecord = join(runtime, 'last-jsonld-issued.json');
let stage = 'login';

async function main() {
  await unlink(issuedRecord).catch(error => { if (error.code !== 'ENOENT') throw error; });
  const certifyState = JSON.parse(await readFile(join(process.env.MOBILE_RUNTIME_DIR ??
    join(tmpdir(), 'mosip-mobile-inji'), 'public-state.json'), 'utf8'));
  if (certifyState.activeProfile !== 'web_jsonld' ||
      certifyState.image !== 'injistack/inji-certify-with-plugins:0.14.0')
    throw new Error('LOCAL_JSONLD_PROFILE_REQUIRED');
  const pin = (await readFile(join(runtime, 'synthetic-wallet-passcode'), 'utf8')).trim();
  if (!/^\d{6}$/.test(pin)) throw new Error('SYNTHETIC_WALLET_PASSCODE_MISSING');
  const browser = await chromium.launch({ headless: true });
  const routes = [];
  try {
    const page = await browser.newPage();
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.startsWith('/v1/mimoto/'))
        routes.push({ method: response.request().method(),
          path: url.pathname.replace(/\/wallets\/[^/]+/g, '/wallets/{id}'), status: response.status() });
    });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByText('Continue With Google').click();
    await page.getByText('Enter Your Passcode to Continue').waitFor({ timeout: 20_000 });
    for (let index = 0; index < 6; index++)
      await page.locator('input[type=password]').nth(index).fill(pin[index]);
    await page.getByRole('button', { name: 'Submit' }).click();
    stage = 'issuer_catalog';
    await page.getByText('Playground Synthetic Farmer').waitFor({ timeout: 30_000 });
    await page.getByText('Playground Synthetic Farmer').click();
    stage = 'credential_catalog';
    await page.getByText('List of Credential Types').waitFor({ timeout: 20_000 });
    const download = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.origin === origin && /\/v1\/mimoto\/wallets\/[^/]+\/credentials$/.test(url.pathname) &&
        response.request().method() === 'POST';
    }, { timeout: 45_000 }).catch(() => null);
    await page.getByText('Playground Synthetic Farmer').last().click();
    if(process.env.INTERACTIVE_SYNTHETIC_AUTH==='true') {
      await page.getByLabel('Demo UIN').fill('SYNTHETIC-001');
      await page.getByLabel('Demo OTP').fill('246810');
      await page.getByRole('button',{name:'Authorize issuance'}).click();
    }
    stage = 'issuance';
    const downloaded = await download;
    await page.waitForTimeout(1500);
    const failed = await page.getByText('Download Failed').isVisible().catch(() => false);
    const walletPosts = routes.filter(route => route.method === 'POST' && route.path.endsWith('/wallets/{id}/credentials'));
    const walletPostSuccess = walletPosts.some(route => route.status === 200);
    let credentialId = null;
    let walletId = null;
    if (downloaded?.status() === 200) {
      const saved = await downloaded.json();
      credentialId = saved.credentialId;
      walletId = new URL(downloaded.url()).pathname.match(/\/wallets\/([^/]+)\/credentials$/)?.[1];
      if (!/^[A-Za-z0-9_-]{10,100}$/.test(credentialId ?? '') || !/^[A-Za-z0-9_-]{10,100}$/.test(walletId ?? ''))
        throw new Error('STORED_CREDENTIAL_ID_MISSING');
    }
    let storedAfterReload = false;
    if (walletPostSuccess) {
      const reloadedList = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.origin === origin && /\/v1\/mimoto\/wallets\/[^/]+\/credentials$/.test(url.pathname) &&
          response.request().method() === 'GET';
      }, { timeout: 15_000 }).catch(() => null);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const list = await reloadedList;
      const listed = list?.status() === 200 ? await list.json() : [];
      storedAfterReload = Array.isArray(listed) && listed.some(item => item.credentialId === credentialId) &&
        await page.getByText('Playground Synthetic Farmer').first().isVisible().catch(() => false);
    }
    if (storedAfterReload) await writeFile(issuedRecord, JSON.stringify({
      credentialId, walletId, issuedAt: new Date().toISOString(),
      issuerVersion: '0.14.0', issuerImageDigest: certifyState.imageDigest,
    }) + '\n', { mode: 0o600 });
    if (storedAfterReload) await page.screenshot({ path: join(runtime, 'jsonld-stored.png') });
    const result = { observedAt: new Date().toISOString(),
      issuerVersion: '0.14.0', walletVersion: '0.17.0', mimotoVersion: '0.22.0',
      result: failed || !walletPostSuccess ? 'LOCAL_WEB_JSONLD_ISSUANCE_FAILED' : 'LOCAL_WEB_JSONLD_ISSUANCE_API_OK',
      stage, walletApiStatuses: walletPosts,
      routeStatuses: routes.filter(route => /\/issuers|\/credentials/.test(route.path)).slice(-20),
      uiFailureVisible: failed,
      currentPath: new URL(page.url()).pathname,
      storedAfterReload,
      issuedCredentialCorrelated: !!credentialId && storedAfterReload,
      presentationObserved: false, verifierValid: false };
    await writeFile(join(runtime, 'jsonld-issuance-result.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(result));
    if (failed || !walletPostSuccess || !storedAfterReload) process.exitCode = 1;
  } finally { await browser.close(); }
}

main().catch(error => {
  console.error(JSON.stringify({ result: 'failed', stage,
    code: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_WEB_JSONLD_CHECK_FAILED' }));
  process.exitCode = 1;
});
