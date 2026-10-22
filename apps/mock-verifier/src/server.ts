import { createMockVerifier } from "./app.js";
const port = Number(process.env.MOCK_VERIFIER_PORT ?? 4102);
const publicBaseUrl = process.env.MOCK_VERIFIER_PUBLIC_URL ?? `http://127.0.0.1:${port}`;
export const mockVerifierServer = createMockVerifier({ publicBaseUrl: () => publicBaseUrl });
if (process.env.MOCK_VERIFIER_NO_LISTEN !== "1") {
  const host = process.env.MOCK_VERIFIER_HOST ?? "127.0.0.1";
  mockVerifierServer.listen(port, host, () => console.log(`Mock verifier listening on http://${host}:${port}`));
}
