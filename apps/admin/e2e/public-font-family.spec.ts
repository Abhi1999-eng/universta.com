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
//
// The /study-abroad family is deliberately absent: it renders the
// client-approved design with that design's own typefaces (Sora and Manrope),
// scoped to the route. study-abroad.spec.ts asserts those faces instead, and
// that they do not reach any page here.
/* The Study Abroad family is not audited here and never was: the approved
 * design brings its own typefaces (Sora and Manrope), scoped to `.sa`, rather
 * than the site's Inter. `/` left this list when the destination listing
 * became the homepage and joined that family, and `/courses` and `/subjects`
 * left it when the approved design reached them too -- the same reason
 * `/study-abroad/...` was never in it. `/events` left with the contact page
 * and the other content directories for the same reason, and
 * `/study-abroad-consultants` when the consultants directory followed, and
 * `/scholarships` when the finder and the award pages did. */
const publicRoutes = [
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

test('public typography roles keep headings and native controls on the shared contract', async ({ page }) => {
  await page.setViewportSize(viewports[0]);

  /* This probes the shared public type contract, so it has to stand on a page
     that still uses it. Every public listing has joined the approved Study
     Abroad design and its scoped typefaces -- `/courses`, `/universities` and
     now `/scholarships`, which carried this probe until then -- so the
     student login is the public page that still wears the shared chrome and
     its native controls. */
  await page.goto(`${webBaseUrl}/student/login`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const shared = await page.evaluate(() => {
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
      button: style('button[type="submit"]'),
      input: style('input:not([type="hidden"])'),
    };
  });

  expect(shared.roles.every(([, value]) => value), 'every documented public type role has a value').toBe(true);
  expect(Number.parseFloat(shared.display?.size ?? '0')).toBeGreaterThan(
    Number.parseFloat(shared.section?.size ?? '0'),
  );
  for (const control of [shared.button, shared.input]) {
    expect(control).not.toBeNull();
    expect(primaryFamily(control!.family)).toContain('inter');
  }
  expect(shared.input?.size).toBe('16px');

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
