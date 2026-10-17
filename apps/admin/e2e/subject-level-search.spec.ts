import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

const subject = '/subjects/computer-science';
const specialization = `${subject}/software-engineering`;
const fixedQueryKeys = ['subject', 'specialization', 'subSubject', 'level', 'courseLevel'];

/* The levels a subject's or a specialization's page offers, read from the
   API by the rule the website, the admin's Level pages card and the sitemap
   all follow: a subject's ticks together with its specializations' levels
   and the levels of its own published courses; a specialization's ticks
   together with the levels of its courses. Empty means the six named ones,
   which render but are not claimed. A level outside the set is a 404. */
const LEVEL_SLUGS: Record<string, string> = {
  FOUNDATION: 'foundation', PATHWAY: 'pathway', UG: 'bachelors', PG: 'masters', MBA: 'mba', PHD: 'phd',
};
const levelSlug = (code: string) => LEVEL_SLUGS[code] ?? code.toLowerCase();
type Level = { code: string | null };
async function offeredLevelSlugs(request: APIRequestContext, base: string) {
  const [, , subjectSlug, specializationSlug] = base.split('/');
  const path = specializationSlug
    ? `/api/v1/subjects/${subjectSlug}/specializations/${specializationSlug}`
    : `/api/v1/subjects/${subjectSlug}`;
  const response = await request.get(`${apiBaseUrl}${path}`);
  expect(response.ok()).toBe(true);
  const data = (await response.json()).data as {
    offeredLevels?: Level[];
    levels?: Level[];
    subSubjects?: Array<{ levels?: Level[] }>;
    courseCountsByLevel?: Array<{ level: Level; count: number }>;
  };
  const offered = specializationSlug
    ? [...(data.offeredLevels ?? []), ...(data.levels ?? [])]
    : [
        ...(data.offeredLevels ?? []),
        ...(data.subSubjects ?? []).flatMap((branch) => branch.levels ?? []),
        ...(data.courseCountsByLevel ?? []).filter((row) => row.count > 0).map((row) => row.level),
      ];
  const codes = offered.length ? offered.map((level) => level.code ?? '') : Object.keys(LEVEL_SLUGS);
  return [...new Set(codes.filter(Boolean).map(levelSlug))];
}

/* Every level the catalogue lists, as its readable slug. */
async function catalogueLevelSlugs(request: APIRequestContext) {
  const response = await request.get(`${apiBaseUrl}/api/v1/course-levels`);
  expect(response.ok()).toBe(true);
  return ((await response.json()).data as Array<{ code: string }>).map((level) => levelSlug(level.code));
}

/* An alias address and the level it stands for, among the levels the page
   is offered at: an alias for a level it is not offered at is a 404. */
const ALIASES: Array<[string, string]> = [['ug', 'bachelors'], ['pg', 'masters']];

async function expectHighlightedInsidePanel(page: Page) {
  const search = page.getByRole('combobox', { name: 'Search Universta' });
  const panel = page.getByRole('listbox', { name: 'Suggestions' });
  const selected = panel.getByRole('option', { selected: true });
  await expect(selected).toHaveCount(1);
  await expect(search).toHaveAttribute('aria-activedescendant', (await selected.getAttribute('id'))!);
  await expect.poll(() => panel.evaluate((node) => {
    const frame = node as HTMLElement;
    const row = frame.querySelector('[aria-selected="true"]')?.getBoundingClientRect();
    const top = frame.getBoundingClientRect().top + frame.clientTop;
    return Boolean(row && row.top >= top - 1 && row.bottom <= top + frame.clientHeight + 1);
  })).toBe(true);
}

