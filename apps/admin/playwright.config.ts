import { defineConfig, devices } from '@playwright/test';
import { adminBaseUrl, apiBaseUrl, webBaseUrl } from './e2e/helpers/e2e-urls';

const e2eEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const e2ePassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
// Ports for the webServer launch commands are derived from the same
// *_BASE_URL values the spec files themselves navigate to (via
// e2e/helpers/e2e-urls.ts) — this used to be a second, independent set of
// *_PORT env vars, which silently drifted from the URLs the tests actually
// used whenever only the *_PORT vars were set, making every non-default-port
// run 404/origin-reject against the wrong (often a sibling checkout's) app.
const apiPort = new URL(apiBaseUrl).port || '4000';
const adminPort = new URL(adminBaseUrl).port || '3001';
const webPort = new URL(webBaseUrl).port || '3000';

if (!e2eEmail || !e2ePassword) {
  throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for browser tests');
}

export default defineConfig({
  testDir: './e2e',
  // Backstop that guarantees "repeated runs leave zero acceptance records"
  // even when a run crashes before the spec's own cleanup executes.
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'line',
  use: {
    baseURL: adminBaseUrl,
    // Every test starts with an explicit empty state, regardless of any local
    // developer browser profile or a previous Playwright run.
    storageState: { cookies: [], origins: [] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `cd ../api && PORT=${apiPort} npm run start:dev`,
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${adminPort}`,
      url: `${adminBaseUrl}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_BASE_URL: apiBaseUrl,
        ADMIN_APP_ORIGIN: adminBaseUrl,
      },
    },
    {
      command: `cd ../web && npm run dev -- --port ${webPort}`,
      url: `${webBaseUrl}/countries`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_BASE_URL: apiBaseUrl,
        NEXT_PUBLIC_WEB_ORIGIN: webBaseUrl,
        NEXT_PUBLIC_SITE_URL: webBaseUrl,
      },
    },
  ],
});

export { e2eEmail, e2ePassword };
