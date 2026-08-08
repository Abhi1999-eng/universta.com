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

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const offenders = [...document.querySelectorAll<HTMLElement>('main *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > window.innerWidth + 2 ||
          rect.right > window.innerWidth + 2 ||
          rect.left < -2
        );
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        width: Math.round(element.getBoundingClientRect().width),
      }));

    return {
      viewport: window.innerWidth,
      scrollWidth: root.scrollWidth,
      offenders,
    };
  });

  expect(
    metrics.scrollWidth,
    `${route} must not scroll horizontally`,
  ).toBeLessThanOrEqual(metrics.viewport + 2);
  expect(metrics.offenders, `${route} has viewport-overflowing elements`).toEqual(
    [],
  );
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
