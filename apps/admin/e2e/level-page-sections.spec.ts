import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { webBaseUrl } from './helpers/e2e-urls';

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
 *
 * The subject is named with this run's country prefix, so the acceptance
 * cleanup removes it -- its level pages with it.
 */

const UUID = '[0-9a-f-]{36}';

/* The bands a subject's level page runs, in order, as their anchors. */
const SUBJECT_ORDER = [
  'overview', 'specializations', 'careers', 'industries', 'employers', 'admission',
  'looking-ahead', 'where-to-study', 'discovery', 'faqs', 'more', 'plan',
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

test.describe('a level page’s written sections', () => {
  test('each written part is its own band on the website, in the page’s order', async ({ page }) => {
    test.setTimeout(180_000);
    const name = `${acceptanceCountryName()} Level Sections Subject`;
    await loginAsAdmin(page);
    await page.waitForLoadState('networkidle');
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

    const words = {
      intro: 'A business degree for managers in the sea trades.',
      careers: 'Graduates lead port, logistics and fleet teams.',
      industries: 'Shipping, logistics and marine insurance.',
      employers: 'Port operators and shipping lines.',
      lookingAhead: 'Greener fleets keep demand for these managers rising.',
    };
    await box(page, 'Intro').fill(words.intro);
    await box(page, 'Careers note').fill(words.careers);
    await box(page, 'Industries').fill(words.industries);
    await box(page, 'Employers').fill(words.employers);
    await box(page, 'Looking ahead').fill(words.lookingAhead);

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}(#subject-level-pages)?$`));
    await expect(page.getByText(`MBA in ${name} published successfully.`, { exact: true })).toBeVisible();

    /* With the subject published too, the website shows the page. */
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/subjects$/);
    await page.goto(`${webBaseUrl}/subjects/${slug}/mba`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`MBA in ${name}`);

    /* The bands run in the page's order; a part with nothing written, or
       nothing listed, has none. */
    const ids = await page.locator('section[id]').evaluateAll((sections) => sections.map((section) => section.id));
    expect(ids.filter((id) => SUBJECT_ORDER.includes(id))).toEqual([
      'overview', 'careers', 'industries', 'employers', 'looking-ahead', 'discovery', 'more', 'plan',
    ]);
    await expect(page.locator('#admission')).toHaveCount(0);
    await expect(page.locator('#where-to-study')).toHaveCount(0);

    /* Each band under its own heading, with what was written in it. */
    const bands: Array<[string, string, string]> = [
      ['overview', `Why study an MBA in ${name}?`, words.intro],
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
});
