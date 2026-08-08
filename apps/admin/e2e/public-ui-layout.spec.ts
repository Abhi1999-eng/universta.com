import { expect, test, type Page } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

const routes = [
  '/courses',
  '/subjects',
  '/careers',
  '/about',
  '/faq',
  '/events',
  '/testimonials',
  '/success-stories',
  '/study-abroad-consultants',
];

async function assertLayout(page: Page, route: string) {
  await page.goto(`${webBaseUrl}${route}`);
  await expect(page.locator('body')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(
    metrics.scrollWidth,
    `${route} must not scroll horizontally`,
  ).toBeLessThanOrEqual(metrics.viewport + 2);
}

test.describe('public UI layout', () => {
  for (const route of routes) {
    test(`${route} keeps the approved layout on desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await assertLayout(page, route);
    });

    test(`${route} keeps the approved layout on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await assertLayout(page, route);
    });
  }
});
