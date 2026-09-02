import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import {
  acceptanceCountryName,
  acceptanceRunId,
  acceptanceSlugPrefix,
} from './helpers/acceptance-run';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';
import { e2eEmail, e2ePassword } from '../playwright.config';

/**
 * The client Country contract, driven the way an operator drives it.
 *
 * The distinction this spec exists to make is between a value being on screen
 * and a value being stored: every group is typed into the real editor, saved,
 * then read back from the server — and finally read a third time from the
 * public API and the public page. A DOM assertion straight after a save would
 * pass on local component state and prove nothing.
 *
 * Records carry this run's ownership marker, so the shared global teardown
 * removes them, including after a run that fails part-way.
 */

const runId = acceptanceRunId();
const COUNTRY_NAME = `${acceptanceCountryName(runId)} Contract`;
const COUNTRY_SLUG = `${acceptanceSlugPrefix(runId)}contract-country`;
const SUBJECT_NAME = `${acceptanceCountryName(runId)} Subject`;
const TAG_NAME = `${acceptanceCountryName(runId)} Tag`;

const TAGLINE = 'Study smarter with Browser Contract.';
const TAGLINE_2 = 'Study smarter, second pass.';
const EXCERPT = 'A distinctive browser acceptance excerpt.';
const OVERVIEW = 'A distinctive browser acceptance overview.';
const CAPITAL = 'Acceptance City';
const LANGUAGE = 'Acceptance English';
const WHY_HEADING = 'Why the browser contract country';
const WHY_BODY = 'A distinctive why-study paragraph for acceptance.';
const VISA_HEADING = 'How the acceptance visa works';
const VISA_BODY = 'A distinctive visa paragraph for acceptance.';
const FAQ_QUESTION = 'Does the browser contract country persist FAQs?';
const FAQ_ANSWER = 'Yes, the first acceptance answer.';
const FAQ_ANSWER_2 = 'Yes, and the second acceptance answer replaced it.';

/** The admin API is Bearer-protected, so the reads that prove persistence need
 * their own token rather than the browser session. */
async function withAdminApi<T>(
  run: (api: APIRequestContext, headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  try {
    const login = await api.post('/api/v1/admin/auth/login', {
      data: { email: e2eEmail, password: e2ePassword },
    });
    const token = ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
    return await run(api, { Authorization: `Bearer ${token}` });
  } finally {
    await api.dispose();
  }
}

type Row = Record<string, unknown>;

async function storedCountry(): Promise<Row> {
  return withAdminApi(async (api, headers) => {
    const response = await api.get(`/api/v1/admin/countries?q=${COUNTRY_SLUG}&limit=5`, { headers });
    const body = (await response.json()) as { data?: Row[] };
    const row = (body.data ?? []).find((item) => item.slug === COUNTRY_SLUG);
    expect(row, 'the fixture country should exist on the server').toBeTruthy();
    return row!;
  });
}

async function storedProfiles(countryId: string) {
  return withAdminApi(async (api, headers) => {
    const response = await api.get(`/api/v1/admin/countries/${countryId}/profiles`, { headers });
    return ((await response.json()) as { data: Record<string, never> }).data as unknown as {
      cost: Row | null;
      work: Row | null;
      language: Row | null;
      statistics: Row | null;
      intakes: Row[];
    };
  });
}

async function putProfile(countryId: string, profile: string, data: Row) {
  return withAdminApi(async (api, headers) => {
    const response = await api.put(
      `/api/v1/admin/countries/${countryId}/profiles/${profile}`,
      { headers, data },
    );
    expect(response.ok(), `${profile} PUT: ${await response.text()}`).toBeTruthy();
    return response;
  });
}

/** Private-use ISO range (QA–QZ): impersonates no real country, and the shared
 * cleanup already reclaims it. */
async function freeIso(): Promise<{ two: string; three: string }> {
  return withAdminApi(async (api, headers) => {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const two = `Q${letter}`;
      const response = await api.get(`/api/v1/admin/countries?q=${two}&limit=50`, { headers });
      const body = (await response.json()) as { data?: Array<{ iso2Code?: string }> };
      if (!(body.data ?? []).some((row) => row.iso2Code === two))
        return { two, three: `${two}Z` };
    }
    throw new Error('No private-use ISO code is free locally');
  });
}

