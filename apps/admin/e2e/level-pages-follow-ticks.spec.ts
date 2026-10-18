import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';

/**
 * The Level pages card follows the study-level ticks as they are clicked, not
 * only once they are saved. A level ticked shows its row at once, marked "Not
 * saved yet", with its address and a "Save and write" button; a level
 * unticked is marked "Removed when you save" and can no longer be opened.
 *
 * A page can only be written for a level saved as offered, so "Save and
 * write" saves the subject as it stands -- a draft stays a draft, a published
 * subject stays published -- and opens that level's page, ready to write. A
 * subject not saved yet works the same way: tick, "Save and write", and the
 * new subject's page is open.
 *
 * Each subject is deleted from the Subjects list at the end. It is named with
 * this run's country prefix too, so the acceptance cleanup removes one a
 * failed test leaves behind.
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

/** A name of its own for each subject, so a rerun in the same run never
 * meets the slug of the last one. */
function subjectName(label: string) {
  return `${acceptanceCountryName()} ${label} ${Math.random().toString(36).slice(2, 7)}`;
}

/** A study level's id, as the level-page editor's address names it. */
async function levelId(request: APIRequestContext, name: string) {
  const response = await request.get(`${apiBaseUrl}/api/v1/course-levels`);
  expect(response.status()).toBe(200);
  const levels = ((await response.json()) as { data: Array<{ id: string; name: string }> }).data;
  const level = levels.find((item) => item.name === name);
  expect(level, `the ${name} study level is active`).toBeTruthy();
  return level!.id;
}

async function createSubject(page: Page, name: string, levels: string[]) {
  await page.goto('/subjects/new');
  await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();
  await box(page, 'Name').fill(name);
  await box(page, 'Short description').fill('Written by the level pages follow ticks acceptance test.');
  for (const level of levels) await page.getByRole('checkbox', { name: level, exact: true }).check();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(new RegExp(`/subjects/${UUID}$`));
  await expect(page.getByRole('heading', { name: 'Edit subject' })).toBeVisible();
  /* The subject's own editor replaces the Create one, which stays locked
     until it has; a tick clicked before that would be lost with it. */
  await expect(box(page, 'Name')).toBeEnabled();
  return page.url().split('/subjects/')[1];
}

/* Deleted from the Subjects list, as an editor would. */
async function deleteSubject(page: Page, name: string) {
  await page.goto('/subjects');
  await page.getByRole('region', { name: 'Filter subjects' }).getByRole('textbox', { name: 'Search' }).fill(name);
  const listed = page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
  await expect(listed).toHaveCount(1);
  await listed.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Confirm subject name' }).fill(name);
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText(`${name} deleted.`, { exact: true })).toBeVisible();
  await expect(listed).toHaveCount(0);
}

/** The level-page editor is open and writable -- not the read-only page of
 * a level that is not offered -- shown by writing an intro and saving it. */
async function writeIntro(page: Page, heading: string, intro: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByText('NOT WRITTEN', { exact: true })).toBeVisible();
  await expect(page.getByText(/is not offered for .+ now/)).toHaveCount(0);
  await expect(box(page, 'Intro')).toBeVisible({ timeout: 30_000 });
  await box(page, 'Intro').fill(intro);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved. It stays off the site until you publish it.')).toBeVisible();
}

