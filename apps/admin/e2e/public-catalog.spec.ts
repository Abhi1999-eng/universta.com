import { expect, test } from '@playwright/test';

test.describe('public subject and course discovery', () => {
  test('renders the empty subject catalog with a safe discovery state', async ({ page }) => {
    await page.goto('http://localhost:3000/subjects');
    await expect(page.getByRole('heading', { name: 'Find the subject that moves you forward.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No subjects found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore courses' })).toBeVisible();
  });

  test('renders course filters and preserves an empty result state', async ({ page }) => {
    await page.goto('http://localhost:3000/courses');
    await expect(page.getByRole('heading', { name: 'Find a course that fits your next step.' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Subject' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No courses found' })).toBeVisible();
  });

  test('keeps catalog pages free of horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/courses');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