test.describe('subject level discovery', () => {
  test('opens every level from subject and specialization pages, including empty levels', async ({ page, request }) => {
    for (const [base, name] of [
      [subject, 'Computer Science'],
      [specialization, 'Software Engineering'],
    ]) {
      await page.goto(`${webBaseUrl}${base}`);
      const levelNav = page.getByRole('navigation', { name: 'Study levels' });
      const links = levelNav.locator('a');
      await expect(links.first()).toBeVisible();
      const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(1);
      for (const href of hrefs) expect(href).toMatch(new RegExp(`^${base}/[a-z0-9-]+\\?view=guides$`));
      /* The bar offers exactly the levels the record is offered at, ticked
         or with courses beneath it, and no other. */
      const offered = await offeredLevelSlugs(request, base);
      expect(hrefs.map((href) => href.slice(base.length + 1).replace('?view=guides', '')).sort()).toEqual([...offered].sort());
      /* An empty level still opens. */
      const empty = levelNav.locator('a.chipbtn--none');
      const target = (await empty.count()) ? empty.first() : links.first();
      const picked = new URL((await target.getAttribute('href'))!, webBaseUrl).pathname.split('/').pop()!;
      await target.click();
      await expect(page).toHaveURL(`${webBaseUrl}${base}/${picked}?view=guides`);
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();
      await expect(page.getByTestId('switch-guides')).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('navigation', { name: 'Study levels' })
        .locator('a[aria-current="page"]')).toHaveAttribute('href', `${base}/${picked}?view=guides`);

      // The page remains usable when the selected level has no programmes.
      await page.getByTestId('switch-programmes').click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(`${base}/${picked}`);
      await expect(page.getByTestId('switch-programmes')).toHaveAttribute('aria-current', 'page');
      expect(new URL(page.url()).searchParams.has('view')).toBe(false);
    }
  });

  test('canonicalizes UG and PG aliases without losing nonfixed filters', async ({ page, request }) => {
    const cases: Array<[string, string, string]> = [];
    for (const base of [subject, specialization]) {
      const offered = await offeredLevelSlugs(request, base);
      const pair = ALIASES.find(([, canonical]) => offered.includes(canonical));
      if (pair) cases.push([base, ...pair]);
    }
    test.skip(!cases.length, 'Neither page is offered at Bachelor\'s or Master\'s in this catalogue');
    for (const [base, alias, canonical] of cases) {
      const query = new URLSearchParams({
        country: 'canada', q: 'computer', view: 'guides',
        subject: 'business', level: 'PHD', courseLevel: 'MBA',
        ...(base === specialization ? { specialization: 'cybersecurity', subSubject: 'data-science' } : {}),
      });
      await page.goto(`${webBaseUrl}${base}/${alias}?${query}`);
      await expect.poll(() => new URL(page.url()).pathname).toBe(`${base}/${canonical}`);
      const params = new URL(page.url()).searchParams;
      expect(params.get('country')).toBe('canada');
      expect(params.get('q')).toBe('computer');
      expect(params.get('view')).toBe('guides');
      for (const key of fixedQueryKeys) expect(params.has(key), key).toBe(false);
      await expect(page.getByRole('navigation', { name: 'Study levels' })
        .locator('a[aria-current="page"]')).toHaveAttribute('href', new RegExp(`/${canonical}\\?`));
    }
  });

  test('sends the old /levels/ addresses to the level page that replaced them, filters and all', async ({ page, request }) => {
    for (const base of [subject, specialization]) {
      const [level] = await offeredLevelSlugs(request, base);
      await page.goto(`${webBaseUrl}${base}/levels/${level}?view=guides&country=canada`);
      await expect.poll(() => new URL(page.url()).pathname).toBe(`${base}/${level}`);
      const params = new URL(page.url()).searchParams;
      expect(params.get('view')).toBe('guides');
      expect(params.get('country')).toBe('canada');
    }
  });

  test('returns 404 for a catalogue level the page is not offered at, and for its alias', async ({ page, request }) => {
    const catalogue = await catalogueLevelSlugs(request);
    let checked = 0;
    for (const base of [subject, specialization]) {
      const offered = await offeredLevelSlugs(request, base);
      const missing = catalogue.find((level) => !offered.includes(level));
      if (!missing) continue;
      checked += 1;
      const response = await page.goto(`${webBaseUrl}${base}/${missing}`);
      expect(response?.status(), `${base}/${missing}`).toBe(404);
      await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();
      /* An alias for a level it is not offered at is not found either,
         rather than redirected to a page that is not. */
      const alias = ALIASES.find(([, canonical]) => !offered.includes(canonical));
      if (alias) {
        const aliased = await page.goto(`${webBaseUrl}${base}/${alias[0]}`);
        expect(aliased?.status(), `${base}/${alias[0]}`).toBe(404);
      }
    }
    test.skip(!checked, 'Both pages are offered at every catalogue level');
  });

  test('returns 404 for an unknown subject, specialization, or level', async ({ page }) => {
    for (const path of [
      '/subjects/not-a-published-subject/bachelors',
      `${subject}/not-a-published-specialization/bachelors`,
      `${specialization}/not-a-study-level`,
    ]) {
      const response = await page.goto(`${webBaseUrl}${path}`);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();
    }
  });

  for (const view of ['programmes', 'guides'] as const) {
    test(`clears ${view} filters within the specialization and level path`, async ({ page, request }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      /* A level the specialization is offered at: any other is a 404. */
      const offered = await offeredLevelSlugs(request, specialization);
      const level = offered.includes('masters') ? 'masters' : offered[0];
      const base = `${specialization}/${level}`;
      const query = new URLSearchParams({
        country: 'canada', q: 'no-matching-programme-xyz',
        subject: 'business', specialization: 'cybersecurity', level: 'PHD',
        ...(view === 'guides' ? { view } : {}),
      });
      await page.goto(`${webBaseUrl}${base}?${query}`);
      await expect(page.getByRole('heading', { level: 1, name: /Software Engineering/ })).toBeVisible();
      await expect(page.getByTestId(`switch-${view}`)).toHaveAttribute('aria-current', 'page');
      const panel = page.locator(view === 'guides' ? '#course-filter-panel' : '#subject-level-filters');
      await expect(panel).toBeVisible();
      for (const key of ['subject', 'specialization', 'subSubject', 'level']) {
        await expect(panel.locator(`input[type="checkbox"][name="${key}"]`)).toHaveCount(0);
      }
      const clear = panel.getByRole('link', { name: 'Clear all', exact: true });
      const clearUrl = new URL((await clear.getAttribute('href'))!, webBaseUrl);
      expect(clearUrl.pathname).toBe(base);
      for (const key of fixedQueryKeys) expect(clearUrl.searchParams.has(key), key).toBe(false);
      await clear.click();
      await expect.poll(() => new URL(page.url()).searchParams.has('country')).toBe(false);
      expect(new URL(page.url()).pathname).toBe(base);
      expect(new URL(page.url()).searchParams.get('view')).toBe(view === 'guides' ? 'guides' : null);
      // Programme clear keeps the search; guide clear resets it, as on /courses.
      expect(new URL(page.url()).searchParams.get('q'))
        .toBe(view === 'guides' ? null : 'no-matching-programme-xyz');
      await expect(page.getByRole('heading', { level: 1, name: /Software Engineering/ })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Study levels' })
        .locator('a[aria-current="page"]')).toHaveAttribute('href', new RegExp(`/${level}(?:\\?|$)`));
    });
  }
});

