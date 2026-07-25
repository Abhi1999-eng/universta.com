import { defineConfig, devices } from '@playwright/test';

const e2eEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const e2ePassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

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
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'cd ../api && npm run start:dev',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 3001',
      url: 'http://127.0.0.1:3001/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_BASE_URL: 'http://127.0.0.1:4000',
        ADMIN_APP_ORIGIN: 'http://localhost:3001',
      },
    },
    {
      command: 'cd ../web && npm run dev -- --port 3000',
      url: 'http://127.0.0.1:3000/countries',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_BASE_URL: 'http://127.0.0.1:4000' },
    },
  ],
});

export { e2eEmail, e2ePassword };
