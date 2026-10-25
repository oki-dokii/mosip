import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Separate entry point: never starts containers or visits Collab. No automatic
// credential-bearing screenshots, traces, HAR, videos or HTML report attachments.
export default defineConfig({
  testDir: "./browser/local", testMatch: "**/*.local.pw.ts", workers: 1,
  retries: 0, timeout: 20_000, reporter: "list",
  outputDir: join(tmpdir(), "person2-local-phase1-results"),
  use: { headless: true, actionTimeout: 4_000, navigationTimeout: 8_000, screenshot: "off", trace: "off", video: "off", serviceWorkers: "block" },
});
