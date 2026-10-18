import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { webBaseUrl } from './helpers/e2e-urls';

/**
 * Level pages, written in the admin: a subject's (or a specialization's) page
 * at one study level, such as /subjects/<slug>/bachelors.
 *
 * The rows on the Level pages card are the saved ticks, as the API works them
 * out, adjusted by the ticks as they are clicked: a level unticked is marked
 * "Removed when you save" and leaves on save. Writing a page happens on a
 * page of its own; publishing it comes back to the card with a green toast,
 * moving it to draft stays put, a second tab saving over the first is
 * refused, and deleting its content returns the row to "Not written". The
 * website shows what was written once the subject and the page are both
 * published.
 *
 * Every subject here is named with this run's country prefix, so the
 * acceptance cleanup removes it -- its level pages and their SEO with it.
 */

const UUID = '[0-9a-f-]{36}';

async function signIn(page: Page) {
  await loginAsAdmin(page);
  await page.waitForLoadState('networkidle');
}

function box(scope: Page | Locator, name: string) {
  return scope.getByRole('textbox', { name, exact: true });
}

function row(card: Locator, level: string) {
  return card.getByRole('listitem').filter({ has: card.page().getByText(level, { exact: true }) });
}

async function expectToast(page: Page, text: string, tone: 'success' | 'ok') {
  const toast = page.getByText(text, { exact: true });
  await expect(toast).toBeVisible();
  await expect(toast.locator('xpath=ancestor::*[@data-toast-tone][1]')).toHaveAttribute('data-toast-tone', tone);
}

async function createSubject(page: Page, name: string, levels: string[]) {
  await page.goto('/subjects/new');
  await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();
  await box(page, 'Name').fill(name);
  await box(page, 'Short description').fill('Written by the level pages acceptance test.');
  for (const level of levels) await page.getByRole('checkbox', { name: level, exact: true }).check();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(new RegExp(`/subjects/${UUID}$`));
  await expect(page.getByRole('heading', { name: 'Edit subject' })).toBeVisible();
  return page.url().split('/subjects/')[1];
}