test.describe('level pages follow the study level ticks', () => {
  test('a draft subject: a tick shows at once, an untick is marked, Save and write opens the page', async ({ page, request }) => {
    test.setTimeout(150_000);
    const name = subjectName('Follow Ticks');
    const diplomaId = await levelId(request, 'Diploma');
    await signIn(page);
    const subjectId = await createSubject(page, name, ["Bachelor's", 'PhD']);
    const slug = await box(page, 'Slug').inputValue();

    const card = page.locator('#subject-level-pages');
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toBeVisible();
    await expect(card.getByText('Not saved yet', { exact: true })).toHaveCount(0);

    /* Ticked and not saved: the row is there at once, with its address. It
       can only be written once saved, so it has "Save and write", not a
       link to an editor that would refuse it. */
    await page.getByRole('checkbox', { name: 'Diploma', exact: true }).check();
    const diploma = row(card, 'Diploma');
    await expect(diploma).toContainText('Not saved yet');
    await expect(diploma).toContainText(`/subjects/${slug}/diploma`);
    await expect(diploma).toContainText('Ticked here');
    await expect(card.getByText(/follow your study level ticks/)).toBeVisible();
    await expect(card.getByRole('link', { name: 'Write the Diploma page' })).toHaveCount(0);
    const saveAndWrite = card.getByRole('button', { name: 'Save and write the Diploma page' });
    await expect(saveAndWrite).toHaveText('Save and write');
    /* The saved rows stand as they were. */
    await expect(row(card, "Bachelor's")).not.toContainText('Not saved yet');
    await expect(card.getByRole('link', { name: "Write the Bachelor's page" })).toBeVisible();

    /* Unticked and not saved: marked as leaving, and no longer opened. */
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).uncheck();
    const phd = row(card, 'PhD');
    await expect(phd).toContainText('Removed when you save');
    await expect(phd).toContainText('Unticked. It leaves this list when you save.');
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toHaveCount(0);

    /* Ticked back, it is as saved again. */
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).check();
    await expect(phd).not.toContainText('Removed when you save');
    await expect(card.getByRole('link', { name: 'Write the PhD page' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).uncheck();
    await expect(phd).toContainText('Removed when you save');

    /* Save and write: the ticks are saved, and the Diploma page opens,
       ready to write. */
    await saveAndWrite.click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}/level-pages/${diplomaId}$`));
    await writeIntro(page, `Diploma in ${name}`, 'Practical diplomas in the field, written straight after ticking it.');

    /* Back on the subject: still a draft, its ticks saved, the card as
       saved with nothing marked. */
    await page.getByRole('link', { name: `← ${name}` }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}(#subject-level-pages)?$`));
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Diploma', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'PhD', exact: true })).not.toBeChecked();
    await expect(row(card, 'Diploma')).toContainText('Draft');
    await expect(row(card, 'Diploma')).toContainText('Intro · 0 FAQs');
    await expect(card.getByRole('link', { name: 'Edit the Diploma page' })).toBeVisible();
    await expect(row(card, 'PhD')).toHaveCount(0);
    await expect(card.getByText('Not saved yet', { exact: true })).toHaveCount(0);

    await deleteSubject(page, name);
  });

  test('a published subject stays published through Save and write', async ({ page, request }) => {
    test.setTimeout(120_000);
    const name = subjectName('Follow Ticks Live');
    const diplomaId = await levelId(request, 'Diploma');
    await signIn(page);
    const subjectId = await createSubject(page, name, ["Bachelor's"]);
    const slug = await box(page, 'Slug').inputValue();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/subjects$/);

    await page.goto(`/subjects/${subjectId}`);
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    const card = page.locator('#subject-level-pages');
    await expect(card.getByRole('link', { name: "Write the Bachelor's page" })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Diploma', exact: true }).check();
    await expect(row(card, 'Diploma')).toContainText('Not saved yet');
    await card.getByRole('button', { name: 'Save and write the Diploma page' }).click();
    await page.waitForURL(new RegExp(`/subjects/${subjectId}/level-pages/${diplomaId}$`));
    await writeIntro(page, `Diploma in ${name}`, 'Diplomas, written on a subject already on the site.');

    /* Still live, now offered at Diploma too. */
    const detail = await request.get(`${apiBaseUrl}/api/v1/subjects/${slug}`);
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as { data: { offeredLevels?: Array<{ name: string }> } };
    expect((body.data.offeredLevels ?? []).map((level) => level.name)).toEqual(["Bachelor's", 'Diploma']);

    await deleteSubject(page, name);
  });

  test('a subject not saved yet: tick a level, Save and write, and its page is open', async ({ page, request }) => {
    test.setTimeout(120_000);
    const name = subjectName('Follow Ticks New');
    const bachelorsId = await levelId(request, "Bachelor's");
    await signIn(page);
    await page.goto('/subjects/new');
    await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();
    const card = page.locator('#subject-level-pages');
    await expect(card.getByText(/No study level is ticked yet/)).toBeVisible();

    await box(page, 'Name').fill(name);
    await box(page, 'Short description').fill('Written by the level pages follow ticks acceptance test.');
    const slug = await box(page, 'Slug').inputValue();
    await page.getByRole('checkbox', { name: "Bachelor's", exact: true }).check();
    const bachelors = row(card, "Bachelor's");
    await expect(bachelors).toContainText('Not saved yet');
    await expect(bachelors).toContainText(`/subjects/${slug}/bachelors`);
    await expect(card.getByText(/No study level is ticked yet/)).toHaveCount(0);

    await card.getByRole('button', { name: "Save and write the Bachelor's page" }).click();
    await page.waitForURL(new RegExp(`/subjects/${UUID}/level-pages/${bachelorsId}$`));
    const subjectId = page.url().split('/subjects/')[1].split('/')[0];
    await writeIntro(page, `Bachelor's in ${name}`, 'First degrees, written as the subject was made.');
    await expect(page.getByRole('link', { name: `← ${name}` })).toHaveAttribute('href', `/subjects/${subjectId}#subject-level-pages`);

    await deleteSubject(page, name);
  });
});
