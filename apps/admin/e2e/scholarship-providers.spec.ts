import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';

test.describe('scholarship provider management', () => {
  test('creates, edits, and permanently deletes an unreferenced provider', async ({
    page,
  }) => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const providerName = `Provider E2E ${suffix}`;
    const updatedName = `${providerName} Updated`;
    const slug = `provider-e2e-${suffix}`;
    const website = `https://example.com/${suffix}`;
    const source = `https://example.com/${suffix}/source`;

    await loginAsAdmin(page);
    await page.goto('/catalog-masters?section=scholarship-providers');

    await expect(
      page.getByRole('heading', { name: 'Scholarship providers', level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add provider' })).toBeVisible();

    await page.getByRole('button', { name: 'Add provider' }).click();
    await page.getByLabel('Name').fill(providerName);
    await page.getByLabel('Slug (optional)').fill(slug);
    await page.getByLabel('Website URL (optional)').fill(website);
    await page.getByLabel('Source / reference URL (optional)').fill(source);
    await page.getByLabel('Status').selectOption('ACTIVE');
    await page.getByRole('button', { name: 'Create provider' }).click();

    await expect(page.getByText(providerName, { exact: true })).toBeVisible();
    const createdRow = page
      .getByText(providerName, { exact: true })
      .locator('..')
      .locator('..');
    await expect(createdRow.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(createdRow.getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(createdRow.getByText('0 scholarships', { exact: true })).toBeVisible();

    await createdRow.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name')).toHaveValue(providerName);
    await expect(page.getByLabel('Slug (optional)')).toHaveValue(slug);
    await expect(page.getByLabel('Website URL (optional)')).toHaveValue(website);
    await expect(page.getByLabel('Source / reference URL (optional)')).toHaveValue(
      source,
    );

    await page.getByLabel('Name').fill(updatedName);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(updatedName, { exact: true })).toBeVisible();

    const updatedRow = page
      .getByText(updatedName, { exact: true })
      .locator('..')
      .locator('..');
    page.once('dialog', (dialog) => dialog.accept());
    await updatedRow.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(updatedName, { exact: true })).not.toBeVisible();
  });
});