test.describe('level pages written in the admin', () => {
  test('a subject’s level page: write, publish, move to draft, a stale second tab, delete', async ({ page, context }) => {
    test.setTimeout(180_000);
    const name = `${acceptanceCountryName()} Level Pages Subject`;
    await signIn(page);
    const subjectId = await createSubject(page, name, ["Bachelor's", 'PhD']);
    const slug = await box(page, 'Slug').inputValue();

    /* The card lists what the saved ticks offer. */
    const card = page.locator('#subject-level-pages');
    await expect(card.getByRole('heading', { name: 'Level pages' })).toBeVisible();
    await expect(card.getByRole('link', { name: "Write the Bachelor's page" })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toBeVisible();
    await expect(row(card, "Bachelor's")).toContainText('Not written');
    await expect(row(card, "Bachelor's")).toContainText('Ticked here');

    /* Unticking marks the row at once; it leaves the card on save. */
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).uncheck();
    await expect(row(card, 'PhD')).toContainText('Removed when you save');
    /* The leaving row says what the save does; the "Not saved yet" hint is
       for rows that carry that chip, and none does. */
    await expect(card.getByText(/follow your study level ticks/)).toHaveCount(0);
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(card.getByText(/follow your study level ticks/)).toHaveCount(0);
    await expect(row(card, 'PhD')).toHaveCount(0);
    await expect(card.getByRole('link', { name: "Write the Bachelor's page" })).toBeVisible();

    /* Write the Bachelor's page. */
    await card.getByRole('link', { name: "Write the Bachelor's page" }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}/level-pages/${UUID}$`));
    const editorUrl = page.url();
    await expect(page.getByRole('heading', { name: `Bachelor's in ${name}` })).toBeVisible();
    await expect(page.getByText('NOT WRITTEN', { exact: true })).toBeVisible();

    const intro = 'A first degree in the sea, its coasts and the life in them.';
    await expect(box(page, 'Intro')).toBeVisible({ timeout: 30_000 });
    await box(page, 'Intro').fill(intro);
    await box(page, 'Admission note').fill('Most programmes ask for biology or chemistry at school.');
    await box(page, 'Careers note').fill('Graduates work in conservation, fisheries and research.');
    await box(page, 'Industries').fill('Fisheries, shipping and offshore energy.');
    await box(page, 'Employers').fill('Port authorities and marine research institutes.');
    await box(page, 'Looking ahead').fill('Demand grows with offshore wind and ocean monitoring.');
    const faqs = [
      ['Is fieldwork part of the degree?', 'Yes, most programmes include time at sea.'],
      ['Do I need to dive?', 'Not usually; some modules offer it.'],
      ['Can I specialise later?', 'Yes, at master’s level.'],
    ];
    for (const [index, [question, answer]] of faqs.entries()) {
      if (index > 0) await page.getByRole('button', { name: '+ Add another FAQ' }).click();
      await box(page, 'Question').nth(index).fill(question);
      await box(page, 'Answer').nth(index).fill(answer);
    }
    await box(page, 'SEO title').fill(`Bachelor's in ${name}`);
    await box(page, 'Meta description').fill('Study it at bachelor’s level.');

    /* Publish goes back to the card with a green toast. */
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}(#subject-level-pages)?$`));
    await expectToast(page, `Bachelor's in ${name} published successfully.`, 'success');
    const published = row(card, "Bachelor's");
    await expect(published).toContainText('Published');
    await expect(published).toContainText('Intro · 3 FAQs');
    await expect(published).toContainText('Search-ready');

    /* With the subject published too, the website shows what was written. */
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/subjects$/);
    await page.goto(`${webBaseUrl}/subjects/${slug}/bachelors`);
    await expect(page.getByText(intro)).toBeVisible();
    await expect(page.getByText(faqs[0][0])).toBeVisible();
    /* Each written section is a band of its own, under its own heading. */
    for (const heading of ['Career pathways', 'Industries', 'Employers', 'Looking ahead'])
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText('Fisheries, shipping and offshore energy.')).toBeVisible();
    await expect(page.getByText('Port authorities and marine research institutes.')).toBeVisible();
    await expect(page.getByText('Demand grows with offshore wind and ocean monitoring.')).toBeVisible();
    await expect(page.getByText('Named for illustration only; not a ranking, endorsement or partnership.')).toBeVisible();

    /* Move to draft stays on the editor. */
    await page.goto(`/subjects/${subjectId}`);
    await card.getByRole('link', { name: "Edit the Bachelor's page" }).click();
    await page.waitForURL(editorUrl);
    await page.getByRole('button', { name: 'Move to draft' }).click();
    await expect(page.getByText('Moved to draft.', { exact: true })).toBeVisible();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();

    /* A second tab opened on the same version cannot save over the first. */
    const other = await context.newPage();
    await other.goto(editorUrl);
    await other.waitForLoadState('networkidle');
    await expect(other.getByRole('heading', { name: `Bachelor's in ${name}` })).toBeVisible();
    await expect(box(other, 'Careers note')).toBeVisible({ timeout: 30_000 });

    await box(page, 'Careers note').fill('Saved first, in the first tab.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText(/^Draft saved\./)).toBeVisible();

    await box(other, 'Careers note').fill('Saved second, in the other tab.');
    await other.getByRole('button', { name: 'Save draft' }).click();
    await expect(other.getByRole('alert').filter({ hasText: 'This level page changed in another session. Reload before saving' })).toBeVisible();
    await expect(box(other, 'Careers note')).toContainText('Saved second, in the other tab.');
    await other.close();

    /* Deleting the content returns the row to "Not written". */
    await page.goto(`/subjects/${subjectId}`);
    await card.getByRole('button', { name: "More actions for the Bachelor's page" }).click();
    await page.getByRole('menuitem', { name: 'Delete content' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText("Delete this level page's content?");
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expectToast(page, "Bachelor's page content deleted.", 'ok');
    await expect(row(card, "Bachelor's")).toContainText('Not written');
    await expect(card.getByRole('link', { name: "Write the Bachelor's page" })).toBeVisible();
  });

  test('a specialization’s level page is written from the specialization', async ({ page }) => {
    test.setTimeout(120_000);
    const subjectName = `${acceptanceCountryName()} Level Pages Parent`;
    const name = `${acceptanceCountryName()} Level Pages Branch`;
    await signIn(page);
    const subjectId = await createSubject(page, subjectName, []);

    await page.goto(`/specializations/new?subject=${subjectId}`);
    await expect(page.getByRole('heading', { name: 'Create specialization' })).toBeVisible();
    await box(page, 'Name').fill(name);
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).check();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.waitForURL(new RegExp(`/specializations/${UUID}$`));
    const specializationId = page.url().split('/specializations/')[1];
    /* The address and heading change mid-save; the specialization's own
       editor then replaces the Create one, which stays locked until it has.
       A link followed before that switch lands can lose out to it. */
    await expect(box(page, 'Name')).toBeEnabled();

    const card = page.locator('#specialization-level-pages');
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toBeVisible();
    await card.getByRole('link', { name: 'Write the PhD page' }).click();
    await page.waitForURL(new RegExp(`/specializations/${specializationId}/level-pages/${UUID}$`));
    await expect(page.getByRole('heading', { name: `PhD in ${name}` })).toBeVisible();
    await expect(page.getByRole('link', { name: `← ${name}` })).toHaveAttribute(
      'href',
      `/specializations/${specializationId}#specialization-level-pages`,
    );

    await expect(box(page, 'Intro')).toBeVisible({ timeout: 30_000 });
    await box(page, 'Intro').fill('Research degrees in this branch of the field.');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved. It stays off the site until you publish it.')).toBeVisible();

    await page.getByRole('link', { name: `← ${name}` }).click();
    await page.waitForURL(new RegExp(`/specializations/${specializationId}(#specialization-level-pages)?$`));
    await expect(row(card, 'PhD')).toContainText('Draft');
    await expect(row(card, 'PhD')).toContainText('Intro · 0 FAQs');
    await expect(card.getByRole('link', { name: 'Edit the PhD page' })).toBeVisible();
  });
});
