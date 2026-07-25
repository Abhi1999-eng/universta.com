import { expect, type Page } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../../playwright.config';

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(e2eEmail!);
  await page.getByLabel('Password').fill(e2ePassword!);
  await Promise.all([
    page.waitForURL(/\/dashboard$/),
    page.getByRole('button', { name: 'Sign in securely' }).click(),
  ]);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByRole('main').getByText(e2eEmail!, { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('SUPER_ADMIN', { exact: true })).toBeVisible();
}
