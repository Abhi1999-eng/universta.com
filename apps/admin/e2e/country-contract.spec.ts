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
const MEDIA_TITLE = `${acceptanceCountryName(runId)} Image`;

/** A 1x1 PNG. Small enough to inline, real enough that the browser renders it
 * rather than reporting a broken image. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

/** The form's own validation summary. The SEO card renders separate alerts,
 * so this must be addressed by its heading rather than by role alone. */
function formIssues(page: Page) {
  return page.getByRole('alert').filter({ hasText: 'Fix these fields:' });
}

async function storedSeo(countryId: string): Promise<Row | null> {
  return withAdminApi(async (api, headers) => {
    const response = await api.get(`/api/v1/admin/countries/${countryId}/seo`, { headers });
    expect(response.ok(), `SEO GET: ${await response.text()}`).toBeTruthy();
    return ((await response.json()) as { data: Row | null }).data;
  });
}

async function storedFaqs(countryId: string): Promise<Row[]> {
  return withAdminApi(async (api, headers) => {
    const response = await api.get(`/api/v1/admin/countries/${countryId}/faqs`, { headers });
    expect(response.ok(), `FAQ GET: ${await response.text()}`).toBeTruthy();
    return ((await response.json()) as { data: Row[] }).data;
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

/**
 * The Media Library is not seeded in CI, and a test that assumes someone else
 * left an image behind is a test that fails on a clean database. This uploads
 * one through the same endpoint the Admin uploader uses, so the picker then
 * lists a genuine, servable asset.
 */
async function ensureMediaFixture(): Promise<void> {
  await withAdminApi(async (api, headers) => {
    const existing = await api.get(
      `/api/v1/admin/media?limit=5&q=${encodeURIComponent(MEDIA_TITLE)}`,
      { headers },
    );
    const rows = ((await existing.json()) as { data?: Array<{ title?: string }> }).data ?? [];
    if (rows.some((row) => row.title === MEDIA_TITLE)) return;

    const created = await api.post('/api/v1/admin/media', {
      headers,
      multipart: {
        file: {
          name: `${acceptanceSlugPrefix(runId)}image.png`,
          mimeType: 'image/png',
          buffer: PNG_BYTES,
        },
        title: MEDIA_TITLE,
        altText: `${MEDIA_TITLE} alt text`,
      },
    });
    expect(created.ok(), `media upload: ${await created.text()}`).toBeTruthy();
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

/**
 * Empties a taxonomy picker through its own UI. Without this a case inherits
 * whatever the country already carried — from an earlier case, a retry, or a
 * previous run against the same fixture — and "exactly three" stops meaning
 * anything.
 */
async function clearSelection(
  page: Page,
  id: 'country-subjects' | 'country-tags',
): Promise<void> {
  const root = picker(page, id);
  await root.getByRole('button', { name: /^Selected \(/ }).click();
  const selected = root.getByRole('checkbox');
  for (let guard = 0; guard < 50; guard += 1) {
    if ((await selected.count()) === 0) break;
    await selected.first().uncheck();
  }
  await expect(root.getByRole('button', { name: 'Selected (0)' })).toBeVisible();
  await root.getByRole('button', { name: 'All', exact: true }).click();
}

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
  /** Rejections a test provokes on purpose. Registered case by case so the
   * guard below still fails on anything unplanned -- blanket-allowing a status
   * would hide the next real one. */
  const intended: Array<{ status: number; match: RegExp }> = [];

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
        (response.status() === 404 && /\/media\/[^/]+$/.test(path)) ||
        intended.some(
          (item) => item.status === response.status() && item.match.test(path),
        );
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

  test('saves Country SEO repeatedly and clears a canonical override', async ({ page }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);
    const seoTitle = `Study in ${COUNTRY_NAME}`;
    const description = 'Acceptance Country SEO description for browser persistence.';
    const uid = `${acceptanceSlugPrefix(runId)}uid`;

    await field(page, 'UID').fill(uid);
    await field(page, 'Tagline').fill(TAGLINE);
    await field(page, 'SEO title').fill(seoTitle);
    await field(page, 'Meta description').fill(description);
    await field(page, 'Canonical URL').fill(`/countries/${COUNTRY_SLUG}`);
    await saveCountry(page);
    expect((await storedSeo(countryId))?.canonicalUrl).toBe(`/countries/${COUNTRY_SLUG}`);

    // Three saves in a row without reloading. Each response carries a new
    // concurrency token, and a form that keeps the token it loaded with has
    // its second save rejected as stale -- which is what silently dropped an
    // operator's SEO edits.
    await field(page, 'Canonical URL').fill('https://example.invalid/acceptance-country');
    await saveCountry(page);
    await field(page, 'Tagline').fill(TAGLINE_2);
    await saveCountry(page);

    const afterThree = await storedSeo(countryId);
    expect(afterThree?.canonicalUrl).toBe('https://example.invalid/acceptance-country');
    expect(afterThree?.seoTitle).toBe(seoTitle);
    expect(afterThree?.metaDescription).toBe(description);
    const identity = await storedCountry();
    expect(identity.externalUid).toBe(uid);
    expect(identity.tagline).toBe(TAGLINE_2);

    // A canonical is free text, so nothing but the form itself stands between
    // these values and the database.
    for (const rejected of ['abc xyz', 'javascript:alert(1)']) {
      await field(page, 'Canonical URL').fill(rejected);
      await saveCountry(page);
      await expect(formIssues(page)).toContainText('Canonical URL');
      expect((await storedSeo(countryId))?.canonicalUrl).toBe(
        'https://example.invalid/acceptance-country',
      );
    }

    // A deliberate blank clears the override rather than being ignored.
    await field(page, 'Canonical URL').fill('');
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect((await storedSeo(countryId))?.canonicalUrl).toBeNull();

    // With no override the page falls back to its own path, and metadata must
    // still publish it as an absolute URL on the configured site origin.
    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${webBaseUrl}/countries/${COUNTRY_SLUG}`,
    );
  });

  test('rejects out-of-range Country identity values in the browser', async ({ page }) => {
    await loginAsAdmin(page);
    const before = await openCountry(page);
    const iso2 = String(before.iso2Code);

    // What an operator actually meets is the browser's own constraint check,
    // so assert that -- and, because a bubble is easy to mistake for a save,
    // assert the stored row is untouched as well.
    const order = field(page, 'Display order').first();
    await order.fill('-1');
    await saveCountry(page);
    expect(await order.evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
    expect((await storedCountry()).displayOrder).toBe(before.displayOrder);

    await order.fill('37');
    const isoField = field(page, 'ISO2');
    await isoField.fill('A1');
    await saveCountry(page);
    expect(await isoField.evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(
      true,
    );
    expect((await storedCountry()).iso2Code).toBe(iso2);

    await isoField.fill(iso2);
    await saveCountry(page);
    const saved = await storedCountry();
    expect(saved.displayOrder).toBe(37);
    expect(saved.iso2Code).toBe(iso2);
  });

  test('persists a subject selection and replaces it exactly on a second edit', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    const boxes = picker(page, 'country-subjects').getByRole('checkbox');
    await expect(boxes.nth(3)).toBeVisible({ timeout: 30_000 });

    // Start from nothing, so "exactly three" is a statement about this case.
    await clearSelection(page, 'country-subjects');
    await saveCountry(page);
    await openCountry(page);
    expect(((await storedCountry()).subjectIds as string[]).length).toBe(0);

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
    const afterFirst = (await storedCountry()).subjects as Array<{ name: string }>;
    expect(afterFirst.map((row) => row.name).sort()).toEqual([...chosen].sort());

    const removed = chosen[0];
    const added = await labelOf(boxes.nth(3));
    await picker(page, 'country-subjects').getByRole('checkbox', { name: removed, exact: true }).uncheck();
    await boxes.nth(3).check();
    await saveCountry(page);

    await openCountry(page);
    const names = ((await storedCountry()).subjects as Array<{ name: string }>).map((r) => r.name);
    // Exactly the replacement set: the two that stayed plus the one added.
    expect(names.sort()).toEqual([...chosen.slice(1), added].sort());
    // The removed subject must not return through any derived path.
    expect(names).not.toContain(removed);
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
    // Out of range: the profiles editor reports this once, above the cards,
    // and must not write the value.
    await field(language, 'IELTS minimum score').fill('10');
    await language.getByRole('button', { name: 'Save english requirements' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'IELTS score must be between 0 and 9' }),
    ).toBeVisible();
    expect((await storedProfiles(countryId)).language?.ieltsMinScore ?? null).not.toBe('10');
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

  test('attaches hero and flag images through the real picker and publishes them', async ({
    page,
  }) => {
    await ensureMediaFixture();
    await loginAsAdmin(page);
    await openCountry(page);

    /* The picker's caption is a plain span, not a bound label, so scope to the
     * innermost div that carries it. */
    const mediaField = (caption: string) =>
      page
        .locator('div')
        .filter({ has: page.getByText(caption, { exact: true }) })
        .last();

    /* Through the dialog every time — searching for this run's own asset rather
     * than trusting whatever happens to sit at the top of the library. */
    async function attach(caption: string): Promise<string> {
      const target = mediaField(caption);
      await target
        .getByRole('button', { name: /Choose media|Change media/ })
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Search media').fill(MEDIA_TITLE);
      await dialog.getByRole('button', { name: 'Search', exact: true }).click();
      const match = dialog
        .locator('div.grid > button')
        .filter({ hasText: MEDIA_TITLE })
        .first();
      await expect(match).toBeVisible({ timeout: 30_000 });
      const src = await match.locator('img').getAttribute('src');
      expect(src, 'the fixture asset should have a URL').toBeTruthy();
      await match.click();
      await expect(dialog).toHaveCount(0);
      await expect(target.locator('img')).toHaveAttribute('src', src!);
      return src!;
    }

    const flagSrc = await attach('Flag image');
    const heroSrc = await attach('Hero image');
    const listingSrc = await attach('Listing image');
    await saveCountry(page);

    await openCountry(page);
    for (const [caption, src] of [
      ['Flag image', flagSrc],
      ['Hero image', heroSrc],
      ['Listing image', listingSrc],
    ] as Array<[string, string]>)
      await expect(mediaField(caption).locator('img')).toHaveAttribute('src', src, {
        timeout: 30_000,
      });

    const published = await publicCountry(page);
    const file = flagSrc.split('/').pop()!;
    expect(published.flag, 'the flag should reach the public payload').toBeTruthy();
    expect(String((published.flag as { url: string }).url)).toContain(file);
    // The client's featured_image and hero_image, both public and both named.
    expect(published.heroImage, 'hero_image should be public').toBeTruthy();
    expect(String((published.heroImage as { url: string }).url)).toContain(file);
    expect(String((published.heroImage as { alt: string }).alt)).toContain(MEDIA_TITLE);
    expect(published.listingImage, 'featured_image should be public').toBeTruthy();
    expect(String((published.listingImage as { url: string }).url)).toContain(file);

    // The public page must actually render the hero, not just carry it.
    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    const hero = page.locator('.hero-media img');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute('src', new RegExp(file));
    expect(
      await hero.evaluate((node: HTMLImageElement) => node.naturalWidth),
      'the hero image should decode, not render broken',
    ).toBeGreaterThan(0);

    // A second save must not quietly clear what the first one attached.
    await openCountry(page);
    await saveCountry(page);
    await openCountry(page);
    for (const [caption, src] of [
      ['Flag image', flagSrc],
      ['Hero image', heroSrc],
      ['Listing image', listingSrc],
    ] as Array<[string, string]>)
      await expect(mediaField(caption).locator('img')).toHaveAttribute('src', src, {
        timeout: 30_000,
      });
    const again = await publicCountry(page);
    expect(again.heroImage, 'hero must survive a second save').toBeTruthy();
    expect(again.listingImage, 'featured must survive a second save').toBeTruthy();
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

  test('saves a Country whose FAQ holds editorial markup, without rewriting it', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);

    // The shape ten published Countries already hold, and that a Country save
    // used to re-send and be rejected for.
    const RICH_ANSWER =
      '<p>Plan for <strong>tuition</strong> and living costs.</p>';
    await box(page, 'Answer').first().fill(RICH_ANSWER);
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect((await storedFaqs(countryId))[0]?.answer).toBe(RICH_ANSWER);

    // A: an unrelated edit to the same Country, with that answer untouched.
    await openCountry(page);
    const before = (await storedFaqs(countryId))[0];
    await field(page, 'Tagline').fill('Tagline edited beside a rich FAQ.');
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect((await storedCountry()).tagline).toBe(
      'Tagline edited beside a rich FAQ.',
    );

    // The untouched FAQ was left alone rather than re-sent: a write would have
    // moved its version token even when the stored value came back identical.
    const after = (await storedFaqs(countryId))[0];
    expect(after.answer).toBe(RICH_ANSWER);
    expect(after.updatedAt).toBe(before.updatedAt);

    // C: and again, because a stale token would only surface on a second pass.
    await openCountry(page);
    await field(page, 'Tagline').fill('Tagline edited a second time.');
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect((await storedFaqs(countryId))[0].updatedAt).toBe(before.updatedAt);

    // B: editing the rich text itself still saves, and reaches the public page
    // as markup rather than as literal tags. The tagline goes back to what the
    // rest of this serial chain expects to find.
    await openCountry(page);
    await field(page, 'Tagline').fill(TAGLINE);
    await box(page, 'Answer').first().fill('<p>Budget for <em>housing</em>.</p>');
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect((await storedFaqs(countryId))[0].answer).toBe(
      '<p>Budget for <em>housing</em>.</p>',
    );

    await page.goto(`${webBaseUrl}/countries/${COUNTRY_SLUG}`);
    await expect(page.locator('body')).toContainText('Budget for housing.');
    await expect(page.locator('body')).not.toContainText('<p>Budget for');
    // The FAQ structured data stays plain text, never markup. Script contents
    // are not visible text, so read them rather than matching on them.
    const faqLd = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).find((block) => block.includes('FAQPage'));
    expect(faqLd, 'the page should publish FAQ structured data').toBeTruthy();
    expect(faqLd ?? '').not.toContain('<p>');
    expect(faqLd ?? '').toContain('Budget for housing.');
  });

  test('recovers from a rejected sub-save without a false stale-version error', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);

    // Both rejections below are the point of this test.
    intended.push(
      { status: 400, match: /\/consultant-cards$/ },
      { status: 409, match: /\/countries\/[0-9a-f-]+$/ },
    );

    await page.getByRole('button', { name: '+ Add guidance card' }).click();
    // Markup in a card title is refused by the server and not by the browser,
    // so the country write lands first and the card write is what fails.
    await field(page, 'Title').last().fill('<p>Rejected title</p>');
    await field(page, 'Slug').last().fill(`${acceptanceSlugPrefix(runId)}card`);
    await field(page, 'Short description').last().fill('Card short description.');
    await field(page, 'CTA URL').last().fill('/counselling');
    await saveCountry(page);
    await expect(page.getByText('Editorial section content is invalid')).toBeVisible();

    // Correct the offending field only -- no reload. The country row was
    // already written, so the form must be holding that newer version token.
    await field(page, 'Title').last().fill('Recovered card');
    await saveCountry(page);
    await expect(
      page.getByText('The country changed in another session. Reload before saving'),
    ).toHaveCount(0);
    await expect(page.getByText('Editorial section content is invalid')).toHaveCount(0);

    const cards = await withAdminApi(async (api, headers) => {
      const response = await api.get(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
        { headers },
      );
      return ((await response.json()) as { data: Row[] }).data;
    });
    expect(cards.some((row) => row.title === 'Recovered card')).toBeTruthy();

    // Genuine concurrency is still refused: another session writes, then this
    // form -- now holding a superseded token -- must be rejected.
    const current = await storedCountry();
    await withAdminApi(async (api, headers) => {
      const response = await api.patch(
        `/api/v1/admin/countries/${countryId}`,
        {
          headers,
          data: {
            continentId: (current.continent as { id: string }).id,
            name: current.name,
            slug: current.slug,
            pageHeading: current.pageHeading,
            shortDescription: current.shortDescription,
            tagline: 'Edited by a second session.',
            expectedUpdatedAt: current.updatedAt,
          },
        },
      );
      expect(response.ok(), `second-session write: ${await response.text()}`).toBeTruthy();
      return null;
    });
    await field(page, 'Capital').fill('Stale City');
    await saveCountry(page);
    await expect(
      page.getByText('The country changed in another session. Reload before saving'),
    ).toBeVisible();

    // Leave the fixture as the rest of this serial chain expects it.
    await openCountry(page);
    await field(page, 'Tagline').fill(TAGLINE);
    await field(page, 'Capital').fill(CAPITAL);
    await saveCountry(page);
  });

  test('clears an optional value instead of silently keeping the old one', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);

    await field(page, 'Capital').fill('Clearable City');
    await saveCountry(page);
    expect((await storedCountry()).capitalCity).toBe('Clearable City');

    // Emptying the field used to report success and change nothing: the blank
    // was dropped from the payload and the API read the missing key as
    // "leave unchanged".
    await field(page, 'Capital').fill('');
    await saveCountry(page);
    expect((await storedCountry()).capitalCity ?? null).toBeNull();
    await openCountry(page);
    await expect(field(page, 'Capital')).toHaveValue('');

    // Leave the fixture as the rest of this serial chain expects it.
    await field(page, 'Capital').fill(CAPITAL);
    await saveCountry(page);
    expect((await storedCountry()).capitalCity).toBe(CAPITAL);
    expect(countryId).toBeTruthy();
  });

  test('publishes a guidance card so it can reach the public page', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);

    await page.getByRole('button', { name: '+ Add guidance card' }).click();
    await field(page, 'Title').last().fill('Published guidance card');
    await field(page, 'Slug').last().fill(`${acceptanceSlugPrefix(runId)}published-card`);
    await field(page, 'Short description').last().fill('Card short description.');
    await field(page, 'CTA URL').last().fill('/counselling');
    // Cards are staged as drafts; without a status control there was no way to
    // ever publish one, so every card built here stayed invisible.
    await choice(page, 'Status').last().selectOption('ACTIVE');
    await saveCountry(page);

    const cards = await withAdminApi(async (api, headers) => {
      const response = await api.get(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
        { headers },
      );
      return ((await response.json()) as { data: Row[] }).data;
    });
    const published = cards.find((row) => row.title === 'Published guidance card');
    expect(published?.status).toBe('ACTIVE');
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
    expect(data.overview).toBe(OVERVIEW);
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
        // The client's `content`, rendered from Country.overview itself.
        OVERVIEW,
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
