import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * A level page's written sections, from the admin's level page editor to the
 * website: each part an editor writes is a band of its own on the subject's
 * page at that level, in the order the page runs them, and a part left blank
 * has no band at all.
 *
 * The subject is ticked at MBA and Master's and its MBA page is written, so
 * the opening band reads "Why study an MBA in …?" and "More on …" has the
 * Master's page to link. It has no programmes, so "Where to study" stands
 * down; its admission note is left blank, so "Getting into" does too.
 * "Plan your MBA" is drawn from the site's own pages, so it is always there;
 * a second subject published at MBA puts "More subjects at MBA" there too.
 * The consultants band follows the directory: there when it lists anyone,
 * gone when it lists no one.
 *
 * A specialization's page at a level runs its own order, with "What you may
 * study" straight after the overview, its siblings at the level with a way
 * to all of its subject's specializations, and the same "Plan your …".
 *
 * Every subject is named with this run's country prefix, so the acceptance
 * cleanup removes it -- its specializations and level pages with it.
 */

const UUID = '[0-9a-f-]{36}';

/* The bands a subject's level page runs, in order, as their anchors. */
const SUBJECT_ORDER = [
  'overview', 'study-topics', 'specializations', 'careers', 'industries', 'employers', 'admission',
  'looking-ahead', 'where-to-study', 'discovery', 'consultants', 'faqs', 'plan-your-level', 'more-subjects', 'more', 'plan',
];
/* And a specialization's. */
const SPECIALIZATION_ORDER = [
  'overview', 'study-topics', 'where-to-study', 'discovery', 'admission', 'careers', 'industries', 'employers',
  'looking-ahead', 'specializations', 'parent-subject', 'faqs', 'plan-your-level', 'more', 'plan',
];

function box(scope: Page | Locator, name: string) {
  return scope.getByRole('textbox', { name, exact: true });
}

async function createSubject(page: Page, name: string, levels: string[]) {
  await page.goto('/subjects/new');
  await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();
  await box(page, 'Name').fill(name);
  await box(page, 'Short description').fill('Written by the level page sections acceptance test.');
  for (const level of levels) await page.getByRole('checkbox', { name: level, exact: true }).check();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(new RegExp(`/subjects/${UUID}$`));
  await expect(page.getByRole('heading', { name: 'Edit subject' })).toBeVisible();
  /* The subject's own editor replaces the Create one, which stays locked
     until it has; a link followed before then can lose out to it. */
  await expect(box(page, 'Name')).toBeEnabled();
  return page.url().split('/subjects/')[1];
}

/** Publishes the subject open in its editor; it ends on the list. */
async function publishSubject(page: Page) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.waitForURL(/\/subjects$/);
}

/** A specialization of the subject, ticked at the levels and saved as a
 *  draft; it ends in its own editor. */
async function createSpecialization(page: Page, subjectId: string, name: string, levels: string[]) {
  await page.goto(`/specializations/new?subject=${subjectId}`);
  await expect(page.getByRole('heading', { name: 'Create specialization' })).toBeVisible();
  await box(page, 'Name').fill(name);
  for (const level of levels) await page.getByRole('checkbox', { name: level, exact: true }).check();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(new RegExp(`/specializations/${UUID}$`));
  /* As a subject's: its own editor takes over before a link is followed. */
  await expect(box(page, 'Name')).toBeEnabled();
  return { id: page.url().split('/specializations/')[1], slug: await box(page, 'Slug').inputValue() };
}

/** What a public list endpoint holds. */
async function read<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${apiBaseUrl}/api/v1${path}`);
  expect(response.ok(), path).toBe(true);
  return (await response.json()).data as T;
}

/** Every link opens on the website as it stands: 200, not a redirect. */
async function expectEachOpens(request: APIRequestContext, hrefs: string[]) {
  for (const href of hrefs) {
    const response = await request.get(`${webBaseUrl}${href.split('#')[0]}`, { maxRedirects: 0 });
    expect(response.status(), href).toBe(200);
  }
}

const hrefs = (scope: Locator) => scope.locator('a').evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
const sectionIds = (page: Page) => page.locator('section[id]').evaluateAll((sections) => sections.map((section) => section.id));

/** "Plan your …" for a level page: the site's own finders, narrowed to the
 *  level where they read one, the guides, and counselling from this page. */
function planHrefs(code: string, counselling: string) {
  return [
    `/courses?level=${code}`,
    `/scholarships?degreeLevel=${code}#scholarships`,
    '/universities',
    '/study-abroad',
    counselling,
  ];
}

