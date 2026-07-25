import { expect, test } from '@playwright/test';

test.describe('public country experience', () => {
  test('renders API-backed listing and has no auth tokens in browser storage', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000/countries');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search by country' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Find a country by name', level: 2 })).toBeVisible();
    await expect(page.getByText('destinations', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore guidance/ }).first()).toBeVisible();
    expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
  });

  test('supports keyboard country search and a country detail route', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000/countries');
    const search = page.getByRole('combobox', { name: 'Search by country' });
    await search.fill('Canada');
    await search.press('Enter');
    await expect(page.getByText(/destination/).first()).toBeVisible();
    await page.goto('http://127.0.0.1:3000/countries/canada');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /Talk to a counsellor/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Countries' }).first()).toBeVisible();
    await expect(page.getByText(/Information is editorial and may vary/)).toBeVisible();
  });
});
