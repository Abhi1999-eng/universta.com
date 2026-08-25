import { expect, test } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * Heading order across the public page families.
 *
 * Populated pages put a summary panel ("… at a glance", "Key takeaways") or a
 * filter rail directly after the page title. Each of those was marked up a
 * level or two below <h1>, so a screen reader walking the outline of a country,
 * course, scholarship or consultant page fell from h1 straight to h3 or h4 with
 * nothing in between. The levels are asserted here rather than the sizes: the
 * stylesheets key on the tag, so a regression would show up as a jump again.
 */

/** Slugs come from the running catalogue so this works against any dataset. */
async function firstSlug(request: import('@playwright/test').APIRequestContext, path: string) {
  const res = await request.get(`${apiBaseUrl}${path}`);
  if (!res.ok()) return '';
  const rows = (await res.json()).data;
  const list = Array.isArray(rows) ? rows : (rows?.data ?? []);
  return String(list?.[0]?.slug ?? '');
}

test('public pages never skip a heading level', async ({ page, request }) => {
  test.setTimeout(5 * 60 * 1000);
  const [country, consultant, scholarship] = await Promise.all([
    firstSlug(request, '/api/v1/countries?limit=1'),
    firstSlug(request, '/api/v1/phase1/consultants?limit=1'),
    firstSlug(request, '/api/v1/phase1/scholarships?limit=1'),
  ]);

  const routes = [
    '/courses',
    '/scholarships',
    '/universities',
    ...(country ? [`/countries/${country}`, `/study-in/${country}`] : []),
    ...(consultant ? [`/study-abroad-consultants/${consultant}`] : []),
    ...(scholarship ? [`/scholarships/${scholarship}`] : []),
  ];

  for (const route of routes) {
    await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'networkidle' });
    const outline = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
        level: Number(h.tagName[1]),
        text: (h.textContent || '').trim().slice(0, 40),
      }));
    });
    expect(outline.length, `${route} renders headings`).toBeGreaterThan(1);
    for (let i = 1; i < outline.length; i += 1) {
      expect(
        outline[i].level - outline[i - 1].level,
        `${route}: h${outline[i - 1].level} "${outline[i - 1].text}" -> h${outline[i].level} "${outline[i].text}" skips a level`,
      ).toBeLessThanOrEqual(1);
    }
  }
});
