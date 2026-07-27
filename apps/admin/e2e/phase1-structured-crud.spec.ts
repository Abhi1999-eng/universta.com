import { expect, test, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';
import { webBaseUrl } from './helpers/e2e-urls';

// CI may provide a stable run id; local reruns remain isolated after a failed run.
const runId = process.env.PHASE1_ACCEPTANCE_RUN_ID ?? randomUUID().slice(0, 8);
const prefix = `Acceptance Demo ${runId}`;
const universityName = `${prefix} University`;
const universitySlug = `acceptance-demo-${runId}-university`;
const offeringName = `${prefix} Offering`;
const offeringSlug = `acceptance-demo-${runId}-offering`;
const scholarshipTitle = `${prefix} Scholarship`;
const scholarshipSlug = `acceptance-demo-${runId}-scholarship`;
const consultantName = `${prefix} Consultant`;
const consultantSlug = `acceptance-demo-${runId}-consultant`;
const jobTitle = `${prefix} Job`;
const jobSlug = `acceptance-demo-${runId}-job`;
const eventTitle = `${prefix} Event`;
const eventSlug = `acceptance-demo-${runId}-event`;
const storyTitle = `${prefix} Story`;
const storySlug = `acceptance-demo-${runId}-story`;
const testimonialQuote = `${prefix} testimonial is fictional local acceptance content.`;

async function chooseFirst(form: Locator, label: string) {
  const select = form.getByLabel(label, { exact: true });
  await expect(select).toBeVisible();
  await expect
    .poll(async () => select.locator('option').count())
    .toBeGreaterThan(1);
  await select.selectOption({ index: 1 });
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
  await expect(form.getByLabel('Advanced JSON draft')).toHaveCount(0);
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
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates, validates, edits, reloads, and publishes a University without JSON', async ({ page }) => {
    const form = await openCreate(page, 'universities');
    await form.getByRole('button', { name: 'Create draft' }).click();
    await expect(form.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByLabel('Slug', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await form.getByLabel('Name', { exact: true }).fill(universityName);
    await form.getByLabel('Slug', { exact: true }).fill(universitySlug);
    await chooseFirst(form, 'Country');
    await form.getByLabel('Institution type').fill('Fictional demo institution');
    await form.getByLabel('Short summary').fill('Fictional local university for Admin acceptance.');
    await form.getByLabel('Description', { exact: true }).fill('Acceptance Demo University is fictional local test content.');
    await form.getByLabel('SEO title').fill(`${universityName} SEO`);
    await form.getByLabel('Meta description').fill('Fictional local University SEO description.');
    const campuses = form.getByRole('group', { name: 'Campuses' });
    await campuses.getByRole('button', { name: 'Add Campuse' }).click();
    await campuses.getByLabel('name').fill(`${prefix} Campus`);
    await campuses.getByLabel('city').fill('Local City');
    const accreditations = form.getByRole('group', { name: 'Accreditations' });
    await accreditations.getByRole('button', { name: 'Add Accreditation' }).click();
    await accreditations.getByLabel('name').fill('Fictional accreditation');
    const edit = await saveAndOpenEdit(page, 'universities', universityName);
    await expect(edit.getByLabel('Country')).not.toHaveValue('');
    await expect(edit.getByRole('group', { name: 'Campuses' }).getByLabel('city')).toHaveValue('Local City');
    await edit.getByLabel('Short summary').fill('Updated fictional local university summary.');
    const reloaded = await saveEdit(page, 'universities', universityName);
    await expect(reloaded.getByLabel('Short summary')).toHaveValue('Updated fictional local university summary.');
    await publishAndVerify(page, 'universities', universityName, '/universities');
  });

  test('creates, edits, and publishes an Offering with its nested intake and requirements', async ({ page }) => {
    const form = await openCreate(page, 'offerings');
    await form.getByLabel('Name', { exact: true }).fill(offeringName);
    await form.getByLabel('Slug', { exact: true }).fill(offeringSlug);
    await chooseFirst(form, 'University');
    await chooseFirst(form, 'Generic course');
    await chooseFirst(form, 'Course level');
    await chooseFirst(form, 'Campus (optional)');
    await form.getByLabel('Study mode').selectOption({ index: 1 });
    await form.getByLabel('Duration minimum').fill('1');
    await form.getByLabel('Tuition minimum').fill('15000');
    await form.getByLabel('Currency').fill('CAD');
    await form.getByLabel('Short summary').fill('Fictional offering for acceptance.');
    await form.getByLabel('Description', { exact: true }).fill('Fictional offering description.');
    await chooseOne(form, 'Intakes');
    await form.getByLabel(/Deadline for/).fill('2030-09-01');
    const requirements = form.getByRole('group', { name: 'Academic and English-test requirements' });
    await requirements.getByRole('button', { name: 'Add Academic and English-test requirement' }).click();
    await requirements.getByLabel('title').fill('Academic requirement');
    await requirements.getByLabel('description').fill('Fictional academic requirement.');
    await requirements.getByLabel('minimum Score').fill('70');
    const edit = await saveAndOpenEdit(page, 'offerings', offeringName);
    await expect(edit.getByLabel('Tuition minimum')).toHaveValue('15000');
    await expect(
      edit
        .getByRole('group', { name: 'Intakes' })
        .locator('input[type="checkbox"]:checked'),
    ).toHaveCount(1);
    await edit.getByLabel('Tuition minimum').fill('16000');
    const reloaded = await saveEdit(page, 'offerings', offeringName);
    await expect(reloaded.getByLabel('Tuition minimum')).toHaveValue('16000');
    await publishAndVerify(page, 'offerings', offeringName, `/universities/${universitySlug}/courses`);
  });

  test('creates, edits, and publishes a Scholarship with multiple relationships', async ({ page }) => {
    const form = await openCreate(page, 'scholarships');
    await form.getByLabel('Title', { exact: true }).fill(scholarshipTitle);
    await form.getByLabel('Slug', { exact: true }).fill(scholarshipSlug);
    await chooseFirst(form, 'Provider');
    await form.getByLabel('Benefit type').fill('Tuition support');
    await form.getByLabel('Amount').fill('2500');
    await form.getByLabel('Currency').fill('CAD');
    await form.getByLabel('Deadline').fill('2030-10-01');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local scholarship.');
    await form.getByLabel('Eligibility').fill('Fictional acceptance eligibility.');
    await chooseOne(form, 'Eligible countries');
    await chooseOne(form, 'Eligible universities');
    await chooseOne(form, 'Eligible university course offerings');
    const edit = await saveAndOpenEdit(page, 'scholarships', scholarshipTitle);
    await expect(edit.getByRole('group', { name: 'Eligible countries' }).getByRole('checkbox')).toHaveCount(await edit.getByRole('group', { name: 'Eligible countries' }).getByRole('checkbox').count());
    await edit.getByLabel('Amount').fill('3000');
    const reloaded = await saveEdit(page, 'scholarships', scholarshipTitle);
    await expect(reloaded.getByLabel('Amount')).toHaveValue('3000');
    await publishAndVerify(page, 'scholarships', scholarshipTitle, '/scholarships');
  });

  test('creates, edits, and publishes a Consultant with relationship and tag controls', async ({ page }) => {
    const form = await openCreate(page, 'consultants');
    await form.getByLabel('Name', { exact: true }).fill(consultantName);
    await form.getByLabel('Slug', { exact: true }).fill(consultantSlug);
    await form.getByLabel('Email').fill('acceptance-demo@example.invalid');
    await form.getByLabel('Verification state').selectOption('VERIFIED');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local consultant.');
    await chooseOne(form, 'Locations');
    await chooseOne(form, 'Destination countries');
    const services = form.getByRole('group', { name: 'Services' });
    await services.getByLabel('Add Services').fill('Fictional counselling');
    await services.getByRole('button', { name: 'Add' }).click();
    const languages = form.getByRole('group', { name: 'Languages' });
    await languages.getByLabel('Add Languages').fill('English');
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
    await form.getByLabel('Department').fill('Fictional Careers');
    await form.getByLabel('Employment type').fill('FULL_TIME');
    await form.getByLabel('Location').fill('Local');
    await form.getByLabel('Remote state').fill('HYBRID');
    await form.getByLabel('Expiry').fill('2030-12-31');
    await form.getByLabel('Description', { exact: true }).fill('Fictional job description.');
    const edit = await saveAndOpenEdit(page, 'jobs', jobTitle);
    await edit.getByLabel('Department').fill('Updated Fictional Careers');
    const reloaded = await saveEdit(page, 'jobs', jobTitle);
    await expect(reloaded.getByLabel('Department')).toHaveValue('Updated Fictional Careers');
    await publishAndVerify(page, 'jobs', jobTitle, '/careers');
  });

  test('rejects invalid Event date ranges, then creates, edits, and publishes an Event', async ({ page }) => {
    const form = await openCreate(page, 'events');
    await form.getByLabel('Title', { exact: true }).fill(eventTitle);
    await form.getByLabel('Slug', { exact: true }).fill(eventSlug);
    await form.getByLabel('Start date and time').fill('2030-09-02T12:00');
    await form.getByLabel('End date and time').fill('2030-09-01T12:00');
    await form.getByRole('button', { name: 'Create draft' }).click();
    await expect(form.getByText('End date and time must be after the start.')).toBeVisible();
    await form.getByLabel('End date and time').fill('2030-09-02T15:00');
    await form.getByLabel('Event type').selectOption('HYBRID');
    await form.getByLabel('Venue').fill('Fictional local venue');
    await form.getByLabel('Online URL').fill('https://example.invalid/event');
    await form.getByLabel('Description', { exact: true }).fill('Fictional local event.');
    const speakers = form.getByRole('group', { name: 'Speakers' });
    await speakers.getByLabel('Add Speakers').fill('Fictional speaker');
    await speakers.getByRole('button', { name: 'Add' }).click();
    const edit = await saveAndOpenEdit(page, 'events', eventTitle);
    await expect(edit.getByLabel('Event type')).toHaveValue('HYBRID');
    await edit.getByLabel('Venue').fill('Updated fictional venue');
    const reloaded = await saveEdit(page, 'events', eventTitle);
    await expect(reloaded.getByLabel('Venue')).toHaveValue('Updated fictional venue');
    await publishAndVerify(page, 'events', eventTitle, '/events');
  });

  test('creates, edits, and publishes a Success Story and a Testimonial as distinct workflows', async ({ page }) => {
    const story = await openCreate(page, 'success-stories');
    await story.getByLabel('Title', { exact: true }).fill(storyTitle);
    await story.getByLabel('Slug', { exact: true }).fill(storySlug);
    await story.getByLabel('Display attribution').fill('Fictional demo student');
    await story.getByLabel('Journey content').fill('Fictional local journey content.');
    await chooseFirst(story, 'Country (optional)');
    await chooseFirst(story, 'University (optional)');
    const storyEdit = await saveAndOpenEdit(page, 'success-stories', storyTitle);
    await storyEdit.getByLabel('Journey content').fill('Updated fictional local journey content.');
    const storyReloaded = await saveEdit(page, 'success-stories', storyTitle);
    await expect(storyReloaded.getByLabel('Journey content')).toHaveValue('Updated fictional local journey content.');
    await publishAndVerify(page, 'success-stories', storyTitle, '/success-stories');

    const testimonial = await openCreate(page, 'testimonials');
    await testimonial.getByRole('button', { name: 'Create draft' }).click();
    await expect(testimonial.getByLabel('Quote')).toHaveAttribute('aria-invalid', 'true');
    await testimonial.getByLabel('Quote').fill(testimonialQuote);
    await testimonial.getByLabel('Display attribution').fill('Fictional demo attribution');
    await chooseFirst(testimonial, 'University (optional)');
    const testimonialEdit = await saveAndOpenEdit(page, 'testimonials', testimonialQuote.slice(0, 48));
    await testimonialEdit.getByLabel('Quote').fill(`${testimonialQuote} Updated.`);
    const testimonialReloaded = await saveEdit(page, 'testimonials', `${testimonialQuote} Updated.`.slice(0, 48));
    await expect(testimonialReloaded.getByLabel('Quote')).toHaveValue(`${testimonialQuote} Updated.`);
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
});
