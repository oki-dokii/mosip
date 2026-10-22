import { createMockIssuer } from "./app.js";
import { loadIssuerSigner } from "./signing.js";

const port = Number(process.env.MOCK_ISSUER_PORT ?? 4101);
const publicBaseUrl = process.env.MOCK_ISSUER_PUBLIC_URL ?? `http://127.0.0.1:${port}`;
const signer = await loadIssuerSigner({ privateKeyPath: process.env.MOCK_ISSUER_SIGNING_KEY_PATH, certificatePath: process.env.MOCK_ISSUER_CERT_CHAIN_PATH, issuerUrl: process.env.MOCK_ISSUER_ISSUER_ID ?? publicBaseUrl });
export const mockIssuerServer = createMockIssuer({ signer, publicBaseUrl: () => publicBaseUrl, enableTestCases: process.env.MOCK_ISSUER_ENABLE_TEST_CASES === "true" });
if (process.env.MOCK_ISSUER_NO_LISTEN !== "1") {
  const host = process.env.MOCK_ISSUER_HOST ?? "127.0.0.1";
  mockIssuerServer.listen(port, host, () => console.log(`Mock issuer listening on http://${host}:${port}`));
}
