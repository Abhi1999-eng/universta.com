import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';
import {
  acceptanceContinentName,
  acceptanceCountryName,
} from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';


test.describe.serial('catalog management', () => {
  test('requires authentication for Countries', async ({ page }) => {
    await page.goto('/countries');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcountries/);
  });

  test('creates, publishes, unpublishes, and soft-deletes isolated catalog records', async ({ page, request }, testInfo) => {
    // A retry gets fresh names so a partially-created first attempt can never
    // make the retry fail on a duplicate continent/country before it reaches
    // the assertion that originally failed.
    const retrySuffix = testInfo.retry ? ` Retry ${testInfo.retry}` : '';
    const continentName = `${acceptanceContinentName()}${retrySuffix}`;
    const countryName = `${acceptanceCountryName()}${retrySuffix}`;
    const continentCode = `E${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    let countrySlug = '';

    await loginAsAdmin(page);
    await page.goto('/continents');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/continents$/);
    await expect(page.getByRole('heading', { name: 'Continents', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create continent' })).toBeVisible();
    await page.getByRole('button', { name: 'Create continent' }).click();

    // FieldLabel deliberately renders the red required marker as visible label
    // content. Browser accessible-name whitespace around that nested marker can
    // differ, so use the native required contract for these two mandatory inputs.
    const continentDialog = page.getByRole('dialog');
    const requiredInputs = continentDialog.locator('input[required]');
    await expect(requiredInputs).toHaveCount(2);
    await requiredInputs.nth(0).fill(continentName);
    await requiredInputs.nth(1).fill(continentName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    await continentDialog.getByRole('textbox', { name: 'Code', exact: true }).fill(continentCode);
    await continentDialog.getByRole('button', { name: 'Save continent' }).click();
    await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();

    await page.goto('/countries/new');
    await page.getByLabel('Continent *').selectOption({ label: continentName });
    await page.getByLabel('Country name *').fill(countryName);
    countrySlug = countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.getByLabel('Slug *').fill(countrySlug);
    await page.getByLabel('Page heading *').fill(`Study in ${countryName}`);
    await page.getByLabel('Short description *').fill('An isolated browser E2E catalog record.');

    // ISO alpha-2/alpha-3 are DB-unique and ignore soft deletes, so walk the
    // private-use QA-QZ range until the test finds a value that is still free.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let saved = false;
    for (const letter of letters) {
      await page.getByLabel('ISO alpha-2 *').fill(`Q${letter}`);
      await page.getByLabel('ISO alpha-3 *').fill(`Q${letter}X`);
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
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

    await expect(page.getByRole('heading', { name: 'Edit country' })).toBeVisible();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    const publicDraft = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicDraft.status()).toBe(404);

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    const publicPublished = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicPublished.status()).toBe(200);

    await page.getByRole('button', { name: 'Move to draft', exact: true }).click();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    expect((await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`)).status()).toBe(404);

    // The real Countries list uses Delete (soft delete), not Archive. Filter to
    // the record first so cleanup is independent of first-page ordering.
    await page.goto('/countries');
    await page.getByRole('textbox', { name: 'Search countries' }).fill(countryName);
    const countryRow = page.getByRole('row').filter({ hasText: countryName });
    await expect(countryRow).toBeVisible();
    await countryRow.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteCountryDialog = page.getByRole('dialog');
    await deleteCountryDialog.getByPlaceholder(countryName).fill(countryName);
    await deleteCountryDialog.getByRole('button', { name: 'Delete country', exact: true }).click();
    await expect(page.getByText('Country soft-deleted.', { exact: true })).toBeVisible();

    // Continents also use Delete. Search before acting so list pagination/order
    // cannot hide the acceptance record.
    await page.goto('/continents');
    await page.getByPlaceholder('Search by name, slug or code').fill(continentName);
    const continentRow = page.getByRole('row').filter({ hasText: continentName });
    await expect(continentRow).toBeVisible();
    await continentRow.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteContinentDialog = page.getByRole('dialog');
    await deleteContinentDialog.getByLabel('Confirmation').fill(continentName);
    await deleteContinentDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Continent deleted.', { exact: true })).toBeVisible();
  });

  test('keeps mobile country actions accessible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/countries');
    await expect(page.getByRole('link', { name: 'Create country' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('recovers safely from an out-of-range lead page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/leads?page=9999');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
