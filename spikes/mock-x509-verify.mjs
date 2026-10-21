// Manual public-sandbox check. Run with a local mock issuer configured with an X.509 certificate.
// The credential and presentation stay in memory; stdout contains only check summaries.
import { createCollabDrivers } from "../apps/bff/dist/drivers/collab.js";

if (!process.env.MOCK_ISSUER_BASE_URL) throw new Error("Set MOCK_ISSUER_BASE_URL");
const config = { issuer: "mock_issuer", wallet: "reference_wallet", verifier: "inji_verify", format: "vc_sd_jwt", tamper: process.env.TAMPER_KIND === "bad_signature" ? "bad_signature" : null };
const context = { config, state: new Map([["collab.config", {
  clientId: "playground-test-client",
  credentialConfigurationId: "MockVerifiableCredential_SD_JWT",
  credentialFormat: "dc+sd-jwt",
  verifyBaseUrl: process.env.VERIFY_BASE_URL ?? "https://injiverify.collab.mosip.net/v1/verify",
}]]) };
const drivers = createCollabDrivers(config);
await drivers.issuer.createOffer(context);
await drivers.wallet.authorize(context);
await drivers.wallet.requestCredential(context);
await drivers.wallet.store(context);
await drivers.verifier.createRequest(context);
await drivers.wallet.present(context);
const status = await drivers.verifier.pollStatus(context);
const result = await drivers.verifier.getResult(context);
console.log(JSON.stringify({ status: status.summary?.status, outcome: result.summary?.outcome, detail: result.summary?.failureDetail ?? null }));
