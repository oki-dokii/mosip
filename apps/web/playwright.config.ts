import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser", testMatch: "**/*.pw.ts", workers: 1,
  outputDir: "/tmp/person2-playwright-results", reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: "pnpm --filter @playground/mock-issuer exec tsx src/server.ts", url: "http://127.0.0.1:4101/.well-known/openid-credential-issuer", reuseExistingServer: false },
    { command: "pnpm --filter @playground/mock-verifier exec tsx src/server.ts", port: 4102, reuseExistingServer: false },
    { command: "pnpm --filter @playground/bff exec tsx src/server.ts", url: "http://127.0.0.1:4000/api/v1/health", reuseExistingServer: false, env: {
      DATABASE_URL: "", PLAYGROUND_DRIVER_MODE: "collab", MOCK_ISSUER_BASE_URL: "http://127.0.0.1:4101", MOCK_VERIFIER_BASE_URL: "http://127.0.0.1:4102",
      CAPTURE_ORIGINS_JSON: JSON.stringify({ "https://wallet.example": "mimoto", "https://issuer.example": "certify", "https://identity.example": "esignet", "https://verifier.example": "verify" }),
    } },
    { command: "pnpm exec vite --host 127.0.0.1", url: "http://127.0.0.1:5173", reuseExistingServer: false },
  ],
});
