import { expect, test, type Locator, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { webBaseUrl } from './helpers/e2e-urls';
import {
  countAcceptanceRecords,
  purgeAcceptanceRecords,
  totalAcceptanceRecords,
} from './helpers/acceptance-cleanup';
import {
  acceptanceEmail,
  acceptanceRunId,
  acceptanceSlugPrefix,
  acceptanceTextPrefix,
} from './helpers/acceptance-run';

// The run id every acceptance record is tagged with, shared with the cleanup
// helper so it can recognise exactly the rows this run created.
const runId = acceptanceRunId();
const prefix = acceptanceTextPrefix(runId);
const slugPrefix = acceptanceSlugPrefix(runId);
const universityName = `${prefix} University`;
const universitySlug = `${slugPrefix}university`;
const offeringName = `${prefix} Offering`;
const offeringSlug = `${slugPrefix}offering`;
const scholarshipTitle = `${prefix} Scholarship`;
const scholarshipSlug = `${slugPrefix}scholarship`;
const consultantName = `${prefix} Consultant`;
const consultantSlug = `${slugPrefix}consultant`;
const jobTitle = `${prefix} Job`;
const jobSlug = `${slugPrefix}job`;
const eventTitle = `${prefix} Event`;
const eventSlug = `${slugPrefix}event`;
const storyTitle = `${prefix} Story`;
const storySlug = `${slugPrefix}story`;
const testimonialQuote = `${prefix} testimonial is fictional local acceptance content.`;

async function chooseFirst(form: Locator, label: string) {
  const select = form.getByLabel(label, { exact: true });
  await expect(select).toBeVisible();
  await expect
    .poll(async () => select.locator('option').count())
    .toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
}

async function chooseNamed(form: Locator, label: string, name: string) {
  const select = form.getByLabel(label, { exact: true });
  await expect(select).toBeVisible();
  await expect
    .poll(async () => select.locator('option').count())
    .toBeGreaterThan(1);
  await select.selectOption({ label: name });
}

async function chooseOne(form: Locator, group: string) {
  const fieldset = form.getByRole('group', { name: group, exact: true });
  const choices = fieldset.getByRole('checkbox');
  await expect.poll(async () => choices.count()).toBeGreaterThan(0);
  await choices.nth(0).check();
}

async function openCreate(page: Page, resource: string) {
  await page.goto(`/phase1/${resource}`);
  const create = page.getByRole('button', {
    name: resource === 'offerings' ? 'Create offering' : 'Create record',
  });
  await expect(create).toBeVisible();
  await create.click();
  const form = page.getByRole('form', { name: `Create ${resource}` });
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Advanced JSON draft', { exact: true })).toHaveCount(0);
  return form;
}

async function saveAndOpenEdit(page: Page, resource: string, rowText: string) {
  const form = page.getByRole('form', { name: `Create ${resource}` });
  await form.getByRole('button', { name: 'Create draft' }).click();
  const row = page.getByRole('row').filter({ hasText: rowText });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('form', { name: `Edit ${resource}` });
  await expect(edit).toBeVisible();
  return edit;
}

async function saveEdit(page: Page, resource: string, rowText: string) {
  const form = page.getByRole('form', { name: `Edit ${resource}` });
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('row').filter({ hasText: rowText })).toBeVisible();
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: rowText });
  await row.getByRole('button', { name: 'Edit' }).click();
  return page.getByRole('form', { name: `Edit ${resource}` });
}

async function publishAndVerify(
  page: Page,
  resource: string,
  rowText: string,
  publicPath: string,
  adminRowText = rowText,
) {
  await page.getByRole('form', { name: `Edit ${resource}` }).getByRole('button', { name: 'Close editor' }).click();
  const row = page.getByRole('row').filter({ hasText: adminRowText });
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.goto(`${webBaseUrl}${publicPath}`);
  await expect(page.getByText(rowText, { exact: true }).first()).toBeVisible();
  await page.goto(`/phase1/${resource}`);
  const adminRow = page.getByRole('row').filter({ hasText: adminRowText });
  await adminRow.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.goto(`${webBaseUrl}${publicPath}`);
  await expect(page.getByText(rowText, { exact: true })).toHaveCount(0);
  await page.goto(`/phase1/${resource}`);
  await page.getByRole('row').filter({ hasText: adminRowText }).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
}

