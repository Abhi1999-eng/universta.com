import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';
import {
  acceptanceContinentName,
  acceptanceCountryName,
} from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';


test.describe.serial('catalog management', () => {
  const continentName = acceptanceContinentName();
  const countryName = acceptanceCountryName();
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

    // FieldLabel deliberately renders the red required marker as visible label
    // content. Browser accessible-name whitespace around that nested marker can
    // differ, so do not make this CRUD acceptance flow depend on whether the
    // computed label is "Name *", "Name*", or "Name". The native required
    // attribute is the stable contract for these two mandatory inputs.
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

    // The unified editor owns publishing too: there are no separate profile,
    // editorial, SEO, publish-dialog, or unpublish-dialog save flows anymore.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    const publicPublished = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicPublished.status()).toBe(200);

    await page.getByRole('button', { name: 'Move to draft', exact: true }).click();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    expect((await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`)).status()).toBe(404);

    await page.goto('/countries');
    await page.getByRole('button', { name: `Archive ${countryName}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archive country' }).click();
    await expect(page.getByText('Country archived.', { exact: true })).toBeVisible();

    await page.goto('/continents');
    await page.getByRole('button', { name: `Archive ${continentName}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Archive continent' }).click();
    await expect(page.getByText('Continent archived.', { exact: true })).toBeVisible();
  });

  test('keeps mobile country actions accessible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/countries');
    await expect(page.getByRole('button', { name: 'Create country' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('recovers safely from an out-of-range lead page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/leads?page=9999');
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
    await expect(page.getByText('No leads found.')).toBeVisible();
  });
});
