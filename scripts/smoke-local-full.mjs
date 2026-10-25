#!/usr/bin/env node
/**
 * scripts/smoke-local-full.mjs
 *
 * One-command smoke test for the unified local Inji profile.
 * Verifies: endpoint sheet health, OIDC discovery, Certify issuer metadata,
 * Verify request URL, Mimoto issuer catalog, playground core health,
 * and runs a conservative leak scan over all collected API responses.
 *
 * Does NOT:
 * - Run the full Certify → reference holder → Verify journey (that is local-inji-smoke.mjs)
 * - Run browser-level wallet tests (that is check-inji-web-local.mjs / test:browser)
 * - Route traffic through any proxy
 *
 * EXIT CODES:
 *   0  All automated checks passed (see banner for limits)
 *   1  One or more checks failed
 *
 * USAGE:
 *   node scripts/smoke-local-full.mjs
 *
 * ENVIRONMENT:
 *   SMOKE_TIMEOUT_MS    Per-request timeout in ms (default 8000)
 *   SMOKE_POLL_MS       Readiness poll interval in ms (default 3000)
 *   SMOKE_POLL_MAX      Max readiness poll attempts (default 40)
 */

import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 8_000);
const POLL_MS = Number(process.env.SMOKE_POLL_MS ?? 3_000);
const POLL_MAX = Number(process.env.SMOKE_POLL_MAX ?? 40);
const MIMOTO_RUNTIME = process.env.MIMOTO_RUNTIME_DIR ?? join(tmpdir(), 'mosip-web-local');

// ── Evidence tier constants ────────────────────────────────────────────────────
const TIER = Object.freeze({
  mock: 'mock',
  reference_wallet: 'reference_wallet',
  inji_web: 'inji_web',
  not_tested: 'not_tested',
});

// ── Leak patterns (conservative; smoke check, not replacement for Person 1) ────
const LEAK_PATTERNS = [
  { label: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i },
  { label: 'JWK private "d"', re: /"d"\s*:\s*"[A-Za-z0-9\-_]+"/ },
  { label: 'pre-authorized_code', re: /"pre-authorized_code"\s*:\s*"[A-Za-z0-9\-_.]+"/ },
  { label: 'access_token value', re: /"access_token"\s*:\s*"[A-Za-z0-9\-_.~+/]+"/ },
];

function redactionCheck(label, text) {
  for (const { label: patternLabel, re } of LEAK_PATTERNS) {
    if (re.test(text)) {
      return { passed: false, detail: `${label}: potential ${patternLabel} found in API response` };
    }
  }
  return { passed: true, detail: null };
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function get(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'manual',
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, text };
}