test.describe.serial('Phase 1 structured Admin CRUD through the visible UI', () => {
  // Every record this spec creates carries the acceptance-owned marker, so
  // cleanup is scoped by that marker rather than by ids gathered during the
  // run. That keeps it correct even when an earlier assertion failed and the
  // later records were never created.
  test.afterAll(async () => {
    await purgeAcceptanceRecords();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates, validates, edits, reloads, and publishes a University without JSON', async ({ page }) => {
    const form = await openCreate(page, 'universities');
    const nameField = form.getByLabel('Name', { exact: true });
    const slugField = form.getByLabel('Slug', { exact: true });
    await expect(nameField).toHaveAttribute('required', '');
    await expect(slugField).toHaveAttribute('required', '');
    await form.getByRole('button', { name: 'Create draft' }).click();
    await expect(nameField).toBeFocused();
    await form.getByLabel('Name', { exact: true }).fill(universityName);
    await form.getByLabel('Slug', { exact: true }).fill(universitySlug);
    await chooseFirst(form, 'Country');
    await form.getByLabel('Institution type', { exact: true }).fill('Fictional demo institution');
    await form.getByLabel('Short summary', { exact: true }).fill('Fictional local university for Admin acceptance.');
    await form.getByLabel('Description', { exact: true }).fill('Acceptance Demo University is fictional local test content.');
    await form.getByLabel('SEO title', { exact: true }).fill(`${universityName} SEO`);
    await form.getByLabel('Meta description', { exact: true }).fill('Fictional local University SEO description.');
    const campuses = form.getByRole('group', { name: 'Campuses' });
    await campuses.getByRole('button', { name: 'Add Campuse' }).click();
    await campuses.getByLabel('name', { exact: true }).fill(`${prefix} Campus`);
    await campuses.getByLabel('city', { exact: true }).fill('Local City');
    const accreditations = form.getByRole('group', { name: 'Accreditations' });
    await accreditations.getByRole('button', { name: 'Add Accreditation' }).click();
    await accreditations.getByLabel('name', { exact: true }).fill('Fictional accreditation');
    const edit = await saveAndOpenEdit(page, 'universities', universityName);
    await expect(edit.getByLabel('Country', { exact: true })).not.toHaveValue('');
    await expect(edit.getByRole('group', { name: 'Campuses' }).getByLabel('city', { exact: true })).toHaveValue('Local City');
    await edit.getByLabel('Short summary', { exact: true }).fill('Updated fictional local university summary.');
    const reloaded = await saveEdit(page, 'universities', universityName);
    await expect(reloaded.getByLabel('Short summary', { exact: true })).toHaveValue('Updated fictional local university summary.');
    await publishAndVerify(page, 'universities', universityName, '/universities');
  });

  test('creates, edits, and publishes an Offering with its nested intake and requirements', async ({ page }) => {
    const form = await openCreate(page, 'offerings');
    await form.getByLabel('Name', { exact: true }).fill(offeringName);
    await form.getByLabel('Slug', { exact: true }).fill(offeringSlug);
    await chooseNamed(form, 'University', universityName);
    await chooseFirst(form, 'Generic course');
    await chooseFirst(form, 'Course level');
    await chooseFirst(form, 'Campus (optional)');
    await form.getByLabel('Study mode', { exact: true }).selectOption({ index: 1 });
    await form.getByLabel('Duration minimum', { exact: true }).fill('1');
    await form.getByLabel('Tuition minimum', { exact: true }).fill('15000');
    await form.getByLabel('Currency', { exact: true }).fill('CAD');
    await form.getByLabel('Short summary', { exact: true }).fill('Fictional offering for acceptance.');
    await form.getByLabel('Description', { exact: true }).fill('Fictional offering description.');
    await chooseOne(form, 'Intakes');
    await form.getByLabel(/Deadline for/).fill('2030-09-01');
    const requirements = form.getByRole('group', { name: 'Academic and English-test requirements' });
    await requirements.getByRole('button', { name: 'Add Academic and English-test requirement' }).click();
    await requirements.getByLabel('title', { exact: true }).fill('Academic requirement');
    await requirements.getByLabel('description', { exact: true }).fill('Fictional academic requirement.');
    await requirements.getByLabel('minimum Score', { exact: true }).fill('70');
    const edit = await saveAndOpenEdit(page, 'offerings', offeringName);
    await expect(edit.getByLabel('Tuition minimum', { exact: true })).toHaveValue('15000');
    await expect(
      edit
        .getByRole('group', { name: 'Intakes' })
        .locator('input[type="checkbox"]:checked'),
    ).toHaveCount(1);
    await edit.getByLabel('Tuition minimum', { exact: true }).fill('16000');
    const reloaded = await saveEdit(page, 'offerings', offeringName);
    await expect(reloaded.getByLabel('Tuition minimum', { exact: true })).toHaveValue('16000');
    await publishAndVerify(page, 'offerings', offeringName, `/universities/${universitySlug}/courses`);
  });

  test('creates, edits, and publishes a Scholarship with multiple relationships', async ({ page }) => {
    const form = await openCreate(page, 'scholarships');
    await form.getByLabel('Title', { exact: true }).fill(scholarshipTitle);
    await form.getByLabel('Slug', { exact: true }).fill(scholarshipSlug);
    await chooseFirst(form, 'Provider');
    await form.getByLabel('Benefit type', { exact: true }).fill('Tuition support');
    await form.getByLabel('Amount', { exact: true }).fill('2500');
    await form.getByLabel('Currency', { exact: true }).fill('CAD');
    await form.getByLabel('Deadline', { exact: true }).fill('2030-10-01');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local scholarship.');
    await form.getByLabel('Eligibility', { exact: true }).fill('Fictional acceptance eligibility.');
    await chooseOne(form, 'Eligible countries');
    await chooseOne(form, 'Eligible universities');
    await chooseOne(form, 'Eligible university course offerings');
    const edit = await saveAndOpenEdit(page, 'scholarships', scholarshipTitle);
    // Asserts the relationship control actually re-rendered after reopening.
    // (Previously this compared the locator's count against a second, racing
    // read of the same count, so it asserted nothing and flaked when the
    // group had not painted yet.)
    await expect(
      edit.getByRole('group', { name: 'Eligible countries' }).getByRole('checkbox').first(),
    ).toBeVisible();
    await expect(
      edit.getByRole('group', { name: 'Eligible countries' }).getByRole('checkbox', { checked: true }),
    ).not.toHaveCount(0);
    await edit.getByLabel('Amount', { exact: true }).fill('3000');
    const reloaded = await saveEdit(page, 'scholarships', scholarshipTitle);
    await expect(reloaded.getByLabel('Amount', { exact: true })).toHaveValue('3000');
    await publishAndVerify(page, 'scholarships', scholarshipTitle, '/scholarships');
  });

  test('creates, edits, and publishes a Consultant with relationship and tag controls', async ({ page }) => {
    const form = await openCreate(page, 'consultants');
    await form.getByLabel('Name', { exact: true }).fill(consultantName);
    await form.getByLabel('Slug', { exact: true }).fill(consultantSlug);
    await form.getByLabel('Email', { exact: true }).fill(acceptanceEmail('acceptance-demo'));
    await form.getByLabel('Verification state', { exact: true }).selectOption('VERIFIED');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local consultant.');
    await chooseOne(form, 'Locations');
    await chooseOne(form, 'Destination countries');
    const services = form.getByRole('group', { name: 'Services' });
    await services.getByLabel('Add Services', { exact: true }).fill('Fictional counselling');
    await services.getByRole('button', { name: 'Add' }).click();
    const languages = form.getByRole('group', { name: 'Languages' });
    await languages.getByLabel('Add Languages', { exact: true }).fill('English');
    await languages.getByRole('button', { name: 'Add' }).click();
    const edit = await saveAndOpenEdit(page, 'consultants', consultantName);
    await expect(
      edit.getByRole('button', { name: 'Remove Fictional counselling' }),
    ).toBeVisible();
    await edit.getByLabel('Description', { exact: true }).fill('Updated fictional local consultant.');
    const reloaded = await saveEdit(page, 'consultants', consultantName);
    await expect(reloaded.getByLabel('Description', { exact: true })).toHaveValue('Updated fictional local consultant.');
    await publishAndVerify(page, 'consultants', consultantName, '/study-abroad-consultants');
  });

  test('creates, edits, and publishes a Job', async ({ page }) => {
    const form = await openCreate(page, 'jobs');
    await form.getByLabel('Title', { exact: true }).fill(jobTitle);
    await form.getByLabel('Slug', { exact: true }).fill(jobSlug);
    await form.getByLabel('Department', { exact: true }).fill('Fictional Careers');
    await form.getByLabel('Employment type', { exact: true }).fill('FULL_TIME');
    await form.getByLabel('Location (free text)', { exact: true }).fill('Local');
    await form.getByLabel('Remote state', { exact: true }).fill('HYBRID');
    await form.getByLabel('Expiry', { exact: true }).fill('2030-12-31');
    await form.getByLabel('Description', { exact: true }).fill('Fictional job description.');
    const edit = await saveAndOpenEdit(page, 'jobs', jobTitle);
    await edit.getByLabel('Department', { exact: true }).fill('Updated Fictional Careers');
    const reloaded = await saveEdit(page, 'jobs', jobTitle);
    await expect(reloaded.getByLabel('Department', { exact: true })).toHaveValue('Updated Fictional Careers');
    await publishAndVerify(page, 'jobs', jobTitle, '/careers');
  });

  test('rejects invalid Event date ranges, then creates, edits, and publishes an Event', async ({ page }) => {
    const form = await openCreate(page, 'events');
    await form.getByLabel('Title', { exact: true }).fill(eventTitle);
    await form.getByLabel('Slug', { exact: true }).fill(eventSlug);
    await form.getByLabel('Start date and time', { exact: true }).fill('2030-09-02T12:00');
    await form.getByLabel('End date and time', { exact: true }).fill('2030-09-01T12:00');
    await form.getByRole('button', { name: 'Create draft' }).click();
    await expect(form.getByText('End date and time must be after the start.')).toBeVisible();
    await form.getByLabel('End date and time', { exact: true }).fill('2030-09-02T15:00');
    await form.getByLabel('Event type', { exact: true }).selectOption('HYBRID');
    await form.getByLabel('Venue (free text)', { exact: true }).fill('Fictional local venue');
    await form.getByLabel('Online URL', { exact: true }).fill('https://example.invalid/event');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local event.');
    const speakers = form.getByRole('group', { name: 'Speakers' });
    await speakers.getByLabel('Add Speakers', { exact: true }).fill('Fictional speaker');
    await speakers.getByRole('button', { name: 'Add' }).click();
    const edit = await saveAndOpenEdit(page, 'events', eventTitle);
    await expect(edit.getByLabel('Event type', { exact: true })).toHaveValue('HYBRID');
    await edit.getByLabel('Venue (free text)', { exact: true }).fill('Updated fictional venue');
    const reloaded = await saveEdit(page, 'events', eventTitle);
    await expect(reloaded.getByLabel('Venue (free text)', { exact: true })).toHaveValue('Updated fictional venue');
    await publishAndVerify(page, 'events', eventTitle, '/events');
  });

  test('creates, edits, and publishes a Success Story and a Testimonial as distinct workflows', async ({ page }) => {
    const story = await openCreate(page, 'success-stories');
    await story.getByLabel('Title', { exact: true }).fill(storyTitle);
    await story.getByLabel('Slug', { exact: true }).fill(storySlug);
    await story.getByLabel('Display attribution', { exact: true }).fill('Fictional demo student');
    await story.getByLabel('Journey content', { exact: true }).fill('Fictional local journey content.');
    await chooseFirst(story, 'Country (optional)');
    await chooseFirst(story, 'University (optional)');
    const storyEdit = await saveAndOpenEdit(page, 'success-stories', storyTitle);
    await storyEdit.getByLabel('Journey content', { exact: true }).fill('Updated fictional local journey content.');
    const storyReloaded = await saveEdit(page, 'success-stories', storyTitle);
    await expect(storyReloaded.getByLabel('Journey content', { exact: true })).toHaveValue('Updated fictional local journey content.');
    await publishAndVerify(page, 'success-stories', storyTitle, '/success-stories');

    const testimonial = await openCreate(page, 'testimonials');
    await testimonial.getByRole('button', { name: 'Create draft' }).click();
    await expect(testimonial.getByLabel('Quote', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await testimonial.getByLabel('Quote', { exact: true }).fill(testimonialQuote);
    await testimonial.getByLabel('Display attribution', { exact: true }).fill('Fictional demo attribution');
    await chooseFirst(testimonial, 'University (optional)');
    const testimonialEdit = await saveAndOpenEdit(page, 'testimonials', testimonialQuote.slice(0, 48));
    await testimonialEdit.getByLabel('Quote', { exact: true }).fill(`${testimonialQuote} Updated.`);
    const testimonialReloaded = await saveEdit(page, 'testimonials', `${testimonialQuote} Updated.`.slice(0, 48));
    await expect(testimonialReloaded.getByLabel('Quote', { exact: true })).toHaveValue(`${testimonialQuote} Updated.`);
    await publishAndVerify(
      page,
      'testimonials',
      `${testimonialQuote} Updated.`,
      '/testimonials',
      `${testimonialQuote} Updated.`.slice(0, 48),
    );
  });

  test('requires an explicit archive confirmation for structured records', async ({ page }) => {
    await page.goto('/phase1/universities');
    const row = page.getByRole('row').filter({ hasText: universityName });
    await row.getByRole('button', { name: 'Archive' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archive this record?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('leaves no acceptance-owned records behind', async () => {
    // Runs last in this serial block, after every record above has been
    // created and exercised. Purging here (rather than only in the global
    // teardown) means a single-file run is self-cleaning too.
    const before = totalAcceptanceRecords(await countAcceptanceRecords());
    expect(before, 'the spec above should have created acceptance records').toBeGreaterThan(0);
    await purgeAcceptanceRecords();
    const after = await countAcceptanceRecords();
    // Asserted per key rather than against a hardcoded object, so adding a new
    // tracked record type to the cleanup helper strengthens this test instead
    // of breaking it on shape.
    const nonZero = Object.entries(after).filter(([, count]) => count !== 0);
    expect(nonZero, 'acceptance records must not survive the suite').toEqual([]);
    expect(totalAcceptanceRecords(after)).toBe(0);
  });
});
