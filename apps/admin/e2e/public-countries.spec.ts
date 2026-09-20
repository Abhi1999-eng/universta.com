import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/* The filterable destination listing is the homepage; /countries redirects
 * there when it carries filters and to the Study Abroad directory when it
 * does not. A country's own page is its Study Abroad guide. */
const listing = `${webBaseUrl}/`;
const guide = `${webBaseUrl}/study-abroad/canada`;

test.describe('approved public country experience', () => {
  /* The eleven tests that stood here described the Phase 1 countries listing:
   * its "Where will your degree take you" hero, the search combobox and
   * suggestions, the budget and IELTS structured filters, the A-Z directory,
   * the mobile filter drawer and the URL-backed pagination.
   *
   * That listing is retired. The approved destination listing is the homepage
   * now, and it filters by region, guide status and what a destination has --
   * none of the controls those tests drove still exist at any address, so they
   * are not moved, they are gone with the page they described. What the
   * homepage does offer is covered by study-abroad.spec.ts.
   *
   * The guide tests below are untouched: a country's own page did not move. */

  test('renders the country guide sections with in-page links that resolve', async ({ page }) => {
    await page.goto(guide);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Canada');
    await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible();
    /* Intakes are the Country's own month selection. */
    await expect(page.getByRole('heading', { name: /^Intakes in / })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Language requirements' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'After you arrive, and after you graduate' }),
    ).toBeVisible();

    const links = await page.locator('a[href^="#"]').evaluateAll((elements) => (
      elements.map((element) => element.getAttribute('href')).filter((href) => href && href !== '#')
    ));
    for (const href of links) await expect(page.locator(href as string)).toHaveCount(1);
  });

  test('links every city guide at an address the site actually serves', async ({ page }) => {
    await page.goto(`${webBaseUrl}/study-in-canada/cities`);

    const cityLinks = await page.locator('a[href^="/study-in-canada/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
    );
    const guides = [...new Set(cityLinks.filter((href) => href !== '/study-in-canada/cities'))];
    expect(guides.length).toBeGreaterThan(0);
    for (const href of guides) {
      // A city guide lives under its destination; /cities/<slug> is not a route.
      expect(href).toMatch(/^\/study-in-canada\/[a-z0-9-]+$/);
      const response = await page.request.get(`${webBaseUrl}${href}`);
      expect(response.status(), `${href} should not 404`).toBe(200);
    }
  });

  test('keeps unpublished consultants off a public location page', async ({ page }) => {
    await page.goto(`${webBaseUrl}/study-abroad-consultants/locations/demo-harbour`);

    const links = await page.locator('a[href^="/study-abroad-consultants/"]').evaluateAll((all) =>
      all.map((link) => link.getAttribute('href')).filter(Boolean),
    );
    const profiles = [...new Set(links.filter((href) => /^\/study-abroad-consultants\/[^/]+$/.test(href)))];
    for (const href of profiles) {
      const response = await page.request.get(`${webBaseUrl}${href}`);
      expect(response.status(), `${href} is linked publicly so it must resolve`).toBe(200);
    }
  });

  test('publishes breadcrumb, FAQ and organisation JSON-LD on a country guide', async ({ page }) => {
    await page.goto(guide);

    // BreadcrumbList (this page) + site-wide Organization (root layout) always
    // render; FAQPage renders whenever the country has at least one real FAQ.
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(3);
    const types = await scripts.evaluateAll((nodes) =>
      nodes.map((node) => (JSON.parse(node.textContent ?? '{}') as { '@type'?: string })['@type']),
    );
    expect(types.sort()).toEqual(['BreadcrumbList', 'FAQPage', 'Organization']);
  });

  test('keeps country listing and detail layouts free of horizontal mobile overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(listing);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto(guide);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
