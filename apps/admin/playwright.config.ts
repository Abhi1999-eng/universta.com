import { defineConfig, devices } from '@playwright/test';

const e2eEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const e2ePassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
const apiPort = process.env.E2E_API_PORT ?? '4000';
const adminPort = process.env.E2E_ADMIN_PORT ?? '3001';
const webPort = process.env.E2E_WEB_PORT ?? '3000';
const apiBaseUrl =
  process.env.E2E_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;
const adminBaseUrl =
  process.env.E2E_ADMIN_BASE_URL ?? `http://localhost:${adminPort}`;
const webBaseUrl =
  process.env.E2E_WEB_BASE_URL ?? `http://localhost:${webPort}`;

if (!e2eEmail || !e2ePassword) {
  throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for browser tests');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'line',
  use: {
    baseURL: adminBaseUrl,
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
      env: { API_BASE_URL: apiBaseUrl },
    },
  ],
});

export { e2eEmail, e2ePassword };
