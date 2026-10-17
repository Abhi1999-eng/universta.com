import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

const subject = '/subjects/computer-science';
const specialization = `${subject}/software-engineering`;
const fixedQueryKeys = ['subject', 'specialization', 'subSubject', 'level', 'courseLevel'];

/* The levels a subject's or a specialization's page offers, read from the
   API the way the page reads them: a subject's ticks together with its
   specializations' levels; a specialization's ticks, else the levels of
   its courses. Empty means the six named ones. */
const LEVEL_SLUGS: Record<string, string> = {
  FOUNDATION: 'foundation', PATHWAY: 'pathway', UG: 'bachelors', PG: 'masters', MBA: 'mba', PHD: 'phd',
};
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
  };
  /* A specialization: its ticks, else its course levels. A subject: its
     ticks together with its specializations' levels -- the subject's ticks
     only add. */
  const offered = specializationSlug
    ? data.offeredLevels?.length
      ? data.offeredLevels
      : (data.levels ?? [])
    : [
        ...(data.offeredLevels ?? []),
        ...(data.subSubjects ?? []).flatMap((branch) => branch.levels ?? []),
      ];
  const codes = offered.length ? offered.map((level) => level.code ?? '') : Object.keys(LEVEL_SLUGS);
  return [...new Set(codes.filter(Boolean).map((code) => LEVEL_SLUGS[code] ?? code.toLowerCase()))];
}

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
      /* The bar offers the levels the record is offered at, whatever has
         courses yet: ticked, or failing that, read from what is beneath it. */
      for (const level of await offeredLevelSlugs(request, base)) {
        await expect(levelNav.locator(`a[href="${base}/${level}?view=guides"]`)).toHaveCount(1);
      }
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

  test('canonicalizes UG and PG aliases without losing nonfixed filters', async ({ page }) => {
    for (const [base, alias, canonical] of [
      [subject, 'ug', 'bachelors'],
      [specialization, 'pg', 'masters'],
    ]) {
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

  test('sends the old /levels/ addresses to the level page that replaced them, filters and all', async ({ page }) => {
    for (const base of [subject, specialization]) {
      await page.goto(`${webBaseUrl}${base}/levels/masters?view=guides&country=canada`);
      await expect.poll(() => new URL(page.url()).pathname).toBe(`${base}/masters`);
      const params = new URL(page.url()).searchParams;
      expect(params.get('view')).toBe('guides');
      expect(params.get('country')).toBe('canada');
    }
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
    test(`clears ${view} filters within the specialization and level path`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const base = `${specialization}/masters`;
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
        .locator('a[aria-current="page"]')).toHaveAttribute('href', new RegExp('/masters(?:\\?|$)'));
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
