import { expect, test, type Page } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../playwright.config';

test.describe.serial('catalog management', () => {
  const suffix = `E2E ${Date.now()}`;
  const continentName = `Browser Region ${suffix}`;
  const countryName = `Browser Country ${suffix}`;
  let countrySlug = '';

  async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(e2eEmail);
    await page.getByLabel('Password').fill(e2ePassword);
    await Promise.all([page.waitForURL('**/dashboard'), page.getByRole('button', { name: 'Sign in securely' }).click()]);
  }

  test('requires authentication for Countries', async ({ page }) => {
    await page.goto('/countries');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcountries/);
  });

  test('creates, publishes, unpublishes, and soft-deletes isolated catalog records', async ({ page, request }) => {
    const codeSeed = `${Date.now()}`
      .slice(-6)
      .split('')
      .map((digit) => String.fromCharCode(65 + Number(digit)))
      .join('');
    await login(page);
    await page.goto('/continents');
    await page.getByRole('button', { name: 'Create continent' }).click();
    await page.getByRole('dialog').getByLabel('Name *').fill(continentName);
    await page.getByRole('dialog').getByLabel('Slug *').fill(continentName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    await page.getByRole('dialog').getByLabel('Code').fill(`E${String(Date.now()).slice(-3)}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Save continent' }).click();
    await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();

    await page.goto('/countries/new');
    await page.getByLabel('Continent *').selectOption({ label: continentName });
    await page.getByLabel('Country name *').fill(countryName);
    countrySlug = countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.getByLabel('Slug *').fill(countrySlug);
    await page.getByLabel('ISO alpha-2 *').fill(codeSeed.slice(0, 2));
    await page.getByLabel('ISO alpha-3 *').fill(codeSeed.slice(0, 3));
    await page.getByLabel('Page heading *').fill(`Study in ${countryName}`);
    await page.getByLabel('Short description *').fill('An isolated browser E2E catalog record.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/countries\/[a-f0-9-]+$/);
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile editors' })).toBeVisible();
    await page.getByLabel('Currency code').fill('CAD');
    const costProfile = page.getByRole('group', { name: 'cost' });
    await costProfile.getByLabel('Source URL').fill('https://example.com/browser-profile');
    await costProfile.getByLabel('Verified at').fill('2026-01-01T00:00:00.000Z');
    await costProfile.getByRole('button', { name: 'Save cost' }).click();
    await expect(page.getByRole('status')).toContainText('cost profile saved.');
    const publicDraft = await request.get(`http://127.0.0.1:4000/api/v1/countries/${countrySlug}`);
    expect(publicDraft.status()).toBe(404);

    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish country' }).click();
    await expect(page.getByText('Country published.', { exact: true })).toBeVisible();
    const publicPublished = await request.get(`http://127.0.0.1:4000/api/v1/countries/${countrySlug}`);
    expect(publicPublished.status()).toBe(200);

    await page.getByRole('button', { name: 'Unpublish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Unpublish country' }).click();
    await expect(page.getByText('Country unpublished.', { exact: true })).toBeVisible();
    expect((await request.get(`http://127.0.0.1:4000/api/v1/countries/${countrySlug}`)).status()).toBe(404);

    await page.goto('/countries');
    const row = page.getByRole('row').filter({ hasText: countryName });
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByPlaceholder(countryName).fill(countryName);
    await page.getByRole('dialog').getByRole('button', { name: 'Delete country' }).click();
    await expect(page.getByText('Country soft-deleted.', { exact: true })).toBeVisible();
    await expect(page.getByText(countryName)).not.toBeVisible();
  });

  test('keeps mobile country actions accessible', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/countries');
    await expect(page.getByRole('heading', { name: 'Countries', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create country' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Countries' })).toHaveAttribute('aria-current', 'page');
  });
});
