import { expect, test } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../playwright.config';

test.describe.serial('isolated authoritative Phase 1 Admin authentication', () => {
  test('redirects fresh contexts from dashboard and protected Phase 1 resources', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login\?returnTo=%2Fdashboard/, { timeout: 20_000 });

    await page.goto('/phase1/universities');
    await page.waitForURL(/\/login\?returnTo=%2Fphase1%2Funiversities/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  });

  test('rejects malformed and invalidly signed refresh cookies before protected content renders', async ({ browser }) => {
    for (const token of ['malformed', 'eyJhbGciOiJIUzI1NiJ9.invalid.signature']) {
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: 'universta_admin_refresh',
          value: token,
          url: 'http://localhost:3001',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      await page.goto('/dashboard');
      await page.waitForURL(/\/login\?returnTo=%2Fdashboard/, { timeout: 20_000 });
      await expect(page.getByText('Checking your admin session…')).toHaveCount(0);
      await context.close();
    }
  });

  test('keeps login public, rejects invalid credentials, preserves a safe returnTo, and invalidates logout', async ({ page }) => {
    await page.goto('/login?returnTo=%2Fphase1%2Funiversities');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

    await page.getByLabel('Email address').fill(e2eEmail!);
    await page.getByLabel('Password').fill(`${e2ePassword}-invalid`);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();

    await page.getByLabel('Password').fill(e2ePassword!);
    await Promise.all([
      page.waitForURL(/\/phase1\/universities$/),
      page.getByRole('button', { name: 'Sign in securely' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Universities' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Good to see you,/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fdashboard/);
    await page.reload();
    await page.waitForURL(/\/login\?returnTo=%2Fdashboard/);
  });

  test('ignores unsafe and protocol-relative returnTo values', async ({ page }) => {
    await page.goto('/login?returnTo=https%3A%2F%2Fexample.invalid');
    await page.getByLabel('Email address').fill(e2eEmail!);
    await page.getByLabel('Password').fill(e2ePassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard$/),
      page.getByRole('button', { name: 'Sign in securely' }).click(),
    ]);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.goto('/login?returnTo=%2F%2Fevil.example');
    await page.getByLabel('Email address').fill(e2eEmail!);
    await page.getByLabel('Password').fill(e2ePassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard$/),
      page.getByRole('button', { name: 'Sign in securely' }).click(),
    ]);
  });
});
