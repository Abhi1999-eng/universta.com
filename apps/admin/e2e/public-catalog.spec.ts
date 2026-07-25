import { expect, test } from '@playwright/test';

test.describe('public subject and course discovery', () => {
  test('renders the empty subject catalog with a safe discovery state', async ({ page }) => {
    await page.goto('http://localhost:3000/subjects');
    await expect(page.getByRole('heading', { name: 'Find the subject that moves you forward.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No subjects found' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore published subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Featured subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browse subjects by name' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore courses' })).toBeVisible();
  });

  test('keeps the subject specialisations route safe when the record is unpublished', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/subjects/not-a-published-subject/specializations');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
  });

  test('does not load reference HTML or persist auth tokens on public subject pages', async ({ page }) => {
    await page.goto('http://localhost:3000/subjects');
    const inspection = await page.evaluate(() => ({
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
    }));
    expect(inspection.resources.some((resource) => /\.html(?:$|[?#])/i.test(resource))).toBe(false);
    expect(inspection.localKeys.join(',')).not.toMatch(/token|auth|refresh/i);
    expect(inspection.sessionKeys.join(',')).not.toMatch(/token|auth|refresh/i);
  });

  test('renders course filters and preserves an empty result state', async ({ page }) => {
    await page.goto('http://localhost:3000/courses');
    await expect(page.getByRole('heading', { name: 'Find a course that fits your next step.' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Subject' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No courses found' })).toBeVisible();
  });

  test('keeps catalog pages free of horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/subjects');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goto('http://localhost:3000/courses');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
