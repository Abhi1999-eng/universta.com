import { expect, test } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../playwright.config';

test('protects the dashboard, restores the session, and logs out', async ({ page, context }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const authResponses: Array<{ status: number; cacheControl: string | undefined; requestId: string | undefined }> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.includes('/api/v1/admin/auth/')) {
      authResponses.push({
        status: response.status(),
        cacheControl: response.headers()['cache-control'],
        requestId: response.headers()['x-request-id'],
      });
    }
  });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard/);
  consoleErrors.length = 0;
  failedRequests.length = 0;

  await page.getByLabel('Email address').fill(e2eEmail);
  await page.getByLabel('Password').fill(e2ePassword);
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.getByRole('button', { name: 'Sign in securely' }).click(),
  ]);

  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByRole('main').getByText(e2eEmail)).toBeVisible();
  await expect(page.getByRole('main').getByText('SUPER_ADMIN')).toBeVisible();
  const cookies = await context.cookies();
  const refreshCookie = cookies.find((cookie) => cookie.name === 'universta_admin_refresh');
  expect(refreshCookie?.httpOnly).toBe(true);
  expect(refreshCookie?.path).toBe('/api/v1/admin/auth');
  const storage = await page.evaluate(() => ({
    localKeys: Object.keys(localStorage),
    sessionKeys: Object.keys(sessionStorage),
    tokenLikeValues: [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) => /token|bearer|^eyJ/i.test(value)),
  }));
  expect(storage.localKeys.join(',')).not.toMatch(/token|auth/i);
  expect(storage.sessionKeys.join(',')).not.toMatch(/token|auth/i);
  expect(storage.tokenLikeValues).toBe(false);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('main').getByText(e2eEmail)).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  consoleErrors.length = 0;
  failedRequests.length = 0;
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard/);
  expect(authResponses.length).toBeGreaterThan(0);
  expect(authResponses.every((item) => item.cacheControl === 'no-store')).toBe(true);
  expect(authResponses.every((item) => Boolean(item.requestId))).toBe(true);
  expect(consoleErrors.filter((message) => !message.includes('401 (Unauthorized)'))).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('shows a generic error for invalid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(e2eEmail);
  await page.getByLabel('Password').fill(`${e2ePassword}-wrong`);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  const formAlert = page.getByRole('main').getByRole('alert');
  await expect(formAlert).toContainText('Unable to sign in. Check your details or try again shortly.');
  await expect(formAlert).not.toContainText(/password|role|locked|database|127\.0\.0\.1/i);
});

test('opens and closes the responsive navigation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Email address').fill(e2eEmail);
  await page.getByLabel('Password').fill(e2ePassword);
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.getByRole('button', { name: 'Sign in securely' }).click(),
  ]);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
