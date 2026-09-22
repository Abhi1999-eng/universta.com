import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { loginAsAdmin } from './helpers/admin-auth';

test('bulk data page exposes device upload and blocks import on row errors', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/bulk-data');

  await expect(
    page.getByRole('heading', { name: 'Bulk data import & export' }),
  ).toBeVisible();
  await page.getByLabel('Resource').selectOption({ label: 'Subjects' });
  await expect(
    page.getByRole('button', { name: 'Choose file from device' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Import new records' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Import & update existing' }),
  ).toBeDisabled();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'invalid-subjects.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'slug,name,shortDescription,isFeatured,status,displayOrder\ninvalid-row,,Missing name,false,DRAFT,0\n',
    ),
  });

  await expect(
    page.getByRole('alert').filter({ hasText: /Rows that need correction/i }),
  ).toBeVisible();
  await expect(page.getByText('Row 2')).toBeVisible();
  await expect(page.getByText(/name is required/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Import new records' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Import & update existing' }),
  ).toBeDisabled();
});

/**
 * The whole path an editor takes: download the template, fill it in, upload
 * it, import it, then upload the same file again to update what it created.
 * The subject is named with this run's country prefix, so the acceptance
 * teardown removes it with the run's other subjects.
 */
test('a downloaded template imports, and re-imports as an update', async ({ page }) => {
  const name = `${acceptanceCountryName()} Bulk Subject`;
  await loginAsAdmin(page);
  await page.goto('/bulk-data');
  await page.getByLabel('Resource').selectOption({ label: 'Subjects' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV template' }).click();
  const template = await readFile(await (await download).path(), 'utf8');
  expect(template).toContain('Demo Subject');
  const csv = template.replaceAll('Demo Subject', name);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'subjects.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/1 row\(s\) validated successfully/)).toBeVisible();

  await page.getByRole('button', { name: 'Import new records' }).click();
  await expect(
    page.getByText('Import complete: 1 created and 0 updated in the database.'),
  ).toBeVisible();

  await fileInput.setInputFiles({
    name: 'subjects-again.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/1 row\(s\) validated successfully/)).toBeVisible();
  await page.getByRole('button', { name: 'Import & update existing' }).click();
  await expect(
    page.getByText('Import complete: 0 created and 1 updated in the database.'),
  ).toBeVisible();
});
