import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import {
  acceptanceCountryName,
  acceptanceRunId,
  acceptanceSlugPrefix,
} from './helpers/acceptance-run';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';
import { e2eEmail, e2ePassword } from '../playwright.config';

/**
 * The public Countries page, driven the way a visitor drives it: open the
 * filters, choose, apply, read the results, remove one, reload, clear.
 *
 * Everything is asserted against this run's own destinations, created here and
 * removed by the shared teardown, so the page's real published data can never
 * make a filter look more permissive than it is.
 */
const runId = acceptanceRunId();
const MARK = acceptanceCountryName(runId);
const SLUG = acceptanceSlugPrefix(runId);
const SUBJECT_A = `${MARK} Alpha`;
const SUBJECT_B = `${MARK} Beta`;
const INTAKE_A = `${MARK} Spring`;

async function withAdminApi<T>(
  run: (api: APIRequestContext, headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  try {
    const login = await api.post('/api/v1/admin/auth/login', {
      data: { email: e2eEmail, password: e2ePassword },
    });
    const token = ((await login.json()) as { data: { accessToken: string } }).data
      .accessToken;
    return await run(api, { Authorization: `Bearer ${token}` });
  } finally {
    await api.dispose();
  }
}

/** Private-use ISO range: impersonates no real country. */
async function freeIso(api: APIRequestContext, headers: Record<string, string>) {
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const two = `Q${letter}`;
    const response = await api.get(`/api/v1/admin/countries?q=${two}&limit=50`, {
      headers,
    });
    const body = (await response.json()) as { data?: Array<{ iso2Code?: string }> };
    if (!(body.data ?? []).some((row) => row.iso2Code === two))
      return { two, three: `${two}Z` };
  }
  throw new Error('No private-use ISO code is free locally');
}

const shown = (page: Page) => page.locator('.ccard h3');

async function names(page: Page): Promise<string[]> {
  await expect(page.getByTestId('country-count')).toBeVisible();
  return (await shown(page).allInnerTexts()).map((name) => name.trim());
}

/** Only this run's destinations; the page also lists the real published ones. */
const ours = (all: string[]) => all.filter((name) => name.startsWith(MARK)).sort();

