import { defineConfig } from "@playwright/test";

const issuerPort = Number(process.env.PLAYGROUND_BROWSER_ISSUER_PORT ?? 4101);
const verifierPort = Number(process.env.PLAYGROUND_BROWSER_VERIFIER_PORT ?? 4102);
const bffPort = Number(process.env.PLAYGROUND_BROWSER_BFF_PORT ?? 4000);
const webPort = Number(process.env.PLAYGROUND_BROWSER_WEB_PORT ?? 5173);
const issuerUrl = `http://127.0.0.1:${issuerPort}`;
const verifierUrl = `http://127.0.0.1:${verifierPort}`;
const bffUrl = `http://127.0.0.1:${bffPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./browser", testMatch: "**/*.pw.ts", workers: 1,
  outputDir: "/tmp/person2-playwright-results", reporter: "list",
  use: { baseURL: webUrl, viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: "pnpm --filter @playground/mock-issuer exec tsx src/server.ts", url: `${issuerUrl}/.well-known/openid-credential-issuer`, reuseExistingServer: false, env: { MOCK_ISSUER_PORT: String(issuerPort), MOCK_ISSUER_PUBLIC_URL: issuerUrl } },
    { command: "pnpm --filter @playground/mock-verifier exec tsx src/server.ts", port: verifierPort, reuseExistingServer: false, env: { MOCK_VERIFIER_PORT: String(verifierPort), MOCK_VERIFIER_PUBLIC_URL: verifierUrl } },
    { command: "pnpm --filter @playground/bff exec tsx src/server.ts", url: `${bffUrl}/api/v1/health`, reuseExistingServer: false, env: {
      DATABASE_URL: "", PORT: String(bffPort), WEB_ORIGIN: webUrl, PLAYGROUND_DRIVER_MODE: "collab", MOCK_ISSUER_BASE_URL: issuerUrl, MOCK_VERIFIER_BASE_URL: verifierUrl,
      CAPTURE_ORIGINS_JSON: JSON.stringify({ "https://wallet.example": "mimoto", "https://issuer.example": "certify", "https://identity.example": "esignet", "https://verifier.example": "verify" }),
    } },
    { command: "pnpm exec vite --host 127.0.0.1", url: webUrl, reuseExistingServer: false, env: { PLAYGROUND_WEB_DEV_PORT: String(webPort), PLAYGROUND_BFF_URL: bffUrl } },
  ],
});
