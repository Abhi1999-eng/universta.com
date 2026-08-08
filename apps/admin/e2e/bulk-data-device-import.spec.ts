import { expect, test } from '@playwright/test';

test('bulk data page exposes device upload and validates before import', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.SEED_ADMIN_EMAIL ?? 'admin@universta.local');
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.goto('/bulk-data');

  await expect(page.getByRole('heading', { name: 'Bulk data import & export' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose file from device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import new records' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Import & update existing' })).toBeDisabled();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'invalid-subjects.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('slug,name,shortDescription,isFeatured,status,displayOrder\ninvalid-row,,Missing name,false,DRAFT,0\n'),
  });

  await expect(page.getByRole('alert').filter({ hasText: /Rows that need correction/i })).toBeVisible();
  await expect(page.getByText(/Row 2/)).toBeVisible();
  await expect(page.getByText(/name is required/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import new records' })).toBeDisabled();
});
