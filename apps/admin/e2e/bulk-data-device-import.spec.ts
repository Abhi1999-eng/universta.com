import { expect, test } from '@playwright/test';
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
