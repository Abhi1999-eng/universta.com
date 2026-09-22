import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { loginAsAdmin } from './helpers/admin-auth';
import { apiBaseUrl } from './helpers/e2e-urls';

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
 * teardown removes it with the run's other subjects. It is archived as soon as
 * the test ends as well: it is a draft, and a later spec that ticks the first
 * free subject on a country and expects it on the public page must not find
 * this one.
 */
async function archiveSubject(request: APIRequestContext, name: string) {
  const login = await request.post(`${apiBaseUrl}/api/v1/admin/auth/login`, {
    data: {
      email: process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD,
    },
  });
  const token = ((await login.json()) as { data: { accessToken: string } }).data
    .accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const records = await request.get(
    `${apiBaseUrl}/api/v1/admin/bulk/subjects/records`,
    { headers },
  );
  const ids = ((await records.json()) as { data: Array<{ id: string; name: string }> }).data
    .filter((row) => row.name === name)
    .map((row) => row.id);
  if (ids.length)
    await request.post(`${apiBaseUrl}/api/v1/admin/bulk/subjects/bulk-archive`, {
      headers,
      data: { ids },
    });
  // What the country editor's subject picker reads.
  const listed = await request.get(
    `${apiBaseUrl}/api/v1/admin/subjects?q=${encodeURIComponent(name)}`,
    { headers },
  );
  expect(((await listed.json()) as { data: unknown[] }).data).toEqual([]);
}

test('a downloaded template imports, and re-imports as an update', async ({
  page,
  request,
}) => {
  const name = `${acceptanceCountryName()} Bulk Subject`;
  test.info().setTimeout(90_000);
  try {
    await importTwice(page, name);
  } finally {
    await archiveSubject(request, name);
  }
});

async function importTwice(page: import('@playwright/test').Page, name: string) {
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
}