test.describe('a level page’s written sections', () => {
  test('each written part is its own band on the website, in the page’s order', async ({ page, request }) => {
    test.setTimeout(240_000);
    const name = `${acceptanceCountryName()} Level Sections Subject`;
    const neighbour = `${acceptanceCountryName()} Level Sections Neighbour`;
    await loginAsAdmin(page);
    await page.waitForLoadState('networkidle');

    /* Another subject with a page at MBA, for "More subjects at MBA". */
    await createSubject(page, neighbour, ['MBA']);
    const neighbourSlug = await box(page, 'Slug').inputValue();
    await publishSubject(page);

    const subjectId = await createSubject(page, name, ["Master's", 'MBA']);
    const slug = await box(page, 'Slug').inputValue();

    const card = page.locator('#subject-level-pages');
    await card.getByRole('link', { name: 'Write the MBA page' }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}/level-pages/${UUID}$`));
    await expect(page.getByRole('heading', { name: `MBA in ${name}` })).toBeVisible();

    /* Each new part says where it shows. */
    await expect(box(page, 'Intro')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Shows as “Career pathways”.', { exact: false })).toBeVisible();
    await expect(page.getByText(/Shows as “Employers”, always followed by/)).toBeVisible();
    await expect(page.getByText('Topics a programme at this level usually covers. Shows as “What you may study”.', { exact: true })).toBeVisible();

    const words = {
      intro: 'A business degree for managers in the sea trades.',
      studyTopics: 'Port economics, chartering and maritime law.',
      careers: 'Graduates lead port, logistics and fleet teams.',
      industries: 'Shipping, logistics and marine insurance.',
      employers: 'Port operators and shipping lines.',
      lookingAhead: 'Greener fleets keep demand for these managers rising.',
    };
    await box(page, 'Intro').fill(words.intro);
    await box(page, 'What you may study').fill(words.studyTopics);
    await box(page, 'Careers note').fill(words.careers);
    await box(page, 'Industries').fill(words.industries);
    await box(page, 'Employers').fill(words.employers);
    await box(page, 'Looking ahead').fill(words.lookingAhead);

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}(#subject-level-pages)?$`));
    await expect(page.getByText(`MBA in ${name} published successfully.`, { exact: true })).toBeVisible();

    /* With the subject published too, the website shows the page. */
    await publishSubject(page);
    await page.goto(`${webBaseUrl}/subjects/${slug}/mba`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`MBA in ${name}`);

    /* What the directory and the subjects list hold, as the page reads
       them: the consultants band is there only when someone is listed. */
    const [consultants, subjects, active] = await Promise.all([
      read<unknown[]>(request, '/phase1/consultants?limit=3'),
      read<Array<{ name: string; slug: string; levels?: Array<{ code: string | null }> }>>(request, '/subjects?limit=100'),
      read<Array<{ code: string }>>(request, '/course-levels'),
    ]);

    /* The bands run in the page's order; a part with nothing written, or
       nothing listed, has none. */
    const ids = await sectionIds(page);
    expect(ids.filter((id) => SUBJECT_ORDER.includes(id))).toEqual([
      'overview', 'study-topics', 'careers', 'industries', 'employers', 'looking-ahead', 'discovery',
      ...(consultants.length ? ['consultants'] : []),
      'plan-your-level', 'more-subjects', 'more', 'plan',
    ]);
    await expect(page.locator('#admission')).toHaveCount(0);
    await expect(page.locator('#where-to-study')).toHaveCount(0);

    /* Each band under its own heading, with what was written in it. */
    const bands: Array<[string, string, string]> = [
      ['overview', `Why study an MBA in ${name}?`, words.intro],
      ['study-topics', 'What you may study', words.studyTopics],
      ['careers', 'Career pathways', words.careers],
      ['industries', 'Industries', words.industries],
      ['employers', 'Employers', words.employers],
      ['looking-ahead', 'Looking ahead', words.lookingAhead],
    ];
    for (const [id, heading, text] of bands) {
      const band = page.locator(`section#${id}`);
      await expect(band.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
      await expect(band.getByText(text, { exact: true })).toBeVisible();
    }
    /* The employers are always said to be examples, straight after them. */
    const note = page.locator('section#employers .prose + p');
    await expect(note).toHaveText('Named for illustration only; not a ranking, endorsement or partnership.');
    await expect(page.getByRole('heading', { name: /^Getting into / })).toHaveCount(0);

    /* The directory's first few consultants, offered for a talk about the
       level in the subject -- never said to be the subject's -- and all of
       them a click away. None listed, no band. */
    const consult = page.locator('section#consultants');
    if (consultants.length) {
      await expect(consult.getByRole('heading', { level: 2, name: 'Study abroad consultants', exact: true })).toBeVisible();
      await expect(consult.getByText(`Talk to a consultant about an MBA in ${name}.`, { exact: true })).toBeVisible();
      await expect(consult.locator('article.consultcard')).toHaveCount(Math.min(3, consultants.length));
      await expect(consult.getByRole('link', { name: 'View all consultants' })).toHaveAttribute('href', '/study-abroad-consultants');
      const guidance = `/counselling?source=subject&subject=${slug}&from=${encodeURIComponent(`/subjects/${slug}/mba`)}`;
      for (const link of await consult.getByRole('link', { name: /^Get guidance/ }).all())
        await expect(link).toHaveAttribute('href', guidance);
      await expectEachOpens(request, ['/study-abroad-consultants', guidance]);
    } else {
      await expect(consult).toHaveCount(0);
    }

    /* "Plan your MBA" links only the site's pages that answer, narrowed
       to MBA where they read a level. */
    const plan = page.locator('section#plan-your-level');
    await expect(plan.getByRole('heading', { level: 2, name: 'Plan your MBA', exact: true })).toBeVisible();
    const planLinks = await hrefs(plan);
    expect(planLinks).toEqual(planHrefs('MBA', `/counselling?source=subject&subject=${slug}&from=${encodeURIComponent(`/subjects/${slug}/mba`)}`));
    await expectEachOpens(request, planLinks);

    /* "More subjects at MBA": the other subjects offered at MBA, as the
       /subjects cards link their levels -- the neighbour among them, never
       this one or the unindexed guides view -- then all subjects. */
    expect(active.map((level) => level.code.toUpperCase())).toContain('MBA');
    const atMba = subjects
      .filter((row) => row.slug !== slug && (row.levels ?? []).some((level) => level.code?.toUpperCase() === 'MBA'))
      .slice(0, 12)
      .map((row) => `/subjects/${row.slug}/mba`);
    expect(atMba).toContain(`/subjects/${neighbourSlug}/mba`);
    const others = page.locator('section#more-subjects');
    await expect(others.getByRole('heading', { level: 2, name: 'More subjects at MBA', exact: true })).toBeVisible();
    await expect(others.getByRole('link', { name: neighbour, exact: true })).toHaveAttribute('href', `/subjects/${neighbourSlug}/mba`);
    const otherLinks = await hrefs(others);
    expect(otherLinks).toEqual([...atMba, '/subjects']);
    expect(otherLinks).not.toContain(`/subjects/${slug}/mba`);
    expect(otherLinks.filter((href) => href.includes('view=guides'))).toEqual([]);
    await expectEachOpens(request, otherLinks);

    /* "More on …": the subject's other level page by its plain address,
       not this one, and the subject itself. */
    const more = page.locator('section#more');
    await expect(more.getByRole('heading', { level: 2, name: `More on ${name}`, exact: true })).toBeVisible();
    await expect(more.getByRole('link', { name: `Master's in ${name}`, exact: true })).toHaveAttribute('href', `/subjects/${slug}/masters`);
    await expect(more.locator(`a[href="/subjects/${slug}/mba"]`)).toHaveCount(0);
    await expect(more.locator('a[href*="view=guides"]')).toHaveCount(0);
    const about = more.getByRole('link', { name: `About ${name}` });
    await expect(about).toHaveAttribute('href', `/subjects/${slug}`);
    await about.click();
    await expect(page).toHaveURL(`${webBaseUrl}/subjects/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
  });

  test('a specialization’s level page: what it may study after the overview, its siblings, then planning', async ({ page, request }) => {
    test.setTimeout(240_000);
    const subjectName = `${acceptanceCountryName()} Level Sections Parent`;
    const name = `${acceptanceCountryName()} Level Sections Branch`;
    const sibling = `${acceptanceCountryName()} Level Sections Sibling`;
    await loginAsAdmin(page);
    await page.waitForLoadState('networkidle');

    /* A specialization publishes under a published subject only. */
    const subjectId = await createSubject(page, subjectName, ['MBA']);
    const subjectSlug = await box(page, 'Slug').inputValue();
    await publishSubject(page);

    const branch = await createSpecialization(page, subjectId, name, ['MBA']);
    const card = page.locator('#specialization-level-pages');
    await card.getByRole('link', { name: 'Write the MBA page' }).click();
    await page.waitForURL(new RegExp(`/specializations/${branch.id}/level-pages/${UUID}$`));
    await expect(page.getByRole('heading', { name: `MBA in ${name}` })).toBeVisible();
    await expect(box(page, 'Intro')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Topics a programme at this level usually covers. Shows as “What you may study”.', { exact: true })).toBeVisible();
    const words = {
      intro: 'A business degree for those who run ports.',
      studyTopics: 'Terminal operations, port finance and customs law.',
    };
    await box(page, 'Intro').fill(words.intro);
    await box(page, 'What you may study').fill(words.studyTopics);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(new RegExp(`/specializations/${branch.id}(#specialization-level-pages)?$`));
    await expect(page.getByText(`MBA in ${name} published successfully.`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/specializations$/);

    /* A sibling at MBA, for "Other … specializations at MBA". */
    const other = await createSpecialization(page, subjectId, sibling, ['MBA']);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/specializations$/);

    const path = `/subjects/${subjectSlug}/${branch.slug}/mba`;
    await page.goto(`${webBaseUrl}${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`MBA in ${name}`);

    /* Its order: why, what it may study, the list, then its siblings, its
       subject, and on to planning the level. Nothing listed, no "Where to
       study"; no consultants and no other subjects on a specialization's. */
    const ids = await sectionIds(page);
    expect(ids.filter((id) => SPECIALIZATION_ORDER.includes(id))).toEqual([
      'overview', 'study-topics', 'discovery', 'specializations', 'parent-subject', 'plan-your-level', 'more', 'plan',
    ]);
    await expect(page.locator('section#consultants')).toHaveCount(0);
    await expect(page.locator('section#more-subjects')).toHaveCount(0);

    for (const [id, heading, text] of [
      ['overview', `Why study an MBA in ${name}?`, words.intro],
      ['study-topics', 'What you may study', words.studyTopics],
    ] as const) {
      const band = page.locator(`section#${id}`);
      await expect(band.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
      await expect(band.getByText(text, { exact: true })).toBeVisible();
    }

    /* Its siblings at MBA, then all of its subject's specializations. */
    const siblings = page.locator('section#specializations');
    await expect(siblings.getByRole('heading', { level: 2, name: `Other ${subjectName} specializations at MBA`, exact: true })).toBeVisible();
    await expect(siblings.locator(`a[href="/subjects/${subjectSlug}/${other.slug}/mba"]`)).toHaveCount(1);
    const all = siblings.getByRole('link', { name: `View all ${subjectName} specializations` });
    await expect(all).toHaveAttribute('href', `/subjects/${subjectSlug}/specializations`);
    await expectEachOpens(request, [`/subjects/${subjectSlug}/${other.slug}/mba`, `/subjects/${subjectSlug}/specializations`]);

    /* "Plan your MBA", with counselling about the specialization. */
    const plan = page.locator('section#plan-your-level');
    await expect(plan.getByRole('heading', { level: 2, name: 'Plan your MBA', exact: true })).toBeVisible();
    const planLinks = await hrefs(plan);
    expect(planLinks).toEqual(planHrefs(
      'MBA',
      `/counselling?source=specialization&subject=${subjectSlug}&specialization=${branch.slug}&from=${encodeURIComponent(path)}`,
    ));
    await expectEachOpens(request, planLinks);
  });
});
