import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/** Guards the client-visible promise that every required Phase 1 public page
 * is reachable from visible navigation, not only by typing a URL. The header
 * and footer are rendered from Admin-managed navigation menus, so these also
 * catch a navigation menu being emptied or mislinked. */

// Listing and static pages must be linked directly from the header or footer.
const NAV_REACHABLE: Array<[string, string]> = [
  ['Home', '/'],
  ['Countries listing', '/countries'],
  ['Cities listing', '/cities'],
  ['Universities listing', '/universities'],
  ['Subject listing', '/subjects'],
  ['Generic courses', '/courses'],
  ['Scholarship listing', '/scholarships'],
  ['Consultants listing', '/study-abroad-consultants'],
  ['Country comparison', '/compare/countries'],
  ['University comparison', '/compare/universities'],
  ['Course comparison', '/compare/courses'],
  ['Consultant comparison', '/compare/consultants'],
  ['About us', '/about'],
  ['Contact us', '/contact'],
  ['Book free counselling', '/counselling'],
  ['Success stories', '/success-stories'],
  ['Testimonials', '/testimonials'],
  ['FAQ', '/faq'],
  ['Careers', '/careers'],
  ['Events listing', '/events'],
];

test.describe('public navigation discoverability', () => {
  test('links every required Phase 1 listing and static page from the site chrome', async ({
    page,
  }) => {
    await page.goto(webBaseUrl);
    const chromeHrefs = await page.evaluate(() => {
      const anchors = [
        ...document.querySelectorAll('header a[href], footer a[href]'),
      ];
      return anchors.map((a) => a.getAttribute('href') ?? '');
    });
    const missing = NAV_REACHABLE.filter(
      ([, href]) => !chromeHrefs.includes(href),
    ).map(([label]) => label);
    expect(missing, 'pages missing from header/footer navigation').toEqual([]);
  });

  test('renders exactly one header and one footer on every page family', async ({
    page,
  }) => {
    // A second header would mean a page template reintroduced its own chrome,
    // which is how Settings changes previously failed to reach some pages.
    for (const path of ['/', '/countries', '/universities', '/faq', '/counselling']) {
      await page.goto(`${webBaseUrl}${path}`);
      await expect(page.locator('header')).toHaveCount(1);
      await expect(page.locator('footer')).toHaveCount(1);
    }
  });

  test('has no placeholder or dead navigation links', async ({ page }) => {
    await page.goto(webBaseUrl);
    const dead = await page.evaluate(() =>
      [...document.querySelectorAll('header a[href], footer a[href]')]
        .map((a) => a.getAttribute('href') ?? '')
        .filter((href) => href === '' || href === '#'),
    );
    expect(dead).toEqual([]);
  });

  test('marks the current section active in the header', async ({ page }) => {
    await page.goto(`${webBaseUrl}/scholarships`);
    await expect(
      page.locator('header .usta-nav-link.is-active'),
    ).toHaveText('Scholarships');
  });

  test('opens dropdowns and reaches a nested destination', async ({ page }) => {
    await page.goto(webBaseUrl);
    await page.getByRole('button', { name: 'Study Destinations' }).click();
    await page.getByRole('link', { name: 'Cities', exact: true }).click();
    await expect(page).toHaveURL(`${webBaseUrl}/cities`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('exposes every top-level group in the mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(webBaseUrl);
    await expect(page.locator('header nav.usta-nav')).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.locator('.usta-drawer');
    await expect(drawer).toBeVisible();
    // Same eight groups as the desktop header.
    await expect(drawer.locator('.usta-drawer-group')).toHaveCount(8);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, 'mobile drawer must not overflow horizontally').toBe(false);
  });
});

test.describe('public catalogue is free of test fixture data', () => {
  /** A demo once showed "Browser Region E2E 1785472873911" as a study
   * destination, because the catalog spec's Continent fixture was never
   * cleaned up and continents render as tabs on the Countries page. This is
   * the guard: whatever a suite creates, none of it may be visible to a
   * visitor. */
  test('shows no E2E fixture records on the destinations page', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries`);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Browser Region/i);
    expect(body).not.toMatch(/Browser Country/i);
    expect(body).not.toMatch(/\bE2E\b/);
    expect(body).not.toMatch(/Acceptance Demo/i);
  });

  test('shows no E2E fixture records on the main listing pages', async ({ page }) => {
    for (const path of ['/universities', '/scholarships', '/study-abroad-consultants', '/cities']) {
      await page.goto(`${webBaseUrl}${path}`);
      const body = await page.locator('body').innerText();
      expect(body, `${path} must not expose fixture data`).not.toMatch(/Acceptance Demo|Browser Region|Browser Country|\bE2E\b/i);
    }
  });
});
