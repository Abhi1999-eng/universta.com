import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';

test.describe('consultant location management', () => {
  test('creates, edits, saves SEO, and archives a consultant location', async ({
    page,
  }) => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const name = `London Office E2E ${suffix}`;
    const slug = `london-office-e2e-${suffix}`;

    await loginAsAdmin(page);
    await page.goto('/consultant-locations');
    await expect(
      page.getByRole('heading', { name: 'Consultant locations', level: 2 }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add location' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Slug', { exact: true }).fill(slug);

    const country = page.getByLabel('Country', { exact: true });
    await expect(country.locator('option')).not.toHaveCount(1);
    await country.selectOption({ index: 1 });

    await page
      .getByLabel('State / province (optional)', { exact: true })
      .fill('Greater London');
    await page.getByLabel('City', { exact: true }).fill('London');
    await expect(page.getByLabel('Active', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Create location' }).click();

    let row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`/${slug}`);
    await expect(row).toContainText('London');
    await expect(row).toContainText('ACTIVE');

    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(slug);
    await expect(page.getByLabel('City', { exact: true })).toHaveValue('London');
    await expect(
      page.getByLabel('State / province (optional)', { exact: true }),
    ).toHaveValue('Greater London');

    await page.getByLabel('City', { exact: true }).fill('Central London');
    await page.getByLabel('Active', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();

    row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('Central London');
    await expect(row).toContainText('INACTIVE');

    await row.getByRole('button', { name: 'SEO' }).click();
    await page.getByLabel('SEO title', { exact: true }).fill(`${name} SEO`);
    await page
      .getByLabel('Meta description', { exact: true })
      .fill('Fictional consultant office used for automated acceptance testing.');
    await page.getByLabel('Robots Index', { exact: true }).uncheck();
    await expect(page.getByLabel('Robots Follow', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Save SEO' }).click();
    // The panel closes itself once the save lands, and the row's SEO control
    // is a toggle. Reopening before the save resolves therefore toggles the
    // still-open panel shut instead of reopening it, and the fields never come
    // back. Wait for the save's own confirmation before asking for it again.
    await expect(page.getByRole('status')).toContainText(`Saved SEO for ${name}.`);
    await expect(page.getByLabel('SEO title', { exact: true })).toHaveCount(0);

    await row.getByRole('button', { name: 'SEO' }).click();
    await expect(page.getByLabel('SEO title', { exact: true })).toHaveValue(`${name} SEO`);
    await expect(page.getByLabel('Robots Index', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('Robots Follow', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Close' }).click();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('row').filter({ hasText: name })).not.toBeVisible();
  });
});