async function publicCountry(page: Page): Promise<Row> {
  const response = await page.request.get(`${apiBaseUrl}/api/v1/countries/${COUNTRY_SLUG}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data?: Row }).data ?? {};
}

async function saveCountry(page: Page) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publishing…' })).toHaveCount(0, {
    timeout: 30_000,
  });
}

async function openCountry(page: Page): Promise<Row> {
  const row = await storedCountry();
  await page.goto(`/countries/${String(row.id)}`);
  await expect(field(page, 'Country name')).toHaveValue(COUNTRY_NAME, { timeout: 30_000 });
  return row;
}

const picker = (page: Page, id: 'country-subjects' | 'country-tags') => page.getByTestId(id);

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Required fields render their label with a trailing asterisk, so an exact
 * label match misses them; anchoring around the marker keeps the locator
 * precise without depending on which fields are currently required. */
function field(scope: Page | Locator, label: string) {
  return scope.getByLabel(new RegExp(`^${escapeRe(label)}\\s*\\*?$`));
}

/** Profile-card selects sit inside a wrapping <label>, whose text absorbs the
 * whole option list, so match the control's accessible name instead. */
function choice(scope: Page | Locator, name: string) {
  return scope.getByRole('combobox', { name, exact: true });
}

/** Same hazard for a textarea: once React seeds it from the server its DOM
 * text content follows the value, which the wrapping label's text then
 * includes. The accessible name stays put. */
function box(scope: Page | Locator, name: string) {
  return scope.getByRole('textbox', { name, exact: true });
}

/** One profile card. Each is its own <section> with a direct <h3>; the wrapper
 * around them is a <section> too, hence the direct-child heading. Scoping to a
 * card is what makes "Source reference" and "Verified on" unambiguous — they
 * appear in four of the five cards. */
function card(page: Page, heading: string) {
  return page
    .getByRole('heading', { level: 3, name: heading, exact: true })
    .locator('xpath=..');
}

/** The label text beside a taxonomy checkbox. */
async function labelOf(box: ReturnType<Page['getByRole']>) {
  return (await box.locator('xpath=..').innerText()).trim();
}

test.describe.serial('country client contract, end to end', () => {
  const health = { console: [] as string[], failed: [] as string[] };

  test.beforeEach(async ({ page }) => {
    page.on('console', (message) => {
      // The browser echoes every failed request here with no URL attached; the
      // response listener below classifies those properly, so keeping them
      // would only duplicate it as unattributable noise.
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
        health.console.push(message.text().slice(0, 160));
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      const expected =
        /favicon|_next\/static/.test(path) ||
        // The console probes for a session on load, so a 401 from the refresh
        // endpoint before sign-in is the expected answer, not a failure.
        (response.status() === 401 && path.endsWith('/auth/refresh')) ||
        // Local media rows point at files that were never written to this
        // machine's disk; that is fixture data, not a fault in the app.
        (response.status() === 404 && /\/media\/[^/]+$/.test(path));
      if (response.status() >= 400 && !expected)
        health.failed.push(`${response.status()} ${path}`);
    });
  });

  test('creates the country with core and identity values', async ({ page }) => {
    await loginAsAdmin(page);
    const iso = await freeIso();
    await page.goto('/countries/new');

    await field(page, 'Continent').selectOption({ index: 1 });
    await field(page, 'Country name').fill(COUNTRY_NAME);
    await field(page, 'Slug').first().fill(COUNTRY_SLUG);
    await field(page, 'Display order').first().fill('37');
    await field(page, 'Page heading').fill(`Study in ${COUNTRY_NAME}`);
    await field(page, 'Short description').first().fill(EXCERPT);
    await field(page, 'Overview').first().fill(OVERVIEW);
    await field(page, 'Tagline').fill(TAGLINE);
    await field(page, 'ISO2').fill(iso.two);
    await field(page, 'ISO3').fill(iso.three);
    await field(page, 'Capital').fill(CAPITAL);
    await field(page, 'Official language').fill(LANGUAGE);
    await field(page, 'Currency code').first().fill('QQQ');
    await field(page, 'Currency name').fill('Acceptance Dollar');

    await saveCountry(page);

    const stored = await storedCountry();
    expect(stored.name).toBe(COUNTRY_NAME);
    expect(stored.tagline).toBe(TAGLINE);
    expect(stored.capitalCity).toBe(CAPITAL);
    expect(stored.officialLanguage).toBe(LANGUAGE);
    expect(stored.displayOrder).toBe(37);
    expect(stored.status).toBe('PUBLISHED');
  });

  test('persists a subject selection and replaces it exactly on a second edit', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    const boxes = picker(page, 'country-subjects').getByRole('checkbox');
    await expect(boxes.nth(3)).toBeVisible({ timeout: 30_000 });

    const chosen: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      chosen.push(await labelOf(boxes.nth(index)));
      await boxes.nth(index).check();
    }
    await saveCountry(page);

    await openCountry(page);
    for (const label of chosen)
      await expect(
        picker(page, 'country-subjects').getByRole('checkbox', { name: label, exact: true }),
      ).toBeChecked();
    expect(((await storedCountry()).subjectIds as string[]).length).toBe(3);

    const removed = chosen[0];
    const added = await labelOf(boxes.nth(3));
    await picker(page, 'country-subjects').getByRole('checkbox', { name: removed, exact: true }).uncheck();
    await boxes.nth(3).check();
    await saveCountry(page);

    await openCountry(page);
    const names = ((await storedCountry()).subjects as Array<{ name: string }>).map((r) => r.name);
    expect(names).toHaveLength(3);
    // The removed subject must not return through any derived path.
    expect(names).not.toContain(removed);
    expect(names).toContain(added);
  });

  test('creates a subject inline without losing unsaved country edits', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    const unsaved = `${TAGLINE} unsaved marker`;
    await field(page, 'Tagline').fill(unsaved);

    await picker(page, 'country-subjects')
      .getByRole('button', { name: '+ Add New Subject' })
      .click();
    const dialog = picker(page, 'country-subjects').getByRole('dialog');
    await dialog.getByLabel('Subject name').fill(SUBJECT_NAME);
    await dialog.getByRole('button', { name: /Create subject/i }).click();

    // The country form never navigated and never submitted.
    await expect(page).toHaveURL(/\/countries\/[^/]+$/);
    await expect(field(page, 'Tagline')).toHaveValue(unsaved);
    await expect(
      picker(page, 'country-subjects').getByRole('checkbox', { name: SUBJECT_NAME, exact: true }),
    ).toBeChecked();

    await field(page, 'Tagline').fill(TAGLINE);
    await saveCountry(page);

    await openCountry(page);
    await expect(
      picker(page, 'country-subjects').getByRole('checkbox', { name: SUBJECT_NAME, exact: true }),
    ).toBeChecked();
    expect(
      ((await storedCountry()).subjects as Array<{ name: string }>).map((r) => r.name),
    ).toContain(SUBJECT_NAME);
  });

  test('persists tags, including one created inline', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    await picker(page, 'country-tags').getByRole('button', { name: '+ Add New Tag' }).click();
    const dialog = picker(page, 'country-tags').getByRole('dialog');
    await dialog.getByLabel('Tag name').fill(TAG_NAME);
    await dialog.getByRole('button', { name: /Create tag/i }).click();
    await expect(
      picker(page, 'country-tags').getByRole('checkbox', { name: TAG_NAME, exact: true }),
    ).toBeChecked();
    await saveCountry(page);

    await openCountry(page);
    await expect(
      picker(page, 'country-tags').getByRole('checkbox', { name: TAG_NAME, exact: true }),
    ).toBeChecked();
    expect(
      ((await storedCountry()).tags as Array<{ name: string }>).map((r) => r.name),
    ).toContain(TAG_NAME);
  });

  test('persists cost, visa and language, and survives a second save', async ({ page }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);
    const saved = () =>
      expect(page.getByRole('status')).toContainText('saved', { timeout: 30_000 });

    const cost = card(page, 'Cost and budget');
    // This one carries a hint, which the label text absorbs with no separator.
    await cost.getByLabel(/^Currency code/).fill('QQQ');
    await field(cost, 'Tuition minimum').fill('9100');
    await field(cost, 'Tuition maximum').fill('15100');
    await field(cost, 'Living cost minimum').fill('710');
    await field(cost, 'Living cost maximum').fill('1110');
    await field(cost, 'Application fee minimum').fill('61');
    await field(cost, 'Application fee maximum').fill('61');
    await field(cost, 'Source reference').fill('https://acceptance.example.invalid/cost');
    await field(cost, 'Verified on').fill('2026-01-02');
    await cost.getByRole('button', { name: 'Save cost and budget' }).click();
    await saved();

    const work = card(page, 'Work and visa');
    await field(work, 'Visa type').fill('Acceptance student permit');
    await field(work, 'Visa processing time').fill('5 to 7 weeks');
    await field(work, 'Visa fee').fill('86');
    await work.getByLabel(/^Visa fee currency/).fill('QQQ');
    await field(work, 'Part-time work allowed during study').check();
    await field(work, 'Work hours per week').fill('21');
    await field(work, 'Post-study work available').check();
    await field(work, 'Post-study work maximum months').fill('25');
    await field(work, 'Visa process').fill('Acceptance visa guidance.');
    await field(work, 'Source reference').fill('https://acceptance.example.invalid/visa');
    await field(work, 'Verified on').fill('2026-01-02');
    await work.getByRole('button', { name: 'Save work and visa' }).click();
    await saved();

    const language = card(page, 'English requirements');
    await choice(language, 'IELTS requirement').selectOption('REQUIRED');
    await field(language, 'IELTS minimum score').fill('6.5');
    await field(language, 'IELTS notes').fill('No band below 6.0.');
    await field(language, 'PTE minimum score').fill('59');
    await field(language, 'Source reference').fill('https://acceptance.example.invalid/lang');
    await field(language, 'Verified on').fill('2026-01-02');
    await language.getByRole('button', { name: 'Save english requirements' }).click();
    await saved();

    const stored = await storedProfiles(countryId);
    expect(String(stored.cost?.tuitionMin)).toBe('9100');
    expect(String(stored.cost?.livingCostMax)).toBe('1110');
    expect(String(stored.cost?.applicationFeeMin)).toBe('61');
    expect(stored.work?.visaType).toBe('Acceptance student permit');
    expect(String(stored.work?.visaFee)).toBe('86');
    expect(stored.work?.visaProcessingTime).toBe('5 to 7 weeks');
    expect(String(stored.work?.partTimeHoursPerWeek)).toBe('21');
    expect(stored.work?.postStudyWorkMaxMonths).toBe(25);
    expect(String(stored.language?.ieltsMinScore)).toBe('6.5');
    expect(String(stored.language?.pteMinScore)).toBe('59');

    // The second save is what used to fail on a stale version token.
    await page.reload();
    await expect(field(card(page, 'Cost and budget'), 'Tuition minimum')).toHaveValue('9100', {
      timeout: 30_000,
    });
    await field(card(page, 'Cost and budget'), 'Tuition minimum').fill('9200');
    await card(page, 'Cost and budget')
      .getByRole('button', { name: 'Save cost and budget' })
      .click();
    await expect(page.getByRole('status')).toContainText('saved', { timeout: 30_000 });
    expect(String((await storedProfiles(countryId)).cost?.tuitionMin)).toBe('9200');
  });

  test('honours the derived-versus-manual rule for the university count', async ({ page }) => {
    const countryId = String((await storedCountry()).id);
    const version = async () => (await storedProfiles(countryId)).statistics?.updatedAt;

    await putProfile(countryId, 'statistics', {
      sourceMode: 'DERIVED',
      universitiesCount: 999,
      internationalStudentsCount: 4321,
      expectedUpdatedAt: await version(),
    });
    let published = await publicCountry(page);
    // Stored, but the mode says keep following the catalogue.
    expect(
      (published.statistics as { universitiesCount: number | null } | null)?.universitiesCount ??
        null,
    ).toBeNull();

    await putProfile(countryId, 'statistics', {
      sourceMode: 'MANUAL',
      universitiesCount: 4242,
      internationalStudentsCount: 4321,
      sourceReference: 'https://acceptance.example.invalid/statistics',
      verifiedAt: '2026-01-02T00:00:00.000Z',
      expectedUpdatedAt: await version(),
    });
    published = await publicCountry(page);
    expect((published.statistics as { universitiesCount: number }).universitiesCount).toBe(4242);

    await putProfile(countryId, 'statistics', {
      sourceMode: 'DERIVED',
      expectedUpdatedAt: await version(),
    });
    published = await publicCountry(page);
    expect(
      (published.statistics as { universitiesCount: number | null } | null)?.universitiesCount ??
        null,
    ).toBeNull();
  });

  test('persists intakes with metadata across two saves', async ({ page }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);
    const intakes = card(page, 'Intakes');
    const boxes = intakes.getByRole('checkbox');
    await expect(boxes.first()).toBeVisible({ timeout: 30_000 });

    await boxes.first().check();
    await intakes.getByRole('checkbox', { name: 'Major intake', exact: true }).first().check();
    await choice(intakes, 'Applications open').first().selectOption('3');
    await choice(intakes, 'Applications close').first().selectOption('6');
    await box(intakes, 'Notes').first().fill('Acceptance intake note.');
    await page.getByRole('button', { name: /^Save intakes$/ }).click();
    await expect(page.getByRole('status')).toContainText('saved', { timeout: 30_000 });

    const first = (await storedProfiles(countryId)).intakes;
    expect(first.length).toBeGreaterThan(0);
    expect(first[0].applicationOpeningMonth).toBe(3);
    expect(first[0].isMajor).toBe(true);
    expect(first[0].notes).toBe('Acceptance intake note.');

    // Second save: the intake token comes from the intake rows, and this is
    // the path that used to conflict on the very first write.
    await page.reload();
    await expect(page.getByRole('button', { name: /^Save intakes$/ })).toBeVisible({
      timeout: 30_000,
    });
    await box(intakes, 'Notes').first().fill('Acceptance intake note, revised.');
    await page.getByRole('button', { name: /^Save intakes$/ }).click();
    await expect(page.getByRole('status')).toContainText('saved', { timeout: 30_000 });
    expect((await storedProfiles(countryId)).intakes[0].notes).toBe(
      'Acceptance intake note, revised.',
    );
  });

  test('attaches a flag image from the media library and publishes it', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    // The picker's caption is a plain span, not a bound label, so scope to the
    // innermost div that carries it.
    const field = page
      .locator('div')
      .filter({ has: page.getByText('Flag image', { exact: true }) })
      .last();
    await field.getByRole('button', { name: /Choose media|Change media/ }).click();

    const dialog = page.getByRole('dialog');
    const first = dialog.locator('div.grid > button').first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    const chosen = await first.locator('img').getAttribute('src');
    expect(chosen).toBeTruthy();
    await first.click();
    await expect(dialog).toHaveCount(0);
    await expect(field.locator('img')).toHaveAttribute('src', chosen!);

    await saveCountry(page);

    await openCountry(page);
    await expect(
      page
        .locator('div')
        .filter({ has: page.getByText('Flag image', { exact: true }) })
        .last()
        .locator('img'),
    ).toHaveAttribute('src', chosen!, { timeout: 30_000 });

    const published = await publicCountry(page);
    expect(published.flag, 'the flag should reach the public payload').toBeTruthy();
    // Same asset, addressed through the public URL rather than the admin one.
    const file = chosen!.split('/').pop();
    expect(String((published.flag as { url: string }).url)).toContain(file!);
  });

  test('persists long-form sections and FAQs, and edits an FAQ a second time', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    // Both keys have to be ones the editor's own vocabulary offers, or the
    // public page could never receive the section.
    await page.getByRole('button', { name: '+ Add section' }).click();
    await field(page, 'Section key').nth(0).selectOption('why-study');
    await field(page, 'Heading').nth(0).fill(WHY_HEADING);
    await page
      .getByRole('textbox', { name: 'Paragraph 1', exact: true })
      .nth(0)
      .fill(WHY_BODY);

    await page.getByRole('button', { name: '+ Add section' }).click();
    await field(page, 'Section key').nth(1).selectOption('visa-process');
    await field(page, 'Heading').nth(1).fill(VISA_HEADING);
    await page
      .getByRole('textbox', { name: 'Paragraph 1', exact: true })
      .nth(1)
      .fill(VISA_BODY);

    await page.getByRole('button', { name: '+ Add FAQ' }).click();
    await field(page, 'Question').first().fill(FAQ_QUESTION);
    await box(page, 'Answer').first().fill(FAQ_ANSWER);

    await saveCountry(page);

    await openCountry(page);
    await expect(field(page, 'Heading').nth(0)).toHaveValue(WHY_HEADING);
    await expect(field(page, 'Question').first()).toHaveValue(FAQ_QUESTION);

    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    for (const value of [WHY_HEADING, WHY_BODY, VISA_HEADING, VISA_BODY, FAQ_QUESTION, FAQ_ANSWER])
      await expect(page.locator('body')).toContainText(value);

    // A second pass over the same records, which is where a stale version
    // token would surface.
    await openCountry(page);
    await box(page, 'Answer').first().fill(FAQ_ANSWER_2);
    await saveCountry(page);

    await openCountry(page);
    await expect(box(page, 'Answer').first()).toHaveValue(FAQ_ANSWER_2);

    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    await expect(page.locator('body')).toContainText(FAQ_ANSWER_2);
    await expect(page.locator('body')).not.toContainText(FAQ_ANSWER);
  });

  test('shows the fixture in the countries list and filters by subject and tag', async ({ page }) => {
    await loginAsAdmin(page);
    const stored = await storedCountry();
    await page.goto('/countries');
    await page.getByPlaceholder('Search countries or ISO code').fill(COUNTRY_SLUG);
    const row = page.getByRole('row').filter({ hasText: COUNTRY_NAME });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText('PUBLISHED');
    await expect(row).toContainText(TAG_NAME);
    await expect(row).not.toContainText('No subjects');

    const assigned = (stored.subjects as Array<{ id: string }>)[0];
    const assignedIds = new Set((stored.subjects as Array<{ id: string }>).map((s) => s.id));
    await page.getByLabel('Filter by subject').selectOption(assigned.id);
    await expect(page.getByRole('row').filter({ hasText: COUNTRY_NAME })).toBeVisible();

    for (const option of await page.getByLabel('Filter by subject').locator('option').all()) {
      const value = await option.getAttribute('value');
      if (value && !assignedIds.has(value)) {
        await page.getByLabel('Filter by subject').selectOption(value);
        await expect(page.getByRole('row').filter({ hasText: COUNTRY_NAME })).toHaveCount(0);
        break;
      }
    }

    await page.getByLabel('Filter by subject').selectOption(assigned.id);
    await page
      .getByLabel('Filter by tag')
      .selectOption((stored.tags as Array<{ id: string }>)[0].id);
    await expect(page.getByRole('row').filter({ hasText: COUNTRY_NAME })).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByPlaceholder('Search countries or ISO code').fill(COUNTRY_SLUG);
    await expect(page.getByRole('row').filter({ hasText: COUNTRY_NAME })).toBeVisible();
  });

  test('publishes the contract through the public API without leaking admin identity', async ({ page }) => {
    const data = await publicCountry(page);
    expect(data.tagline).toBe(TAGLINE);
    expect(data.capitalCity).toBe(CAPITAL);
    expect(data.officialLanguage).toBe(LANGUAGE);
    expect((data.currency as { code: string }).code).toBe('QQQ');
    expect((data.subjects as unknown[]).length).toBeGreaterThan(0);

    const profiles = data.profiles as Record<string, Row | null>;
    expect(String(profiles.cost?.tuitionMin)).toBe('9200');
    expect(profiles.work?.visaType).toBe('Acceptance student permit');
    expect(String(profiles.language?.ieltsMinScore)).toBe('6.5');

    expect(data.externalUid).toBeUndefined();
    expect(data.tagIds).toBeUndefined();
    expect(data.linkedCounts).toBeUndefined();
    // Tags are an Admin, import and filter taxonomy; the public site is never
    // told about them, even though this country carries one.
    expect(data.tags).toBeUndefined();
  });

  test('renders the contract on the public page at three widths', async ({ page }) => {
    // The published payload, not the admin one: a subject created inline is a
    // draft, and the public page is right to leave it out.
    const subjects = (await publicCountry(page)).subjects as Array<{ slug: string }>;
    expect(subjects.length, 'at least one published subject should be linked').toBeGreaterThan(0);
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ] as Array<[number, number]>) {
      await page.setViewportSize({ width, height });
      await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(COUNTRY_NAME);
      const body = page.locator('body');
      for (const value of [
        TAGLINE,
        EXCERPT,
        CAPITAL,
        LANGUAGE,
        'QQQ',
        'Acceptance student permit',
        '5 to 7 weeks',
        'IELTS',
      ])
        await expect(body).toContainText(value);
      for (const subject of subjects)
        await expect(page.locator(`a[href="/subjects/${subject.slug}"]`).first()).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('carries a second admin edit through to the public page', async ({ page }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);

    await field(page, 'Tagline').fill(TAGLINE_2);
    const boxes = picker(page, 'country-subjects').getByRole('checkbox');
    let addedName = '';
    for (let index = 0; index < (await boxes.count()); index += 1) {
      if (!(await boxes.nth(index).isChecked())) {
        addedName = await labelOf(boxes.nth(index));
        await boxes.nth(index).check();
        break;
      }
    }
    await saveCountry(page);

    const current = await storedProfiles(countryId);
    await putProfile(countryId, 'cost', {
      currencyCode: 'QQQ',
      tuitionMin: '9300',
      tuitionMax: '15100',
      sourceReference: 'https://acceptance.example.invalid/cost',
      verifiedAt: '2026-01-02T00:00:00.000Z',
      expectedUpdatedAt: current.cost?.updatedAt,
    });

    // Admin reload proves persistence; the public surface proves it flowed.
    await openCountry(page);
    await expect(field(page, 'Tagline')).toHaveValue(TAGLINE_2);

    const published = await publicCountry(page);
    expect(published.tagline).toBe(TAGLINE_2);
    expect(String((published.profiles as Record<string, Row>).cost?.tuitionMin)).toBe('9300');
    if (addedName)
      expect((published.subjects as Array<{ name: string }>).map((s) => s.name)).toContain(
        addedName,
      );

    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    await expect(page.locator('body')).toContainText(TAGLINE_2);
    await expect(page.locator('body')).toContainText('9,300');
  });

  test('completed without unexplained console or network failures', async () => {
    expect(
      { requests: health.failed, console: health.console },
      'the run should raise no unexplained browser errors',
    ).toEqual({ requests: [], console: [] });
  });
});
