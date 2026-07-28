import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/ui-parity',
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-ui-parity-report' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 1,
  },
  webServer: [
    {
      command: 'cd ../api && npm run start:dev',
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NODE_ENV: 'test' },
    },
    {
      command: 'cd ../web && VISUAL_FIXTURE_MODE=true npm run dev -- --port 3000',
      url: 'http://127.0.0.1:3000/courses',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_BASE_URL: 'http://127.0.0.1:4000', VISUAL_FIXTURE_MODE: 'true' },
    },
    {
      command: 'node ../../scripts/reference-server.mjs --port 4100',
      url: 'http://127.0.0.1:4100/courses-listing.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
