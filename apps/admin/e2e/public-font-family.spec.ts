import { expect, test, type Page } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

const PASSWORD = 'StudentPass123x';
const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'tablet', width: 768, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

// These routes cover the shared chrome/footer, catalogue cards and filters,
// rich editorial content, forms, and student authentication. The signed-in
// dashboard below adds the final public authenticated surface.
const publicRoutes = [
  '/',
  '/countries/united-kingdom',
  '/courses',
  '/subjects',
  '/scholarships',
  '/study-abroad-consultants',
  '/events',
  '/about',
  '/student/login',
];

async function expectVisibleTextToUseInter(page: Page, route: string) {
  await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content, `${route} must not overflow after the font consolidation`).toBeLessThanOrEqual(
    width.viewport + 2,
  );

  const unexpectedFonts = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        if (element.closest('svg, [aria-hidden="true"]')) return false;
        if (![...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
      })
      .map((element) => ({
        text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        font: getComputedStyle(element).fontFamily,
      }))
      .filter(({ font }) => !font.split(',')[0].toLowerCase().includes('inter')),
  );

  expect(unexpectedFonts, `${route} has visible non-Inter text`).toEqual([]);
}

async function signUpAndIn(page: Page) {
  const email = `font.audit.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
  await page.request.post(`${apiBaseUrl}/api/v1/student/auth/register`, {
    data: { firstName: 'Font', email, password: PASSWORD },
  });
  await page.goto(`${webBaseUrl}/student/login`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/student$/);
}

test('all visible public text resolves to Inter at supported viewports', async ({ page }) => {
  // This is deliberately a cross-route audit (30 public/auth navigations plus
  // the signed-in portal), so the normal one-screen interaction budget is not
  // sufficient even when every page is healthy.
  test.setTimeout(120_000);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of publicRoutes) {
      await expectVisibleTextToUseInter(page, route);
    }
  }

  await signUpAndIn(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectVisibleTextToUseInter(page, '/student');
  }
});