test.describe('homepage suggestion overflow', () => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`keeps suggestions visible, scrollable, and keyboard reachable at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.route('**/api/search?*', (route) => route.fulfill({
        json: { data: { groups: [{
          type: 'course', label: 'Courses', href: '/courses?q=computer',
          items: Array.from({ length: 40 }, (_, index) => ({
            id: `suggestion-${index}`, label: `Computer science suggestion ${index + 1}`,
            href: subject, meta: 'Published course guide',
          })),
        }] } },
      }));
      await page.goto(webBaseUrl);
      const search = page.getByRole('combobox', { name: 'Search Universta' });
      await search.fill('computer');
      const panel = page.getByRole('listbox', { name: 'Suggestions' });
      await expect(panel.getByRole('option')).toHaveCount(40);
      await expect(search).toHaveAttribute('aria-expanded', 'true');

      // Put the hero boundary on screen so clipping is tested at that boundary.
      await page.locator('.h-home').evaluate((hero) => {
        window.scrollBy(0, hero.getBoundingClientRect().bottom - (window.innerHeight - 180));
      });
      await expect.poll(() => panel.evaluate((node) => {
        const frame = node as HTMLElement;
        const box = frame.getBoundingClientRect();
        const hero = frame.closest('.h-home')!.getBoundingClientRect();
        const y = Math.max(hero.bottom + 8, box.top + 12);
        const hit = document.elementFromPoint(box.left + box.width / 2, y);
        return box.bottom > y && y < window.innerHeight && hit?.closest('.sugg') === frame;
      })).toBe(true);
      await expect.poll(() => panel.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return window.innerHeight - box.top >= 120 && box.bottom <= window.innerHeight + 1;
      })).toBe(true);
      expect(await panel.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);

      await search.press('ArrowUp');
      await expect(panel.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
      await expectHighlightedInsidePanel(page);
      await search.press('ArrowDown');
      await expect(panel.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
      await expectHighlightedInsidePanel(page);

      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + 20, box!.y + 12);
      await page.mouse.wheel(0, 400);
      await expect.poll(() => panel.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await search.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(search).toHaveAttribute('aria-expanded', 'false');
    });
  }
});