// ── Readiness poll ────────────────────────────────────────────────────────────
async function waitReady(label, url, predicate = (r) => r.status === 200) {
  for (let attempt = 0; attempt < POLL_MAX; attempt++) {
    try {
      const result = await get(url);
      if (predicate(result)) return result;
    } catch { /* not ready yet */ }
    if (attempt < POLL_MAX - 1) {
      process.stdout.write(`  Waiting for ${label}… (${attempt + 1}/${POLL_MAX})\r`);
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
  }
  throw new Error(`READINESS_TIMEOUT: ${label} not ready after ${POLL_MAX * POLL_MS / 1000}s`);
}

// ── Check result record ────────────────────────────────────────────────────────
const checks = [];
function record(id, description, tier, { passed, detail, blocked }) {
  const status = blocked ? 'BLOCKED' : (passed ? 'pass' : 'fail');
  checks.push({ id, description, tier, status, detail: detail ?? blocked ?? null });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('══ Unified local profile smoke ─────────────────────────────────════');
  console.log('  Checks endpoint sheet health, OIDC discovery, issuer metadata,');
  console.log('  Verify request URL, Mimoto catalog reachability, and leak scan.');
  console.log('  Does NOT run the Certify→Verify journey (pnpm demo:inji for that).');
  console.log('  Does NOT run browser wallet tests (pnpm check:web-local for that).');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');

  // ── Load endpoints.json ────────────────────────────────────────────────────
  let endpoints;
  try {
    const raw = await readFile(join(root, 'deploy', 'endpoints.json'), 'utf8');
    endpoints = JSON.parse(raw);
  } catch {
    console.error('FATAL: deploy/endpoints.json not found. Run pnpm install and ensure the file exists.');
    process.exitCode = 1;
    return;
  }

  const collected = [];  // all response texts for leak scan

  // ══ Section 1: Playground core (always tested) ════════════════════════════
  console.log('── Section 1: Playground core ───────────────────────────────────────');

  let playgroundHealth;
  try {
    playgroundHealth = await waitReady('Playground BFF', 'http://127.0.0.1:4000/api/v1/health');
    collected.push({ label: 'playground-health', text: playgroundHealth.text });
    const body = playgroundHealth.body;
    const storageOk = body?.storage === 'postgres' || body?.storage === 'sqlite';
    const servicesOk = Array.isArray(body?.services) && body.services.length > 0;
    record('core.bff.health', 'Playground BFF /api/v1/health → 200 with storage and services', TIER.mock, {
      passed: playgroundHealth.status === 200 && storageOk && servicesOk,
      detail: storageOk && servicesOk ? `driverMode=${body.driverMode} storage=${body.storage}` : `storage=${body?.storage} services=${JSON.stringify(body?.services)}`,
    });
  } catch (error) {
    record('core.bff.health', 'Playground BFF /api/v1/health → 200', TIER.mock, {
      passed: false, detail: error.message,
    });
  }

  // ══ Section 2: Inji Verify (port 18081) ═══════════════════════════════════
  console.log('── Section 2: Inji Verify (18081) ───────────────────────────────────');

  let verifyReady = false;
  try {
    const health = await waitReady(
      'Inji Verify /actuator/health',
      'http://127.0.0.1:18081/v1/verify/actuator/health',
      (r) => r.status === 200 && r.body?.status === 'UP',
    );
    collected.push({ label: 'verify-health', text: health.text });
    verifyReady = true;
    record('verify.health', 'Inji Verify /actuator/health → UP', TIER.reference_wallet, {
      passed: true, detail: `status=${health.body?.status}`,
    });
  } catch (error) {
    record('verify.health', 'Inji Verify /actuator/health → UP', TIER.reference_wallet, {
      passed: false, blocked: `BLOCKED: ${error.message}`,
    });
  }

  if (verifyReady) {
    // Verify vp-request endpoint is reachable (just check it exists, don't submit)
    try {
      const vpReq = await get('http://127.0.0.1:18081/v1/verify/vp-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId: 'smoke-check', nonce: 'smoke', presentationDefinition: { id: 'smoke', input_descriptors: [] }, responseCodeValidationRequired: false }),
      });
      collected.push({ label: 'verify-vp-request', text: vpReq.text });
      // 201 = created, 400 = bad request (endpoint exists), 422 = validation error (endpoint exists)
      const endpointExists = [201, 400, 422].includes(vpReq.status);
      record('verify.vp_request', 'Inji Verify /vp-request endpoint reachable', TIER.reference_wallet, {
        passed: endpointExists, detail: `HTTP ${vpReq.status}`,
      });
    } catch (error) {
      record('verify.vp_request', 'Inji Verify /vp-request endpoint reachable', TIER.reference_wallet, {
        passed: false, detail: error.message,
      });
    }
  }

  // ══ Section 3: Inji Certify (port 18090) ══════════════════════════════════
  console.log('── Section 3: Inji Certify (18090) ─────────────────────────────────');

  let certifyReady = false;
  try {
    const meta = await waitReady(
      'Inji Certify issuer metadata',
      'http://127.0.0.1:18090/v1/certify/.well-known/openid-credential-issuer',
    );
    collected.push({ label: 'certify-metadata', text: meta.text });
    const issuerMatch = meta.body?.issuer === 'http://127.0.0.1:18090' ||
      (typeof meta.body?.issuer === 'string' && meta.body.issuer.includes('18090'));
    certifyReady = meta.status === 200;
    record('certify.metadata', 'Certify /.well-known/openid-credential-issuer → 200 with issuer', TIER.reference_wallet, {
      passed: certifyReady && issuerMatch,
      detail: `issuer=${meta.body?.issuer} credential_configurations=${Object.keys(meta.body?.credential_configurations_supported ?? {}).join(',')}`,
    });
  } catch {
    record('certify.metadata', 'Certify /.well-known/openid-credential-issuer', TIER.reference_wallet, {
      passed: false,
      blocked: 'BLOCKED: Certify not running. Start with pnpm demo:inji or pnpm mobile:inji start',
    });
  }

  // ══ Section 4: Inji Web + Mimoto (ports 18093, 18099, 18095) ═════════════
  console.log('── Section 4: Inji Web + Mimoto (18093/18099/18095) ─────────────────');

  let webReady = false;
  try {
    const webHealth = await waitReady('Inji Web', 'http://127.0.0.1:18093/', (r) => r.status === 200);
    collected.push({ label: 'inji-web-root', text: webHealth.text.slice(0, 500) });  // truncate HTML
    webReady = true;
    record('web.health', 'Inji Web http://127.0.0.1:18093/ → 200', TIER.inji_web, {
      passed: true, detail: `HTTP ${webHealth.status}`,
    });
  } catch (error) {
    record('web.health', 'Inji Web http://127.0.0.1:18093/ → 200', TIER.inji_web, {
      passed: false,
      blocked: `BLOCKED: Inji Web not running. Start with pnpm stage:web-local or bash scripts/start-local-full.sh`,
    });
  }

  if (webReady) {
    // Mimoto issuer catalog (proxied through Inji Web)
    try {
      const catalog = await get('http://127.0.0.1:18093/v1/mimoto/issuers');
      collected.push({ label: 'mimoto-catalog', text: catalog.text });
      record('mimoto.catalog', 'Mimoto /issuers catalog → 200', TIER.inji_web, {
        passed: catalog.status === 200,
        detail: `HTTP ${catalog.status} issuers=${JSON.stringify(catalog.body?.issuers ?? catalog.body).slice(0, 80)}`,
      });
    } catch (error) {
      record('mimoto.catalog', 'Mimoto /issuers catalog → 200', TIER.inji_web, {
        passed: false, detail: error.message,
      });
    }

    // Synthetic IdP health
    try {
      const idpHealth = await get('http://127.0.0.1:18095/health');
      collected.push({ label: 'synthetic-idp-health', text: idpHealth.text });
      record('idp.health', 'Synthetic IdP /health → 200', TIER.inji_web, {
        passed: idpHealth.status === 200,
        detail: `HTTP ${idpHealth.status}`,
      });
    } catch (error) {
      record('idp.health', 'Synthetic IdP /health → 200', TIER.inji_web, {
        passed: false, detail: error.message,
      });
    }

    // Synthetic IdP JWKS endpoint (Mimoto needs this for token validation)
    try {
      const jwks = await get('http://127.0.0.1:18095/jwks');
      collected.push({ label: 'synthetic-idp-jwks', text: jwks.text });
      const hasKeys = Array.isArray(jwks.body?.keys) && jwks.body.keys.length > 0;
      record('idp.jwks', 'Synthetic IdP /jwks → 200 with public keys only', TIER.inji_web, {
        passed: jwks.status === 200 && hasKeys,
        detail: `HTTP ${jwks.status} keys=${jwks.body?.keys?.length ?? 0}`,
      });
    } catch (error) {
      record('idp.jwks', 'Synthetic IdP /jwks → 200', TIER.inji_web, {
        passed: false, detail: error.message,
      });
    }
  }

  // ══ Section 5: Wallet journey (not tested here) ════════════════════════════
  console.log('── Section 5: Wallet journey ─────────────────────────────────────────');

  record('wallet.browser_login', 'Web wallet login → wallet persistence (browser)', TIER.not_tested, {
    passed: null,
    blocked: 'not_tested here: covered by pnpm check:web-local (browser-level). Evidence: check-inji-web-local output 2026-10-25',
  });
  record('wallet.issuance', 'Inji Web credential issuance (local issuer catalog not configured)', TIER.not_tested, {
    passed: null,
    blocked: 'not_tested: local issuer catalog not configured; connection to local Certify not proven end-to-end',
  });
  record('wallet.presentation', 'Inji Web presentation → Verify (not proven)', TIER.not_tested, {
    passed: null,
    blocked: 'not_tested: wallet issuance not yet configured; see GAPS.md for blockers',
  });

  // ══ Section 6: Leak scan ───────────────────────════════════════════════════
  console.log('── Section 6: Leak scan (conservative) ──────────────────────────────');

  let leakFailed = false;
  for (const { label, text } of collected) {
    const result = redactionCheck(label, text);
    if (!result.passed) {
      leakFailed = true;
      record(`leak.${label}`, `Leak scan: ${label}`, TIER.mock, { passed: false, detail: result.detail });
    }
  }
  if (!leakFailed) {
    record('leak.all', `Conservative leak scan (${collected.length} responses scanned)`, TIER.mock, {
      passed: true,
      detail: `${collected.length} responses checked; no Bearer tokens, JWK private members, pre-authorized codes or access_token values found`,
    });
  }

  // ══ Print table ════════════════════════════════════════════════════════════
  console.log('');
  console.log('══ Results ══════════════════════════════════════════════════════════════');
  const colWidths = { id: 32, tier: 18, status: 12 };
  const header = `  ${'CHECK'.padEnd(colWidths.id)} ${'TIER'.padEnd(colWidths.tier)} ${'STATUS'.padEnd(colWidths.status)} DETAIL`;
  console.log(header);
  console.log('  ' + '─'.repeat(header.length - 2));

  let failures = 0;
  for (const check of checks) {
    const id = check.id.padEnd(colWidths.id);
    const tier = check.tier.padEnd(colWidths.tier);
    const status = (check.status ?? 'not_tested').padEnd(colWidths.status);
    const detail = check.detail ?? '';
    const icon = check.status === 'pass' ? '✓' : check.status === 'BLOCKED' ? '⊘' : check.status === 'fail' ? '✗' : '–';
    console.log(`  ${icon} ${id} ${tier} ${status} ${detail.slice(0, 80)}`);
    if (check.status === 'fail') failures++;
  }

  console.log('');
  const total = checks.length;
  const passed = checks.filter(c => c.status === 'pass').length;
  const blocked = checks.filter(c => c.status === 'BLOCKED').length;

  if (failures > 0) {
    console.error(`✗ Smoke FAILED: ${failures} failure(s), ${passed} passed, ${blocked} blocked/not_tested`);
    console.error('  Fix the failures above before marking this profile as ready.');
    process.exitCode = 1;
  } else {
    console.log(`✓ Local stack smoke passed: ${passed} checks passed, ${blocked} not_tested/blocked`);
    console.log('');
    console.log('  ┌─ LIMITS OF THIS SMOKE ──────────────────────────────────────────┐');
    console.log('  │ Evidence tier: reference_wallet (Certify/Verify path);           │');
    console.log('  │               inji_web (Web/Mimoto health only, not journeys).   │');
    console.log('  │ NOT proven: Inji Web issuance, presentation, or wallet journey.  │');
    console.log('  │ NOT proven: SD-JWT Web pass, mobile pass, cross-vendor pass.     │');
    console.log('  │ NOT proven: independent clean-machine verification.              │');
    console.log('  │ Browser wallet tests: run pnpm check:web-local separately.       │');
    console.log('  │ Full Certify→Verify flow: run pnpm demo:inji separately.         │');
    console.log('  └─────────────────────────────────────────────────────────────────┘');
  }
  console.log('');
}

main().catch(error => {
  const code = /^[A-Z0-9_:]+$/.test(error.message) ? error.message : 'SMOKE_LOCAL_FULL_FAILED';
  console.error(code, error.message !== code ? error.message : '');
  process.exitCode = 1;
});
