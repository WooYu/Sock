import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const usesExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium", ...(channel ? { channel } : {}) } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", ...(channel ? { channel } : {}) } },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