test.describe.serial('public country discovery filters', () => {
  const created: Record<string, string> = {};

  test.beforeAll(async () => {
    await withAdminApi(async (api, headers) => {
      const continents = await api.get('/api/v1/admin/continents?limit=1', {
        headers,
      });
      const continentId = ((await continents.json()) as { data: Array<{ id: string }> })
        .data[0].id;

      const subjectIds: string[] = [];
      for (const name of [SUBJECT_A, SUBJECT_B]) {
        const created = await api.post('/api/v1/admin/subjects', {
          headers,
          data: {
            name,
            slug: `${SLUG}${name.split(' ').pop()!.toLowerCase()}`,
            shortDescription: 'Discovery fixture subject',
          },
        });
        const subject = (await created.json()) as { data: { id: string; updatedAt: string } };
        await api.post(`/api/v1/admin/subjects/${subject.data.id}/publish`, {
          headers,
          data: { expectedUpdatedAt: subject.data.updatedAt },
        });
        subjectIds.push(subject.data.id);
      }

      const intakes = await api.get('/api/v1/admin/intakes', { headers });
      const intakeId = ((await intakes.json()) as { data: Array<{ id: string }> }).data[0]
        ?.id;

      /* Two destinations that differ on exactly the things being filtered. */
      const build = async (
        key: string,
        subjects: string[],
        withIntake: boolean,
        profiles?: { cost?: Record<string, unknown>; work?: Record<string, unknown> },
      ) => {
        const iso = await freeIso(api, headers);
        const response = await api.post('/api/v1/admin/countries', {
          headers,
          data: {
            continentId,
            name: `${MARK} ${key}`,
            slug: `${SLUG}${key.toLowerCase()}`,
            iso2Code: iso.two,
            iso3Code: iso.three,
            pageHeading: `Study in ${key}`,
            shortDescription: `Discovery fixture ${key}`,
            subjectIds: subjects,
          },
        });
        const country = (await response.json()) as {
          data: { id: string; updatedAt: string };
        };
        created[key] = country.data.id;
        if (withIntake && intakeId)
          await api.put(
            `/api/v1/admin/countries/${country.data.id}/profiles/intakes`,
            {
              headers,
              data: {
                intakes: [
                  { intakeId, availabilityStatus: 'AVAILABLE', displayOrder: 0 },
                ],
              },
            },
          );
        for (const [profile, data] of Object.entries(profiles ?? {}))
          await api.put(
            `/api/v1/admin/countries/${country.data.id}/profiles/${profile}`,
            { headers, data },
          );
        const current = await api.get(
          `/api/v1/admin/countries/${country.data.id}`,
          { headers },
        );
        const fresh = (await current.json()) as { data: { updatedAt: string } };
        await api.post(`/api/v1/admin/countries/${country.data.id}/publish`, {
          headers,
          data: { expectedUpdatedAt: fresh.data.updatedAt },
        });
      };

      /* Alphaland carries a sourced budget band; Betaland carries the same
       * plain facts with no source behind them, which is what used to remove
       * it from filters that have nothing to do with verification. */
      await build('Alphaland', [subjectIds[0]], true, {
        cost: {
          currencyCode: 'EUR',
          budgetBand: 'BUDGET_FRIENDLY',
          applicationFeeMin: '0',
          sourceReference: 'https://discovery.example.invalid/source',
          verifiedAt: '2026-01-02',
        },
        work: {
          postStudyWorkAvailable: false,
          sourceReference: 'https://discovery.example.invalid/source',
          verifiedAt: '2026-01-02',
        },
      });
      await build('Betaland', [subjectIds[1]], false, {
        cost: { currencyCode: 'EUR', budgetBand: 'PREMIUM' },
        work: { postStudyWorkAvailable: false },
      });
    });
  });

  test('lists both fixture destinations before any filter', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries?limit=100`);
    expect(ours(await names(page))).toEqual([
      `${MARK} Alphaland`,
      `${MARK} Betaland`,
    ]);
  });

  test('narrows to one destination through the real filter drawer', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Destination filters' });
    await expect(drawer).toBeVisible();

    await drawer.getByLabel('Search subjects').fill(SUBJECT_A);
    await drawer.getByRole('checkbox', { name: new RegExp(SUBJECT_A) }).check();
    await page.getByTestId('country-apply').click();

    await expect(page).toHaveURL(/subjects=/);
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);
    // What narrowed the results is stated, and removable.
    await expect(page.getByTestId('country-chips')).toContainText(SUBJECT_A);
  });

  test('keeps the filter across a reload, because it lives in the URL', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page
      .getByRole('dialog', { name: 'Destination filters' })
      .getByRole('checkbox', { name: new RegExp(SUBJECT_A) })
      .check();
    await page.getByTestId('country-apply').click();
    // Wait for the address to actually change: a reload before the push lands
    // would reload the unfiltered listing and prove nothing.
    await expect(page).toHaveURL(/subjects=/);
    const shared = page.url();

    await page.reload();
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);

    // The same address, opened cold, is the same result.
    await page.goto(shared);
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);
  });

  test('Back and Forward move between the filtered and unfiltered listing', async ({
    page,
  }) => {
    await page.goto(`${webBaseUrl}/countries?limit=100`);
    expect(ours(await names(page)).length).toBe(2);

    await page.getByRole('button', { name: /^Filters/ }).click();
    await page
      .getByRole('dialog', { name: 'Destination filters' })
      .getByRole('checkbox', { name: new RegExp(SUBJECT_A) })
      .check();
    await page.getByTestId('country-apply').click();
    await expect(page).toHaveURL(/subjects=/);
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);

    await page.goBack();
    await expect(page).not.toHaveURL(/subjects=/);
    expect(ours(await names(page)).length).toBe(2);

    await page.goForward();
    await expect(page).toHaveURL(/subjects=/);
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);
  });

  test('removing the chip widens the results again', async ({ page }) => {
    await page.goto(
      `${webBaseUrl}/countries?subjects=${SLUG}alpha&limit=100`,
    );
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);
    await page
      .getByTestId('country-chips')
      .getByRole('button', { name: new RegExp(SUBJECT_A) })
      .click();
    await expect(page).not.toHaveURL(/subjects=/);
    expect(ours(await names(page))).toEqual([
      `${MARK} Alphaland`,
      `${MARK} Betaland`,
    ]);
  });

  test('clear all returns every destination', async ({ page }) => {
    await page.goto(
      `${webBaseUrl}/countries?subjects=${SLUG}alpha&ieltsMax=6.0&limit=100`,
    );
    await page.getByTestId('country-chips').getByRole('button', { name: 'Clear all' }).click();
    await expect(page).toHaveURL(/\/countries$/);
    expect(ours(await names(page))).toEqual([
      `${MARK} Alphaland`,
      `${MARK} Betaland`,
    ]);
  });

  test('says so plainly when a combination matches nothing', async ({ page }) => {
    await page.goto(
      `${webBaseUrl}/countries?subjects=${SLUG}alpha&universitiesMin=5`,
    );
    await expect(page.getByTestId('country-empty')).toContainText(
      /No destinations match these filters/i,
    );
    await expect(page.getByTestId('country-count')).toContainText('of 0');
  });

  test('sorting is deterministic and shareable', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries?limit=100`);
    await page.getByTestId('country-sort').selectOption('universities');
    await expect(page).toHaveURL(/sort=universities/);
    await expect(page.getByTestId('country-count')).toBeVisible();
    // Back to recommended leaves the address clean again.
    await page.getByTestId('country-sort').selectOption('recommended');
    await expect(page).not.toHaveURL(/sort=/);
  });

  test('renders usably at desktop and mobile widths', async ({ page }) => {
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [768, 1024],
      [390, 844],
    ] as Array<[number, number]>) {
      await page.setViewportSize({ width, height });
      await page.goto(`${webBaseUrl}/countries?subjects=${SLUG}alpha`);
      await expect(page.getByTestId('country-chips')).toBeVisible();
      await page.getByRole('button', { name: /^Filters/ }).click();
      await expect(
        page.getByRole('dialog', { name: 'Destination filters' }),
      ).toBeVisible();
      await expect(page.getByTestId('country-apply')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('matches destinations on the canonical budget band', async ({ page }) => {
    // The stored vocabulary and the filter's vocabulary are the same one, so
    // a visible Budget option returns the destination that carries it.
    await page.goto(`${webBaseUrl}/countries?budgetBand=BUDGET_FRIENDLY&limit=100`);
    expect(ours(await names(page))).toEqual([`${MARK} Alphaland`]);
    await page.goto(`${webBaseUrl}/countries?budgetBand=PREMIUM&limit=100`);
    // Betaland publishes PREMIUM with no source, and a band is a rating.
    expect(ours(await names(page))).toEqual([]);
  });

  test('keeps unverified destinations in filters that ask about plain facts', async ({
    page,
  }) => {
    // Neither destination charges an application fee, and neither offers
    // post-study work. Both answers are recorded facts, so a missing source
    // must not remove Betaland from either result.
    await page.goto(`${webBaseUrl}/countries?applicationFee=none&limit=100`);
    expect(ours(await names(page))).toEqual([
      `${MARK} Alphaland`,
      `${MARK} Betaland`,
    ]);
    await page.goto(`${webBaseUrl}/countries?postStudyWork=false&limit=100`);
    expect(ours(await names(page))).toEqual([
      `${MARK} Alphaland`,
      `${MARK} Betaland`,
    ]);
  });

  test('closes the drawer on Escape', async ({ page }) => {
    await page.goto(`${webBaseUrl}/countries`);
    const trigger = page.getByRole('button', { name: /^Filters/ });
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // From inside the drawer, the way a keyboard user would reach for it.
    const drawer = page.getByRole('dialog', { name: 'Destination filters' });
    await drawer.getByLabel('Search subjects').focus();
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
