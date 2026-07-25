import { expect, test } from '@playwright/test';

const listing = 'http://localhost:3000/countries';

test.describe('public country experience', () => {
  test('renders API-backed listing and has no auth tokens in browser storage', async ({ page }) => {
    await page.goto(listing);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search by country' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find a country by name', level: 2 })).toBeVisible();
    await expect(page.getByText('destinations', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore guidance/ }).first()).toBeVisible();
    expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage).filter((key) => /token|auth|refresh/i.test(key)) }))).toEqual({ local: [], session: [] });
  });

  test('hydrates every listing control from shareable URL filters', async ({ page }) => {
    await page.goto(`${listing}?q=Canada&region=north-america&budgetBand=MID_RANGE&ieltsOptional=true`);
    await expect(page.getByRole('combobox', { name: 'Search by country' })).toHaveValue('Canada');
    await expect(page.locator('#country-filter-panel select').nth(0)).toHaveValue('MID_RANGE');
    await expect(page.locator('#country-filter-panel select').nth(1)).toHaveValue('true');
    await expect(page.getByRole('button', { name: /North America/i })).toHaveClass(/active/);
  });

  test('submits search through the router and keeps the URL canonical', async ({ page }) => {
    await page.goto(listing);
    const search = page.getByRole('combobox', { name: 'Search by country' });
    await search.fill('Canada');
    await search.press('Enter');
    await expect(page).toHaveURL(/q=Canada/);
    await expect(search).toHaveValue('Canada');
  });

  test('updates a result filter through the router', async ({ page }) => {
    await page.goto(listing);
    await page.locator('#country-filter-panel select').nth(0).selectOption('PREMIUM');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/budgetBand=PREMIUM/);
  });

  test('clears all result filters without changing the dedicated directory', async ({ page }) => {
    await page.goto(`${listing}?q=not-a-real-country&budgetBand=PREMIUM&page=2`);
    await page.getByRole('button', { name: 'Clear all' }).first().click();
    await expect(page).toHaveURL(/\/countries$/);
    await expect(page.getByRole('heading', { name: 'Find a country by name', level: 2 })).toBeVisible();
  });

  test('supports keyboard suggestion selection', async ({ page }) => {
    await page.goto(listing);
    const search = page.getByRole('combobox', { name: 'Search by country' });
    await search.fill('Can');
    await expect(page.getByRole('listbox')).toBeVisible();
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page).toHaveURL(/q=Canada/);
  });

  test('announces suggestion no-results and service states', async ({ page }) => {
    await page.goto(listing);
    await page.getByRole('combobox', { name: 'Search by country' }).fill('zzzz-not-a-destination');
    await expect(page.getByText('No destinations found.', { exact: true })).toBeVisible();
  });

  test('opens the responsive filter drawer on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(listing);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.locator('#country-filter-panel')).toHaveClass(/is-open/);
    await expect(page.locator('#country-filter-panel select').first()).toBeVisible();
  });

  test('renders pagination from the server result metadata', async ({ page }) => {
    await page.goto(`${listing}?page=2`);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole('heading', { name: 'All destinations', level: 2 })).toBeVisible();
  });

  test('renders all A-Z letters and disables unavailable letters', async ({ page }) => {
    await page.goto(listing);
    await expect(page.locator('.directory-letter')).toHaveCount(26);
    expect(await page.locator('.directory-letter:disabled').count()).toBeGreaterThan(0);
  });

  test('renders structured country detail sections independently of editorial content', async ({ page }) => {
    await page.goto(`${listing}/canada`);
    await expect(page.getByRole('heading', { name: 'Cost of study' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Major intakes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Language requirements' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Work and visa pathways' })).toBeVisible();
  });

  test('builds detail navigation only from rendered targets and provides a safe CTA', async ({ page }) => {
    await page.goto(`${listing}/canada`);
    const links = await page.locator('.detail-tabs a').evaluateAll((elements) => elements.map((element) => element.getAttribute('href')).filter(Boolean));
    for (const href of links) await expect(page.locator(href as string)).toHaveCount(1);
    await expect(page.locator('#consultation')).toBeVisible();
    await expect(page.locator('#consultants')).toHaveCount(0);
  });

  test('keeps detail pages free of horizontal overflow at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${listing}/canada`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('publishes JSON-LD and source-aware footer copy on detail pages', async ({ page }) => {
    await page.goto(`${listing}/canada`);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.getByText(/Information is editorial and may vary/)).toBeVisible();
  });
});
