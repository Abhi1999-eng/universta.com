import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * Links to the level pages from the subjects and specializations that own
 * them: the /subjects cards, the /specializations cards, and the "Choose a
 * level" chips under a subject's or a specialization's heading. Each one is
 * a level the field is offered at, by its plain address (never the noindex
 * `?view=guides` copy), and each one opens.
 *
 * Read from the API rather than fixed, so it holds on any catalogue: the
 * offered set is a field's `levels` (the API's union of its ticks, its
 * published specializations' levels and its published courses' levels),
 * among the catalogue's active levels. A field offered at nothing links
 * none.
 */

const LEVEL_SLUGS: Record<string, string> = {
  FOUNDATION: 'foundation', PATHWAY: 'pathway', UG: 'bachelors', PG: 'masters', MBA: 'mba', PHD: 'phd',
};
const levelSlug = (code: string) => LEVEL_SLUGS[code.toUpperCase()] ?? code.toLowerCase();

type Level = { code: string | null };
type Field = { id: string; name: string; slug: string; levels?: Level[] };
type Branch = Field & { subject: { slug: string; name: string } };

async function read<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${apiBaseUrl}/api/v1${path}`);
  expect(response.ok(), path).toBe(true);
  return (await response.json()).data as T;
}

/** The catalogue's active level codes, in the order a student climbs them. */
async function catalogue(request: APIRequestContext) {
  return (await read<Array<{ code: string }>>(request, '/course-levels')).map((level) => level.code);
}

/** The level addresses a field's links should be, in climbing order. */
function expected(base: string, levels: Level[] | undefined, active: string[]) {
  const codes = new Set((levels ?? []).flatMap((level) => (level.code ? [level.code.toUpperCase()] : [])));
  return active.filter((code) => codes.has(code)).map((code) => `${base}/${levelSlug(code)}`);
}

async function expectEachOpens(request: APIRequestContext, links: string[]) {
  for (const href of links) {
    expect(href, href).not.toContain('?');
    const response = await request.get(`${webBaseUrl}${href}`, { maxRedirects: 0 });
    expect(response.status(), href).toBe(200);
  }
}

test.describe('links to the level pages', () => {
  test('each /subjects card links the subject’s level pages, and each opens', async ({ page, request }) => {
    const [subjects, active] = await Promise.all([
      read<Field[]>(request, '/subjects?limit=100'),
      catalogue(request),
    ]);
    await page.goto(`${webBaseUrl}/subjects`);
    let linked = 0;
    for (const subject of subjects) {
      const card = page.locator('article.subjcard', {
        has: page.locator(`h2.subjcard__name a[href="/subjects/${subject.slug}"]`),
      });
      /* Every published subject has its card: one missing would skip it. */
      await expect(card, subject.slug).toHaveCount(1);
      const shown = await card.locator('a.levellinks__a').evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute('href') ?? ''),
      );
      const want = expected(`/subjects/${subject.slug}`, subject.levels, active);
      expect(shown, subject.slug).toEqual(want);
      await expectEachOpens(request, shown);
      linked += shown.length;
    }
    expect(linked).toBeGreaterThan(0);
  });

  test('each /specializations card links the specialization’s level pages, and each opens', async ({ page, request }) => {
    const [branches, active] = await Promise.all([
      read<Branch[]>(request, '/specializations?limit=200'),
      catalogue(request),
    ]);
    await page.goto(`${webBaseUrl}/specializations`);
    let linked = 0;
    for (const branch of branches) {
      const base = `/subjects/${branch.subject.slug}/${branch.slug}`;
      /* Its card in either form: one link from end to end where it has no
         level to link, its name's link stretched over it where it has. A
         card that should link levels and lost them is still found, and
         fails below rather than being skipped. */
      const card = page.locator(
        `.h-grid > a.h-card[href="${base}"], .h-grid > article.h-card:has(> a.card-stretch__link[href="${base}"])`,
      );
      await expect(card, base).toHaveCount(1);
      const shown = await card.locator('a.levellinks__a').evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute('href') ?? ''),
      );
      expect(shown, base).toEqual(expected(base, branch.levels, active));
      await expectEachOpens(request, shown);
      linked += shown.length;
    }
    expect(linked).toBeGreaterThan(0);
    /* The card still opens the specialization as a whole. */
    const first = branches.find((branch) => branch.levels?.length);
    if (first) {
      const base = `/subjects/${first.subject.slug}/${first.slug}`;
      await page.locator(`.h-grid a.card-stretch__link[href="${base}"]`).click();
      await expect(page).toHaveURL(`${webBaseUrl}${base}`);
    }
  });

  test('a subject’s and a specialization’s heading link their own level pages', async ({ page, request }) => {
    const [subjects, branches, active] = await Promise.all([
      read<Field[]>(request, '/subjects?limit=100'),
      read<Branch[]>(request, '/specializations?limit=200'),
      catalogue(request),
    ]);
    const subject = subjects.find((row) => expected('', row.levels, active).length);
    const branch = branches.find((row) => expected('', row.levels, active).length);
    test.skip(!subject || !branch, 'the catalogue offers no subject or specialization at any level');

    for (const [base, name, levels] of [
      [`/subjects/${subject!.slug}`, subject!.name, subject!.levels],
      [`/subjects/${branch!.subject.slug}/${branch!.slug}`, branch!.name, branch!.levels],
    ] as const) {
      await page.goto(`${webBaseUrl}${base}`);
      /* Its own name, apart from the courses-by-level bar's "Study levels". */
      const nav = page.getByRole('navigation', { name: `${name} by level`, exact: true });
      await expect(nav).toBeVisible();
      const shown = await nav.locator('a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
      expect(shown, base).toEqual(expected(base, levels as Level[] | undefined, active));
      await expectEachOpens(request, shown);
      /* The courses-by-level bar further down keeps its own name, and its
         count-bearing links stay on the course guides the counts are of. */
      const bar = page.getByRole('navigation', { name: 'Study levels' });
      if (await bar.count()) {
        for (const href of await bar.locator('a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? '')))
          expect(href).toMatch(/\?view=guides$|^\/courses\?/);
      }

      /* A specialization card with level links still opens as a whole,
         from the arrow of its "Explore specialization →" too, which moves
         on hover. */
      const stretched = page.locator('.speccard.card-stretch').first();
      if (await stretched.count()) {
        const target = await stretched.locator('a.card-stretch__link').getAttribute('href');
        await stretched.hover();
        const arrow = await stretched.locator('.speccard__cta span').boundingBox();
        expect(arrow).not.toBeNull();
        await page.mouse.click(arrow!.x + arrow!.width / 2, arrow!.y + arrow!.height / 2);
        await expect(page).toHaveURL(`${webBaseUrl}${target}`);
        await page.goto(`${webBaseUrl}${base}`);
      }

      await nav.locator('a').first().click();
      await expect(page).toHaveURL(`${webBaseUrl}${shown[0]}`);
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();
    }
  });
});
