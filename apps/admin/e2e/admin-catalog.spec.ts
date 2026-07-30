import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';
import { apiBaseUrl } from './helpers/e2e-urls';


test.describe.serial('catalog management', () => {
  const suffix = `E2E ${Date.now()}`;
  const continentName = `Browser Region ${suffix}`;
  const countryName = `Browser Country ${suffix}`;
  const continentCode = `E${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  let countrySlug = '';

  test('requires authentication for Countries', async ({ page }) => {
    await page.goto('/countries');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcountries/);
  });

  test('creates, publishes, unpublishes, and soft-deletes isolated catalog records', async ({ page, request }) => {
    await loginAsAdmin(page);
    await page.goto('/continents');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/continents$/);
    await expect(page.getByRole('heading', { name: 'Continents', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create continent' })).toBeVisible();
    await page.getByRole('button', { name: 'Create continent' }).click();
    await page.getByRole('dialog').getByLabel('Name *').fill(continentName);
    await page.getByRole('dialog').getByLabel('Slug *').fill(continentName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    await page.getByRole('dialog').getByLabel('Code').fill(continentCode);
    await page.getByRole('dialog').getByRole('button', { name: 'Save continent' }).click();
    await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();

    await page.goto('/countries/new');
    await page.getByLabel('Continent *').selectOption({ label: continentName });
    await page.getByLabel('Country name *').fill(countryName);
    countrySlug = countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.getByLabel('Slug *').fill(countrySlug);
    await page.getByLabel('Page heading *').fill(`Study in ${countryName}`);
    await page.getByLabel('Short description *').fill('An isolated browser E2E catalog record.');

    // ISO alpha-2/alpha-3 are DB-unique and ignore soft deletes, so a code a
    // previous run used stays taken forever even after that fixture is removed
    // through the UI. Restricting the first letter to "Q" keeps the fixture in
    // an ISO 3166 private-use range (no real country is impersonated) but only
    // leaves 26 alpha-2 values, so walk them until one is actually free rather
    // than guessing once and flaking when the guess is already burned.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let saved = false;
    for (const letter of letters) {
      await page.getByLabel('ISO alpha-2 *').fill(`Q${letter}`);
      await page.getByLabel('ISO alpha-3 *').fill(`Q${letter}X`);
      await page.getByRole('button', { name: 'Save draft' }).click();
      try {
        await expect(page).toHaveURL(/\/countries\/[a-f0-9-]+$/, { timeout: 3_000 });
        saved = true;
        break;
      } catch {
        await expect(
          page.getByText('Country ISO code already exists'),
          'Save draft failed for a reason other than an ISO code clash',
        ).toBeVisible();
      }
    }
    expect(saved, 'every QA-QZ ISO code is already taken locally').toBe(true);
    const publishingStatus = page.getByRole('status', { name: 'Country publishing status' });
    await expect(publishingStatus).toHaveText('DRAFT');
    await expect(page.getByRole('heading', { name: 'Profile editors' })).toBeVisible();
    await page.getByLabel('Currency code').fill('CAD');
    const costProfile = page.getByRole('group', { name: 'cost' });
    await costProfile.getByLabel('Source URL').fill('https://example.com/browser-profile');
    await costProfile.getByLabel('Verified at').fill('2026-01-01T00:00:00.000Z');
    await costProfile.getByRole('button', { name: 'Save cost' }).click();
    await expect(page.getByText('cost profile saved.', { exact: true })).toBeVisible();
    const publicDraft = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicDraft.status()).toBe(404);

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish country' }).click();
    await expect(page.getByText('Country published.', { exact: true })).toBeVisible();
    await expect(publishingStatus).toHaveText('PUBLISHED');
    const publicPublished = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicPublished.status()).toBe(200);

    await page.getByRole('button', { name: 'Unpublish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Unpublish country' }).click();
    await expect(page.getByText('Country unpublished.', { exact: true })).toBeVisible();
    await expect(publishingStatus).toHaveText('DRAFT');
    expect((await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`)).status()).toBe(404);

    await page.goto('/countries');
    const row = page.getByRole('row').filter({ hasText: countryName });
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByPlaceholder(countryName).fill(countryName);
    await page.getByRole('dialog').getByRole('button', { name: 'Delete country' }).click();
    await expect(page.getByText('Country soft-deleted.', { exact: true })).toBeVisible();
    await expect(page.getByText(countryName)).not.toBeVisible();

    await page.goto('/continents');
    await page.getByPlaceholder('Search by name, slug or code').fill(continentName);
    const continentRow = page.getByRole('row').filter({ hasText: continentName });
    await continentRow.getByRole('button', { name: 'Delete' }).click();
    const continentDialog = page.getByRole('dialog');
    await continentDialog.getByLabel('Confirmation').fill(continentName);
    await continentDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Continent deleted.', { exact: true })).toBeVisible();
    await expect(page.getByText(continentName)).not.toBeVisible();
  });

  test('keeps mobile country actions accessible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/countries');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/countries$/);
    await expect(page.getByRole('heading', { name: 'Countries', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create country' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Countries' })).toHaveAttribute('aria-current', 'page');
  });

  test('recovers safely from an out-of-range lead page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/leads?page=2');

    const pagination = page.getByRole('navigation', { name: 'Lead result pages' });
    await expect(pagination).toBeVisible();
    await pagination.getByRole('link', { name: 'Previous' }).click();
    await expect(page).toHaveURL(/\/leads$/);
  });
});
