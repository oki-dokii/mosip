import { afterEach, expect, it, vi } from "vitest";
import { LocalWebVerifier, validLocalSettings } from "./localWebVerifier.js";
import type { DriverContext } from "./types.js";
const previous = { ...process.env };
afterEach(() => { process.env = { ...previous }; vi.unstubAllGlobals(); });
it("permits only the explicit pinned synthetic local HTTP profile", () => {
  Object.assign(process.env, { ASSISTED_LOCAL_PROFILE: 'jsonld-0.14', CERTIFY_BASE_URL: 'http://127.0.0.1:18090/v1/certify', VERIFY_BASE_URL: 'http://127.0.0.1:18081/v1/verify', ASSISTED_WALLET_URL: 'http://127.0.0.1:18093/', ASSISTED_OFFER_URL: 'http://127.0.0.1:18093/issuers/LocalFarmer' });
  expect(validLocalSettings()).toBe(true);
  for (const bad of ['http://localhost:18081/v1/verify', 'http://169.254.169.254/v1/verify', 'http://127.0.0.1:18081/other']) { process.env.VERIFY_BASE_URL = bad; expect(validLocalSettings()).toBe(false); }
});
it("does not fetch arbitrary request URIs returned by a verifier", async () => {
  Object.assign(process.env, { ASSISTED_LOCAL_PROFILE: 'jsonld-0.14', CERTIFY_BASE_URL: 'http://127.0.0.1:18090/v1/certify', VERIFY_BASE_URL: 'http://127.0.0.1:18081/v1/verify', ASSISTED_WALLET_URL: 'http://127.0.0.1:18093/', ASSISTED_OFFER_URL: 'http://127.0.0.1:18093/issuers/LocalFarmer' });
  const fetcher = vi.fn(async () => Response.json({ transactionId: 'synthetic', requestId: 'synthetic', requestUri: 'http://169.254.169.254/secret' }, { status: 201 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(new LocalWebVerifier().createRequest({ state: new Map() } as DriverContext)).rejects.toThrow('LOCAL_VERIFY_REQUEST_URI_POLICY');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
