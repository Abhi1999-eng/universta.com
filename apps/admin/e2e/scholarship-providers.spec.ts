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

    const nameInput = page.getByRole('textbox', { name: 'Name', exact: true });
    const slugInput = page.getByRole('textbox', {
      name: 'Slug (optional)',
      exact: true,
    });
    const websiteInput = page.getByRole('textbox', {
      name: 'Website URL (optional)',
      exact: true,
    });
    const sourceInput = page.getByRole('textbox', {
      name: 'Source / reference URL (optional)',
      exact: true,
    });
    const statusInput = page.getByRole('combobox', { name: 'Status', exact: true });

    await page.getByRole('button', { name: 'Add provider' }).click();
    await nameInput.fill(providerName);
    await slugInput.fill(slug);
    await websiteInput.fill(website);
    await sourceInput.fill(source);
    await statusInput.selectOption('ACTIVE');
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
    await expect(nameInput).toHaveValue(providerName);
    await expect(slugInput).toHaveValue(slug);
    await expect(websiteInput).toHaveValue(website);
    await expect(sourceInput).toHaveValue(source);

    await nameInput.fill(updatedName);
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
