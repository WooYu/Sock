import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const usesExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const channel = process.env.PLAYWRIGHT_CHANNEL;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const theme = process.env.PLAYWRIGHT_THEME === 'd' ? 'd' : 'c';

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'stockcal-theme', value: theme }] }] },
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium", ...(channel ? { channel } : {}) } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", ...(channel ? { channel } : {}) } },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
