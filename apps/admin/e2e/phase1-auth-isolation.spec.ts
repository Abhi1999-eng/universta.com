import { expect, test } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../playwright.config';

test.describe.serial('isolated Phase 1 Admin authentication', () => {
  test('starts unauthenticated, logs in, rejects invalid credentials, and logs out', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login\?returnTo=%2Fdashboard/, { timeout: 20_000 });

    await page.getByLabel('Email address').fill(e2eEmail!);
    await page.getByLabel('Password').fill(`${e2ePassword}-invalid`);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();

    await page.getByLabel('Password').fill(e2ePassword!);
    await Promise.all([
      page.waitForURL(/\/dashboard$/),
      page.getByRole('button', { name: 'Sign in securely' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
