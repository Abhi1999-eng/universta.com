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

/** Rewrites the country's first FAQ answer through the API.
 *
 * The markup this test is about arrived that way -- from the importer and from
 * earlier releases -- not by being typed. Typing it into the editor is not the
 * same thing: an editor treats `<p>` as the characters the author pressed and
 * escapes them, which is correct, so the setup has to go where the real data
 * came from. */
async function seedFaqAnswer(countryId: string, faq: Row, answer: string) {
  return withAdminApi(async (api, headers) => {
    const response = await api.patch(
      `/api/v1/admin/countries/${countryId}/faqs/${String(faq.id)}`,
      {
        headers,
        data: {
          question: faq.question,
          answer,
          expectedUpdatedAt: faq.updatedAt,
        },
      },
    );
    expect(response.ok(), `FAQ PATCH: ${await response.text()}`).toBeTruthy();
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

/** Finds a country by the name it was created with, for fixtures whose slug the
 * service derived rather than the test supplying one. */
async function storedByName(name: string): Promise<Row> {
  return withAdminApi(async (api, headers) => {
    const response = await api.get(
      `/api/v1/admin/countries?q=${encodeURIComponent(name)}&limit=5`,
      { headers },
    );
    const body = (await response.json()) as { data?: Row[] };
    const row = (body.data ?? []).find((item) => item.name === name);
    expect(row, `the country named "${name}" should exist on the server`).toBeTruthy();
    return row!;
  });
}

/** Removes a fixture this test created, through the same soft-delete the Admin
 * uses, so the run leaves nothing behind. */
async function deleteCountryById(id: string, expectedUpdatedAt: unknown) {
  await withAdminApi(async (api, headers) => {
    await api.delete(`/api/v1/admin/countries/${id}`, {
      headers: { ...headers, 'content-type': 'application/json' },
      data: { expectedUpdatedAt },
    });
    return null;
  });
}

async function publicCountry(page: Page): Promise<Row> {
  const response = await page.request.get(`${apiBaseUrl}/api/v1/countries/${COUNTRY_SLUG}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data?: Row }).data ?? {};
}

/**
 * Publishing ends the editing session: it returns to the list and confirms
 * there. These tests keep editing the same record across several saves, so
 * this checks the confirmation actually arrived and then steps back into the
 * editor. A save that failed stays put and is left alone here, so the tests
 * that assert a rejection still see the editor they expect.
 */
async function saveCountry(page: Page) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publishing…' })).toHaveCount(0, {
    timeout: 30_000,
  });
  /* The redirect is a client-side push, so it can land after the click has
   * settled. Waiting for the URL rather than reading it once is the difference
   * between stepping back into the editor and stranding the next locator on a
   * list page that arrived a moment too late. */
  const published = await page
    .waitForURL(/\/countries$/, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!published) return;
  await expect(
    page.getByText(`${COUNTRY_NAME} published successfully.`, { exact: true }),
  ).toBeVisible();
  await openCountry(page);
}

/** A WYSIWYG field is a contenteditable region, addressed by its accessible
 * name rather than by a form control. */
/** The rich-text control itself, not the block around it: the editor carries
 * its own accessible name now, and several of these labels are prefixes of a
 * plain input beside them ("Visa process" and "Visa processing time"), so the
 * match has to be exact. */
function richText(scope: Page | Locator, label: string) {
  return scope.getByRole('textbox', { name: label, exact: true });
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
 * card is what keeps a label that several cards share — "Disclaimer" — pointing
 * at the one under test. */
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
  /* Publishing now returns to the list, so every save in this chain carries a
   * confirmation check and a navigation back into the editor. The longer tests
   * here save four or five times and no longer fit the 30s default. */
  test.describe.configure({ timeout: 90_000 });
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

  /**
   * The complete editor is on screen before anything is saved. Profiles and
   * intakes used to be replaced by a "save first" placeholder, so an author
   * could not see what a Country would eventually be asked for -- Publish
   * decides what the public sees, not what the Admin may look at.
   */
  test('shows the whole editor on a country that has not been saved yet', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/countries/new');
    await expect(field(page, 'Country name')).toBeVisible({ timeout: 30_000 });

    for (const heading of [
      'Cost and budget',
      'Work and visa',
      'English requirements',
      'Statistics',
    ])
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
    await expect(page.getByText(/Save this Country first/i)).toHaveCount(0);

    // A profile field is editable, not merely visible.
    await field(page, 'Tuition minimum').fill('9000');
    await expect(field(page, 'Tuition minimum')).toHaveValue('9000');

    /* Curation is the one control that genuinely cannot work yet, so it stays
     * on screen, disabled, and says which action unlocks it. */
    const curation = page.getByRole('group', { name: 'Popular Universities' });
    await expect(curation).toBeVisible();
    await expect(curation.getByText(/Save the country first/i)).toBeVisible();
  });

  test('creates the country with core and identity values', async ({ page }) => {
    await loginAsAdmin(page);
    const iso = await freeIso();
    await page.goto('/countries/new');

    await field(page, 'Continent').selectOption({ index: 1 });
    await field(page, 'Country name').fill(COUNTRY_NAME);
    await field(page, 'Slug').first().fill(COUNTRY_SLUG);
    await field(page, 'Page heading').fill(`Study in ${COUNTRY_NAME}`);
    await richText(page, 'Short description').fill(EXCERPT);
    await richText(page, 'Overview').fill(OVERVIEW);
    await field(page, 'Tagline').fill(TAGLINE);
    await field(page, 'ISO').fill(iso.two);
    await field(page, 'Capital').fill(CAPITAL);
    await field(page, 'Official language').fill(LANGUAGE);
    /* Currency is one choice behind three selectors now, so picking in any of
     * them sets the other two -- a mismatched trio can no longer be typed. */
    await page.getByLabel('Currency code').selectOption('EUR');
    await expect(page.getByLabel('Currency name')).toHaveValue('EUR');
    await expect(page.getByLabel('Currency symbol')).toHaveValue('EUR');

    await saveCountry(page);

    const stored = await storedCountry();
    expect(stored.name).toBe(COUNTRY_NAME);
    expect(stored.tagline).toBe(TAGLINE);
    expect(stored.capitalCity).toBe(CAPITAL);
    expect(stored.officialLanguage).toBe(LANGUAGE);
    /* The admin payload carries the pair as `currency`, and the editable name
     * beside it as `currencyName` -- there is no top-level `currencyCode`. */
    expect((stored.currency as { code: string }).code).toBe('EUR');
    expect(stored.currencyName).toBe('Euro');
    /* Display order is no longer edited here; the stored value is whatever the
     * record already had, and the editor sends it back untouched. */
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
    await field(page, 'Canonical URL').fill(`/study-abroad/${COUNTRY_SLUG}`);
    await saveCountry(page);
    expect((await storedSeo(countryId))?.canonicalUrl).toBe(`/study-abroad/${COUNTRY_SLUG}`);

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
      /* The reason now lives under the canonical field itself; the banner only
       * says how many fields need attention. */
      await expect(page.locator('#seo-canonical-error')).toContainText(
        'site path',
      );
      await expect(formIssues(page)).toContainText('needs attention');
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
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`,
    );
  });

  test('rejects out-of-range Country identity values in the browser', async ({ page }) => {
    await loginAsAdmin(page);
    const before = await openCountry(page);
    const iso2 = String(before.iso2Code);

    // What an operator actually meets is the browser's own constraint check,
    // so assert that -- and, because a bubble is easy to mistake for a save,
    // assert the stored row is untouched as well. Display order has left the
    // editor, so ISO is the remaining constrained identity input.
    const isoField = field(page, 'ISO');
    await isoField.fill('A1');
    await saveCountry(page);
    expect(await isoField.evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(
      true,
    );
    expect((await storedCountry()).iso2Code).toBe(iso2);

    await isoField.fill(iso2);
    await saveCountry(page);
    expect((await storedCountry()).iso2Code).toBe(iso2);
  });

  test('asks only for the country name, and derives the rest', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/countries/new');

    /* The CMS rule: a country somebody has only just named must save. Nothing
     * else is filled in here on purpose. */
    const onlyName = `${acceptanceSlugPrefix(runId)}name only`;
    await field(page, 'Country name').fill(onlyName);
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();

    await expect(page).toHaveURL(/\/countries\/[a-f0-9-]+$/);
    await expect(formIssues(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Edit country' })).toBeVisible();

    // Identity controls that left the editor stay gone.
    await expect(page.getByLabel('Display order')).toHaveCount(0);
    await expect(page.getByLabel(/ISO3/)).toHaveCount(0);
    await expect(page.getByLabel(/ISO2/)).toHaveCount(0);
    await expect(page.getByText('Flag image')).toHaveCount(0);

    // Nothing was author-entered beyond the name.
    const derivedSlug = String((await storedByName(onlyName)).slug);
    expect(derivedSlug).toBeTruthy();
    await expect(field(page, 'Page heading')).toHaveValue('');
    await expect(richText(page, 'Short description')).toHaveText('');
    await expect(field(page, 'ISO')).toHaveValue('');
    await expect(page.getByLabel('Currency code')).toHaveValue('');

    // ISO drives the flag, so a recognised code shows one with nothing uploaded.
    await field(page, 'ISO').fill('MT');
    await expect(page.getByTestId('country-flag-emoji')).toContainText('\u{1F1F2}\u{1F1F9}');
    await field(page, 'ISO').fill('');

    /* Save draft stays put and says so; publish is the horizontal partner. The
     * pair closes the form in normal flow rather than floating over it, so the
     * last field stays reachable and nothing sits under the bar. */
    const actions = page.getByRole('button', { name: 'Publish', exact: true }).locator('xpath=../..');
    await expect(actions).not.toHaveClass(/sticky/);
    // Nothing follows it, and it scrolls away with the rest of the record
    // rather than hovering over the field the operator is filling in.
    expect(
      await actions.evaluate((el) => {
        const form = el.closest('form') as HTMLElement;
        window.scrollTo(0, 0);
        return {
          last: form.lastElementChild === el,
          position: getComputedStyle(el).position,
          onScreenAtTop: el.getBoundingClientRect().top < window.innerHeight,
        };
      }),
    ).toEqual({ last: true, position: 'static', onScreenAtTop: false });

    /* The whole point of the CMS rule: a country that carries nothing but a
     * name has to reach the public site, not merely save. */
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(/\/countries$/);
    await expect(
      page.getByText(`${onlyName} published successfully.`, { exact: true }),
    ).toBeVisible();

    const published = await storedByName(onlyName);
    expect(published.status).toBe('PUBLISHED');
    expect(published.continentId ?? null).toBeNull();
    expect(published.pageHeading ?? null).toBeNull();
    expect(published.shortDescription ?? null).toBeNull();
    expect(published.iso2Code ?? null).toBeNull();
    expect(published.currencyCode ?? null).toBeNull();

    // Discoverable in the admin list...
    await page.getByRole('textbox', { name: 'Search countries' }).fill(onlyName);
    await expect(page.getByRole('row').filter({ hasText: onlyName })).toBeVisible();

    // ...and on the public site, both as a detail page and in the listing.
    const detail = await page.request.get(
      `${apiBaseUrl}/api/v1/countries/${derivedSlug}/page`,
    );
    expect(detail.status()).toBe(200);
    await page.goto(`${webBaseUrl}/study-abroad/${derivedSlug}`);
    await expect(page.locator('h1')).toContainText(onlyName);
    await page.goto(`${webBaseUrl}/study-abroad`);
    /* Scoped to the listing. The route family's header carries a country
       selector that links every destination, and its rows are hidden until it
       is opened -- `.first()` used to resolve to one of those. */
    await expect(
      page.locator(`#directory a[href="/study-abroad/${derivedSlug}"]`),
    ).toBeVisible();

    await deleteCountryById(String(published.id), published.updatedAt);
  });

  /**
   * Subjects are edited here again; Tags still are not. The API replaces both
   * sets on every write, so what matters either way is that a save preserves
   * what is already mapped -- a form that stopped sending them would silently
   * empty every country an operator touched.
   */
  test('edits subjects, leaves tags alone, and clears neither on save', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const country = await openCountry(page);
    const countryId = String(country.id);

    /* Seeded through the API rather than the form, because the form is
     * exactly what no longer does this. Later cases in this file filter the
     * country list by subject and tag, so both are assigned here. */
    const { subjectIds, tagIds } = await withAdminApi(async (api, headers) => {
      const subjectList = await api.get('/api/v1/admin/subjects?limit=3&status=PUBLISHED', {
        headers,
      });
      const subjects = ((await subjectList.json()) as { data?: Row[] }).data ?? [];
      const nextSubjects = subjects.map((row) => String(row.id));
      expect(
        nextSubjects.length,
        'the fixture database should have published subjects',
      ).toBeGreaterThan(0);

      const created = await api.post('/api/v1/admin/country-tags', {
        headers,
        data: { name: TAG_NAME },
      });
      expect(created.ok(), `seed tag: ${await created.text()}`).toBeTruthy();
      const tag = ((await created.json()) as { data: Row }).data;

      const write = await api.patch(`/api/v1/admin/countries/${countryId}`, {
        headers,
        /* The country update is a whole-record write: every identity field
         * left out of it is cleared, not left alone. Seeding only the mappings
         * silently wiped the continent, page heading and short description,
         * and broke every later case in this chain. */
        data: {
          name: country.name,
          continentId: (country.continent as { id: string } | null)?.id,
          slug: country.slug,
          pageHeading: country.pageHeading,
          shortDescription: country.shortDescription,
          tagline: country.tagline,
          iso2Code: country.iso2Code,
          capitalCity: country.capitalCity,
          officialLanguage: country.officialLanguage,
          currencyName: country.currencyName,
          currencyCode: (country.currency as { code: string } | null)?.code,
          currencySymbol: (country.currency as { symbol: string } | null)?.symbol,
          subjectIds: nextSubjects,
          tagIds: [String(tag.id)],
          expectedUpdatedAt: country.updatedAt,
        },
      });
      expect(write.ok(), `seed mappings: ${await write.text()}`).toBeTruthy();
      return { subjectIds: nextSubjects, tagIds: [String(tag.id)] };
    });

    await page.reload();
    await expect(field(page, 'Country name')).toHaveValue(COUNTRY_NAME, { timeout: 30_000 });

    // Subjects are curated here; the country guide publishes them.
    await expect(picker(page, 'country-subjects')).toBeVisible();
    // Tags are not, and nothing was added to put them back.
    await expect(picker(page, 'country-tags')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Add New Tag' })).toHaveCount(0);

    await field(page, 'Tagline').fill(TAGLINE);
    await saveCountry(page);

    const after = await storedCountry();
    /* The picker was not touched, so it sends back what it loaded. Tags were
       never on the form and round-trip untouched, as they always did. */
    expect([...(after.subjectIds as string[])].sort()).toEqual([...subjectIds].sort());
    expect(after.tagIds as string[]).toEqual(tagIds);
  });

  /**
   * Features and accepted English tests are reusable master data. The decision
   * was explicitly that an option added while editing one country becomes
   * available to every other one, so this checks the second country too --
   * a country-local string would pass everything up to that point.
   */
  test('adds a feature that becomes available on every country', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    const featureName = `${acceptanceCountryName(runId)} Feature`;
    const group = page.getByRole('group', { name: 'Features' });
    await group.getByLabel('Add a feature').fill(featureName);
    await group.getByRole('button', { name: 'Add a feature' }).click();

    // Added and selected here without leaving the form.
    await expect(group.getByRole('checkbox', { name: featureName, exact: true })).toBeChecked({
      timeout: 30_000,
    });
    await saveCountry(page);

    await openCountry(page);
    await expect(
      page
        .getByRole('group', { name: 'Features' })
        .getByRole('checkbox', { name: featureName, exact: true }),
    ).toBeChecked();

    // The point of the change: another country is offered the same option.
    const other = await withAdminApi(async (api, headers) => {
      const list = await api.get('/api/v1/admin/countries?limit=5', { headers });
      const rows = ((await list.json()) as { data?: Row[] }).data ?? [];
      const row = rows.find((item) => item.slug !== COUNTRY_SLUG);
      expect(row, 'a second country is needed to prove the option is global').toBeTruthy();
      return row!;
    });
    await page.goto(`/countries/${String(other.id)}`);
    const offered = page
      .getByRole('group', { name: 'Features' })
      .getByRole('checkbox', { name: featureName, exact: true });
    await expect(offered).toBeVisible({ timeout: 30_000 });
    // Offered, not inherited: the other country did not silently gain it.
    await expect(offered).not.toBeChecked();
  });

  test('persists cost, visa and language, and survives a second save', async ({ page }) => {
    await loginAsAdmin(page);
    const countryId = String((await openCountry(page)).id);
    const saved = () =>
      expect(page.getByRole('status')).toContainText('saved', { timeout: 30_000 });

    const cost = card(page, 'Cost and budget');
    /* Cost inherits the Country's currency now: its own code and symbol, the
     * tuition period and the budget band have all left this card. */
    await expect(cost.getByLabel(/^Currency code/)).toHaveCount(0);
    await expect(cost.getByLabel(/^Currency symbol/)).toHaveCount(0);
    await expect(cost.getByLabel(/^Tuition period/)).toHaveCount(0);
    await expect(cost.getByLabel(/^Budget band/)).toHaveCount(0);
    // Living cost period stays, as the requirement asks.
    await expect(cost.getByLabel(/^Living cost period/)).toHaveCount(1);
    await field(cost, 'Tuition minimum').fill('9100');
    await field(cost, 'Tuition maximum').fill('15100');
    await field(cost, 'Living cost minimum').fill('710');
    await field(cost, 'Living cost maximum').fill('1110');
    await field(cost, 'Application fee minimum').fill('61');
    await field(cost, 'Application fee maximum').fill('61');
    await cost.getByRole('button', { name: 'Save cost and budget' }).click();
    await saved();

    const work = card(page, 'Work and visa');
    await field(work, 'Visa type').fill('Acceptance student permit');
    await field(work, 'Visa processing time').fill('5 to 7 weeks');
    await field(work, 'Visa fee').fill('86');
    /* The fee's currency is the Country's, shown here rather than asked for:
     * the field is read-only and already carries the code chosen in the
     * identity section, so the two cannot disagree. */
    const feeCurrency = work.getByLabel(/^Visa fee currency/);
    await expect(feeCurrency).toHaveValue('EUR');
    await expect(feeCurrency).toHaveAttribute('readonly', '');
    await field(work, 'Part-time work allowed during study').check();
    await field(work, 'Work hours per week').fill('21');
    await field(work, 'Post-study work available').check();
    await field(work, 'Post-study work maximum months').fill('25');
    await richText(work, 'Visa process').fill('Acceptance visa guidance.');
    await work.getByRole('button', { name: 'Save work and visa' }).click();
    await saved();
    /* Stored as the Country's currency, not as anything typed on this card --
     * the API derives it, so a client cannot author a mismatch either. */
    expect(
      (await storedProfiles(countryId)).work?.visaFeeCurrencyCode,
    ).toBe('EUR');

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
    await richText(language, 'IELTS notes').fill('No band below 6.0.');
    /* A PTE score is meaningful only when the country asks for, or accepts,
     * PTE. Select that genuine prerequisite rather than depending on whichever
     * default a seed record happened to carry. */
    await choice(language, 'PTE requirement').selectOption('OPTIONAL');
    await field(language, 'PTE minimum score').fill('59');
    await language.getByRole('button', { name: 'Save english requirements' }).click();
    await saved();

    /* The Country source-verification workflow is withdrawn. Every card above
     * saved without either control, and neither is on screen to be filled --
     * asserted across all four cards rather than the three exercised here. */
    for (const heading of [
      'Cost and budget',
      'Work and visa',
      'English requirements',
      'Statistics',
    ]) {
      const section = card(page, heading);
      await expect(section.getByLabel(/^Source reference/)).toHaveCount(0);
      await expect(section.getByLabel(/^Verified on/)).toHaveCount(0);
    }

    const stored = await storedProfiles(countryId);
    expect(String(stored.cost?.tuitionMin)).toBe('9100');
    expect(String(stored.cost?.livingCostMax)).toBe('1110');
    expect(String(stored.cost?.applicationFeeMin)).toBe('61');
    expect(stored.work?.visaType).toBe('Acceptance student permit');
    expect(String(stored.work?.visaFee)).toBe('86');
    expect(stored.work?.visaFeeCurrencyCode).toBe('EUR');
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
    /* The source mode is about the universities count, which the catalogue can
     * count for itself. Nothing counts international students, so that figure
     * is published as authored whichever mode is chosen -- withholding it left
     * the author's number reaching nobody. */
    expect(
      (published.statistics as { internationalStudentsCount: number | null } | null)
        ?.internationalStudentsCount ?? null,
    ).toBe(4321);

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

  test('authors intakes once, as the twelve-month selection', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    /* The intake module's per-country card has left this editor. A Country
     * states its intakes as months, in one place, and that is what the public
     * page reads. */
    await expect(page.getByRole('heading', { name: /^Intakes$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Save intakes$/ })).toHaveCount(0);

    const months = page.getByRole('group', { name: 'Available intake months' });
    await expect(months.getByRole('checkbox')).toHaveCount(12);
    await months.getByRole('checkbox', { name: 'February', exact: true }).check();
    await months.getByRole('checkbox', { name: 'July', exact: true }).check();
    await saveCountry(page);

    await openCountry(page);
    const savedMonths = page.getByRole('group', {
      name: 'Available intake months',
    });
    await expect(
      savedMonths.getByRole('checkbox', { name: 'February', exact: true }),
    ).toBeChecked();
    await expect(
      savedMonths.getByRole('checkbox', { name: 'July', exact: true }),
    ).toBeChecked();
    expect(
      ((await storedCountry()).configuration as { intakeMonths: number[] }).intakeMonths,
    ).toEqual([2, 7]);

    // And the published page states them once, from that selection.
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.locator('#intakes')).toContainText('February');
    await expect(page.locator('#intakes')).toContainText('July');
  });

  /* The documents a student needs in hand. Suggested so an author starts from
   * a click, but nothing is stored until they add it -- and a destination that
   * asks for something else adds its own. */
  test('lists the documents required to study here, and publishes them', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    // Exact: "+ Passport" is a prefix of "+ Passport-size photographs".
    await page.getByRole('button', { name: '+ Passport', exact: true }).click();
    await page.getByRole('button', { name: '+ Add document' }).click();
    const names = field(page, 'Document name');
    await names.last().fill('Acceptance police clearance');
    await richText(page, 'Details 2').fill('Issued within six months.');
    /* The custom one is not compulsory. Matched as a checkbox by its exact
     * name: the language card's requirement selects carry "required" in their
     * options and a loose label match reaches them instead. */
    await page
      .getByRole('checkbox', { name: 'Required', exact: true })
      .last()
      .uncheck();
    await saveCountry(page);

    await openCountry(page);
    await expect(field(page, 'Document name').first()).toHaveValue('Passport');
    await expect(field(page, 'Document name').last()).toHaveValue(
      'Acceptance police clearance',
    );

    const stored = (await storedCountry()).documents as Array<Record<string, unknown>>;
    expect(stored.map((row) => row.name)).toEqual([
      'Passport',
      'Acceptance police clearance',
    ]);
    expect(stored[1].isRequired).toBe(false);
    expect(String(stored[1].details)).toContain('Issued within six months.');

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    const documents = page.locator('#documents');
    await expect(documents).toContainText('Documents required to study in');
    await expect(documents).toContainText('Passport');
    await expect(documents).toContainText('Issued within six months.');
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

    /* The flag is derived from the ISO code now, so there is no flag uploader
     * to attach to -- hero and listing are the remaining media fields. */
    await expect(page.getByText('Flag image')).toHaveCount(0);
    const heroSrc = await attach('Hero image');
    const listingSrc = await attach('Listing image');
    await saveCountry(page);

    await openCountry(page);
    for (const [caption, src] of [
      ['Hero image', heroSrc],
      ['Listing image', listingSrc],
    ] as Array<[string, string]>)
      await expect(mediaField(caption).locator('img')).toHaveAttribute('src', src, {
        timeout: 30_000,
      });

    const published = await publicCountry(page);
    const file = heroSrc.split('/').pop()!;
    /* Flag media is no longer attached from this editor. Any flag a country
     * already carries stays on the record and still reaches the public
     * payload -- it is simply not set here any more. */
    // The client's featured_image and hero_image, both public and both named.
    expect(published.heroImage, 'hero_image should be public').toBeTruthy();
    expect(String((published.heroImage as { url: string }).url)).toContain(file);
    expect(String((published.heroImage as { alt: string }).alt)).toContain(MEDIA_TITLE);
    expect(published.listingImage, 'featured_image should be public').toBeTruthy();
    expect(String((published.listingImage as { url: string }).url)).toContain(file);

    /* The approved Study Abroad guide has no hero image slot -- its hero is the
     * country's colour bands and snapshot panel -- so the image is asserted on
     * the record and the public payload above, and the guide only has to render
     * without it. */
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(COUNTRY_NAME);

    // A second save must not quietly clear what the first one attached.
    await openCountry(page);
    await saveCountry(page);
    await openCountry(page);
    for (const [caption, src] of [
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
    /* The key is typed now, not chosen: the public page still has a dedicated
     * renderer for this one, and an invented key falls back to the section
     * type. */
    await field(page, 'Section key').nth(0).fill('why-study');
    await field(page, 'Heading').nth(0).fill(WHY_HEADING);
    await page
      .getByRole('textbox', { name: 'Paragraph 1', exact: true })
      .nth(0)
      .fill(WHY_BODY);

    await page.getByRole('button', { name: '+ Add section' }).click();
    await field(page, 'Section key').nth(1).fill('visa-process');
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

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    for (const value of [WHY_HEADING, WHY_BODY, VISA_HEADING, VISA_BODY, FAQ_QUESTION, FAQ_ANSWER])
      await expect(page.locator('body')).toContainText(value);

    // A second pass over the same records, which is where a stale version
    // token would surface.
    await openCountry(page);
    await box(page, 'Answer').first().fill(FAQ_ANSWER_2);
    await saveCountry(page);

    await openCountry(page);
    /* The answer is a rich-text control, so it holds text rather than an
     * input value. */
    await expect(box(page, 'Answer').first()).toHaveText(FAQ_ANSWER_2);

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.locator('body')).toContainText(FAQ_ANSWER_2);
    await expect(page.locator('body')).not.toContainText(FAQ_ANSWER);
  });

  /* Section keys are author-written now. One the public page has no dedicated
   * renderer for still has to save, reload and reach the page -- falling back
   * to the section type -- and still has to anchor. */
  test('accepts a section key nobody predefined, and publishes it', async ({ page }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    const customKey = `${acceptanceSlugPrefix(runId)}invented`;
    const heading = 'An invented section';
    const bodyText = 'Written under a key nobody listed.';

    await page.getByRole('button', { name: /add section/i }).click();
    const key = field(page, 'Section key').last();
    await expect(key).toHaveValue('');
    await key.fill(customKey);
    await field(page, 'Heading').last().fill(heading);
    await page
      .getByRole('textbox', { name: /^Paragraph 1$/ })
      .last()
      .fill(bodyText);
    await saveCountry(page);

    // Reloaded into the editor exactly as typed.
    await openCountry(page);
    await expect(field(page, 'Section key').last()).toHaveValue(customKey);

    /* The published page is unaffected. It renders four designated long-form
     * keys by contract -- a section under any other key, invented or one of
     * the conventional ones it does not list, has never appeared there, and
     * storing one must not disturb what does. */
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.locator('h1')).toContainText(COUNTRY_NAME);
    await expect(page.locator('body')).toContainText(WHY_HEADING);
    await expect(page.locator('body')).toContainText(VISA_HEADING);
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
    await seedFaqAnswer(countryId, (await storedFaqs(countryId))[0], RICH_ANSWER);
    await openCountry(page);
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
    /* Typed as prose, because that is what an author does; the editor is what
     * turns it into the stored paragraph. */
    await box(page, 'Answer').first().fill('Budget for housing.');
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);
    expect(String((await storedFaqs(countryId))[0].answer)).toContain(
      'Budget for housing.',
    );

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
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
    await choice(page, 'Status').last().selectOption('PUBLISHED');
    await saveCountry(page);

    const cards = await withAdminApi(async (api, headers) => {
      const response = await api.get(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
        { headers },
      );
      return ((await response.json()) as { data: Row[] }).data;
    });
    const published = cards.find((row) => row.title === 'Published guidance card');
    expect(published?.status).toBe('PUBLISHED');

    /* The status only matters if it actually opens the public gate: cards are
     * filtered on PUBLISHED there, while sections and FAQs use ACTIVE, so a
     * plausible-looking ACTIVE left the card invisible. */
    const publicCards = await withAdminApi(async (api) => {
      const response = await api.get(`/api/v1/countries/${COUNTRY_SLUG}/page`);
      const payload = (await response.json()) as {
        data?: { consultantCards?: Row[] };
      };
      return payload.data?.consultantCards ?? [];
    });
    expect(
      publicCards.some((row) => row.title === 'Published guidance card'),
    ).toBeTruthy();
  });

  test('explains a bad value under the field, and clears it once corrected', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await openCountry(page);

    /* The complaint has to arrive when the operator leaves the field, next to
     * the field -- not as a banner at the top of a long form after Save. ISO3
     * has left the editor, so ISO carries this behaviour now. */
    const iso = field(page, 'ISO');
    const original = String(await iso.inputValue());
    await iso.fill('M');
    await field(page, 'Capital').click();
    const message = page.getByText('ISO must be exactly 2 letters, like MT.');
    await expect(message).toBeVisible();

    // Correcting it clears the message without needing a save.
    await iso.fill('MT');
    await field(page, 'Capital').click();
    await expect(message).toHaveCount(0);

    await iso.fill(original);
    await field(page, 'Capital').click();
  });

  test('blocks the save and focuses the first field that needs attention', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await openCountry(page);

    await field(page, 'Country name').fill('');
    let sent = false;
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        /\/api\/v1\/admin\/countries\/[0-9a-f-]+$/.test(
          new URL(request.url()).pathname,
        )
      )
        sent = true;
    });
    await saveCountry(page);

    await expect(page.getByText('Country name is required.')).toBeVisible();
    // Nothing should reach the server while the form knows it is invalid.
    expect(sent).toBeFalsy();
    // ...and the operator is put on the field to fix.
    await expect(page.locator('[data-field="name"]')).toBeFocused();
    // The record is untouched.
    expect((await storedCountry()).name).toBe(before.name);

    await field(page, 'Country name').fill(String(before.name));
    await saveCountry(page);
  });

  test('shows the fixture in the countries list and filters by subject and tag', async ({ page }) => {
    await loginAsAdmin(page);
    const stored = await storedCountry();
    await page.goto('/countries');
    await page.getByPlaceholder('Search countries or ISO code').fill(COUNTRY_SLUG);
    const row = page.getByRole('row').filter({ hasText: COUNTRY_NAME });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText('PUBLISHED');
    /* Tags left the list so the row actions fit on screen without a sideways
     * scroll; the tag filter below still proves the assignment, and the row's
     * own actions are reachable where they belong. */
    await expect(row).not.toContainText(TAG_NAME);
    await expect(row.getByRole('link', { name: 'Edit' })).toBeVisible();
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
    /* Overview is authored in the WYSIWYG, so the public payload carries the
     * paragraph the editor produced rather than the bare sentence typed in. */
    expect(String(data.overview)).toContain(OVERVIEW);
    expect(String(data.overview)).toMatch(/^<p>/);
    expect(data.capitalCity).toBe(CAPITAL);
    expect(data.officialLanguage).toBe(LANGUAGE);
    /* The editor picks a currency from the linked selectors now, so the
     * country carries a real ISO code rather than a placeholder. */
    expect((data.currency as { code: string }).code).toBe('EUR');
    /* The visa fee is published in the Country's currency, so the page never
     * prints a fee in one unit beside a country stated in another. */
    expect(
      ((data.profiles as Record<string, Row>).work ?? {}).visaFeeCurrencyCode,
    ).toBe('EUR');
    expect((data.currency as { symbol: string }).symbol).toBe('\u20AC');
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
      await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(COUNTRY_NAME);
      const body = page.locator('body');
      for (const value of [
        TAGLINE,
        EXCERPT,
        // The client's `content`, rendered from Country.overview itself.
        OVERVIEW,
        CAPITAL,
        LANGUAGE,
        // Cost inherits the country's currency; the guide shows its symbol.
        '€',
        'Acceptance student permit',
        '5 to 7 weeks',
        'IELTS',
      ])
        await expect(body).toContainText(value);

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

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.locator('body')).toContainText(TAGLINE_2);
    await expect(page.locator('body')).toContainText('9,300');
  });

  /* The budget calculator is the one country figure the Study Abroad guide
   * varies interactively, and the only new control this integration added to
   * the Country editor. Authored as JSON because that is the shape of the
   * document; what matters is that a bad one is refused where the author can
   * see it, and a good one reaches the guide and computes. */
  test('configures the budget calculator, and the guide computes with it', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await openCountry(page);
    const calculator = page.getByRole('textbox', { name: /^Budget calculator/ });

    await calculator.fill('{ "base": ');
    await expect(page.getByText('This is not valid JSON yet.')).toBeVisible();
    await calculator.fill('{ "base": { "livingMin": 900 } }');
    await expect(page.getByText('Missing the `factors` list.')).toBeVisible();

    const config = {
      base: { livingMin: 900, livingMax: 1100, insurance: 100, semesterFee: 200 },
      factors: [
        {
          id: 'city',
          label: 'Where you live',
          options: [
            { value: 'small', label: 'Smaller city', mult: 1 },
            { value: 'capital', label: 'Capital', mult: 2 },
          ],
        },
        {
          id: 'programme',
          label: 'Programme',
          options: [{ value: 'public', label: 'Public university', tuitionMin: 0, tuitionMax: 1000 }],
        },
      ],
    };
    await calculator.fill(JSON.stringify(config, null, 2));
    await saveCountry(page);
    await expect(formIssues(page)).toHaveCount(0);

    // Reloaded into the editor, and published to the public payload.
    await openCountry(page);
    await expect(calculator).toContainText('"livingMin": 900');
    const configuration = (await publicCountry(page)).configuration as {
      calculator?: { base?: { livingMin?: number } };
    };
    expect(configuration?.calculator?.base?.livingMin).toBe(900);

    /* Living is (900 + 100) x 12 = 12,000 a year, fees are the semester fee
     * twice, so the cheapest year is 12,400 -- and the capital doubles the
     * living half of it. */
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    const total = page.getByTestId('calc-total');
    await expect(total).toContainText('12,400');
    await page
      .locator('[data-factor="city"]')
      .getByRole('button', { name: 'Capital' })
      .click();
    await expect(total).toContainText('24,400');

    // Cleared again, the guide simply has no calculator rather than an empty one.
    await openCountry(page);
    await calculator.fill('');
    await saveCountry(page);
    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);
    await expect(page.getByTestId('cost-calculator')).toHaveCount(0);
  });

  /**
   * Every figure the profile editor asks for, on the published guide.
   *
   * The cards above prove a value is stored. This proves it is *shown*: each
   * profile is authored through the same endpoint the editor posts to, then the
   * public page is read and every one of those values looked for in the section
   * that is supposed to carry it. Four of them reached nowhere before this --
   * the holiday work hours, the work disclaimer, the language disclaimer and
   * the international students count -- and an author had no way to tell.
   */
  test('shows every authored cost, work and language figure on the guide', async ({
    page,
  }) => {
    const countryId = String((await storedCountry()).id);
    const version = async (profile: 'cost' | 'work' | 'language' | 'statistics') =>
      (await storedProfiles(countryId))[profile]?.updatedAt;

    /* Decimal columns cross the wire as strings -- the editor posts what was
       typed and the API parses it -- while whole-month counts are integers.
       A number sent for a decimal is refused outright. */
    await putProfile(countryId, 'cost', {
      tuitionMin: '9200',
      tuitionMax: '15100',
      livingCostMin: '710',
      livingCostMax: '1110',
      livingCostPeriod: 'PER_MONTH',
      applicationFeeMin: '61',
      applicationFeeMax: '61',
      tuitionNotes: '<p>Acceptance tuition is charged per year.</p>',
      livingCostNotes: '<p>Acceptance rent is the larger half.</p>',
      disclaimer: '<p>Acceptance costs are indicative only.</p>',
      expectedUpdatedAt: await version('cost'),
    });

    await putProfile(countryId, 'work', {
      visaType: 'Acceptance student permit',
      visaProcessingTime: '5 to 7 weeks',
      visaFee: '86',
      partTimeAllowed: true,
      partTimeHoursPerWeek: '21',
      partTimeHoursDuringBreaks: '40',
      partTimeSummary: '<p>Acceptance term-time work needs no separate permit.</p>',
      postStudyWorkAvailable: true,
      postStudyWorkMinMonths: 12,
      postStudyWorkMaxMonths: 25,
      postStudyWorkSummary: '<p>Acceptance graduates apply before the visa lapses.</p>',
      immigrationPathwayStrength: 'STRONG',
      immigrationPathwaySummary: '<p>Acceptance residency follows two years of work.</p>',
      visaInformation: '<p>Acceptance visa guidance in full.</p>',
      proofOfFundsSummary: '<p>Acceptance funds are shown in a blocked account.</p>',
      disclaimer: '<p>Acceptance visa rules change; check with the embassy.</p>',
      expectedUpdatedAt: await version('work'),
    });

    await putProfile(countryId, 'language', {
      ieltsRequirement: 'REQUIRED',
      ieltsMinScore: '6.5',
      ieltsNotes: '<p>Acceptance IELTS bands stay above six.</p>',
      toeflRequirement: 'OPTIONAL',
      toeflMinScore: '88',
      toeflNotes: '<p>Acceptance TOEFL is accepted in place of IELTS.</p>',
      pteRequirement: 'OPTIONAL',
      pteMinScore: '59',
      pteNotes: '<p>Acceptance PTE suits a later application.</p>',
      duolingoRequirement: 'VARIES',
      duolingoMinScore: '115',
      duolingoNotes: '<p>Acceptance Duolingo depends on the programme.</p>',
      languageWaiverAvailable: true,
      waiverNotes: '<p>Acceptance waivers follow an English-taught degree.</p>',
      generalNotes: '<p>Acceptance scores are no older than two years.</p>',
      disclaimer: '<p>Acceptance language rules are set by each university.</p>',
      expectedUpdatedAt: await version('language'),
    });

    /* DERIVED, deliberately: the universities count then follows the catalogue,
     * and the international students figure -- which nothing derives -- has to
     * be published anyway or the author's number reaches no one. */
    await putProfile(countryId, 'statistics', {
      sourceMode: 'DERIVED',
      internationalStudentsCount: 416000,
      expectedUpdatedAt: await version('statistics'),
    });

    await page.goto(`${webBaseUrl}/study-abroad/${COUNTRY_SLUG}`);

    const cost = page.locator('#cost');
    await expect(cost).toContainText('€9,200 – €15,100');
    await expect(cost).toContainText('€710 – €1,110');
    await expect(cost).toContainText('€61');
    // Tuition a year plus living twelve times over, as the total the box states.
    await expect(cost).toContainText('€17,720 – €28,420');
    await expect(cost).toContainText('Acceptance tuition is charged per year.');
    await expect(cost).toContainText('Acceptance rent is the larger half.');
    await expect(cost).toContainText('Acceptance costs are indicative only.');
    await expect(cost).toContainText('Acceptance funds are shown in a blocked account.');

    const language = page.locator('#language');
    for (const line of [
      'IELTS Academic',
      '6.5',
      'Acceptance IELTS bands stay above six.',
      'TOEFL iBT',
      '88',
      'Acceptance TOEFL is accepted in place of IELTS.',
      'PTE Academic',
      '59',
      'Acceptance PTE suits a later application.',
      'Duolingo English Test',
      '115',
      'Acceptance Duolingo depends on the programme.',
      'Acceptance waivers follow an English-taught degree.',
      'Acceptance scores are no older than two years.',
      'Acceptance language rules are set by each university.',
    ])
      await expect(language).toContainText(line);

    const visa = page.locator('#work-visa');
    for (const line of [
      'Acceptance student permit · 5 to 7 weeks processing',
      'Acceptance visa guidance in full.',
      '21 hours a week · 40 in breaks',
      'Acceptance term-time work needs no separate permit.',
      '25 months',
      'Acceptance graduates apply before the visa lapses.',
      'strong pathway',
      'Acceptance residency follows two years of work.',
      '€86',
      'Acceptance visa rules change; check with the embassy.',
    ])
      await expect(visa).toContainText(line);

    await expect(page.locator('#numbers')).toContainText('416,000');
    await expect(page.locator('#numbers')).toContainText('International students');
  });

  test('completed without unexplained console or network failures', async () => {
    expect(
      { requests: health.failed, console: health.console },
      'the run should raise no unexplained browser errors',
    ).toEqual({ requests: [], console: [] });
  });
});
