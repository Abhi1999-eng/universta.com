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

function primaryFamily(font: string) {
  return font.split(',')[0].trim().toLowerCase();
}

test('public typography roles keep headings, cards and native controls on the shared contract', async ({ page }) => {
  await page.setViewportSize(viewports[0]);

  await page.goto(`${webBaseUrl}/courses`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const courses = await page.evaluate(() => {
    const style = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const computed = getComputedStyle(element);
      return {
        family: computed.fontFamily,
        size: computed.fontSize,
        weight: computed.fontWeight,
        lineHeight: computed.lineHeight,
      };
    };

    return {
      roles: [
        '--type-display',
        '--type-h1',
        '--type-h2',
        '--type-h3',
        '--type-h4',
        '--type-body-lg',
        '--type-body',
        '--type-body-sm',
        '--type-label',
        '--type-nav',
        '--type-button',
        '--type-stat',
        '--type-caption',
      ].map((name) => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()]),
      display: style('h1'),
      section: style('h2'),
      cardTitles: [...document.querySelectorAll<HTMLElement>('.card h3, .catalog-card h2, .catalog-card h3')]
        .slice(0, 8)
        .map((element) => getComputedStyle(element).font),
      button: style('button:not([aria-label])'),
      input: style('input:not([type="hidden"])'),
      select: style('select'),
    };
  });

  expect(courses.roles.every(([, value]) => value), 'every documented public type role has a value').toBe(true);
  expect(Number.parseFloat(courses.display?.size ?? '0')).toBeGreaterThan(
    Number.parseFloat(courses.section?.size ?? '0'),
  );
  expect(courses.cardTitles.length).toBeGreaterThan(0);
  expect(new Set(courses.cardTitles).size, 'equivalent public listing card titles use one role').toBe(1);
  for (const control of [courses.button, courses.input, courses.select]) {
    expect(control).not.toBeNull();
    expect(primaryFamily(control!.family)).toContain('inter');
  }
  expect(courses.input?.size).toBe('16px');
  expect(courses.select?.size).toBe('16px');

  await page.goto(`${webBaseUrl}/contact`, { waitUntil: 'domcontentloaded' });
  const textarea = await page.locator('textarea').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  });
  expect(primaryFamily(textarea.family)).toContain('inter');
  expect(textarea.size).toBe('16px');

  await signUpAndIn(page);
  const student = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>('.stu h1');
    const navigation = document.querySelector<HTMLElement>('.stu-nav a');
    return {
      heading: heading ? getComputedStyle(heading).font : null,
      navigation: navigation ? getComputedStyle(navigation).font : null,
    };
  });
  expect(student.heading).toContain('28px');
  expect(student.navigation).toContain('14.5px');
});

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
