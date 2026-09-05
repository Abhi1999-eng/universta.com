import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';
import {
  acceptanceContinentName,
  acceptanceSlugPrefix,
} from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';


test.describe.serial('catalog management', () => {
  test('requires authentication for Countries', async ({ page }) => {
    await page.goto('/countries');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fcountries/);
  });

  test('creates, publishes, unpublishes, and soft-deletes isolated catalog records', async ({ page, request }, testInfo) => {
    // Every invocation of this test gets its own continent/country names, so a
    // partially-created earlier attempt can never make a later one fail on a
    // duplicate before it reaches the assertion that originally failed. This
    // must cover `repeatEachIndex` as well as `retry`: `--repeat-each` leaves
    // `retry` at 0, so keying on retry alone made repeated runs collide on the
    // run-scoped name. Cleanup matches these by prefix, so the suffix stays
    // owned by this run.
    const invocationSuffix = ` ${testInfo.repeatEachIndex}-${testInfo.retry}`;
    const continentName = `${acceptanceContinentName()}${invocationSuffix}`;
    // Country Admin derives identity from local canonical metadata, so choose
    // a real, non-demo country rather than filling no-longer-editable ISO
    // fields. A retry uses a distinct canonical identity in case a failed
    // attempt left its preceding draft behind.
    const countryName =
      ['Belgium', 'Austria', 'Bangladesh', 'China'][
        testInfo.repeatEachIndex * 2 + testInfo.retry
      ] ?? 'Denmark';
    const continentCode = `E${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    let countrySlug = '';

    await loginAsAdmin(page);
    await page.goto('/continents');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/continents$/);
    await expect(page.getByRole('heading', { name: 'Continents', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create continent' })).toBeVisible();
    await page.getByRole('button', { name: 'Create continent' }).click();

    // FieldLabel deliberately renders the red required marker as visible label
    // content. Browser accessible-name whitespace around that nested marker can
    // differ, so use the native required contract for these two mandatory inputs.
    const continentDialog = page.getByRole('dialog');
    const requiredInputs = continentDialog.locator('input[required]');
    await expect(requiredInputs).toHaveCount(2);
    await requiredInputs.nth(0).fill(continentName);
    await requiredInputs.nth(1).fill(continentName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    await continentDialog.getByRole('textbox', { name: 'Code', exact: true }).fill(continentCode);
    await continentDialog.getByRole('button', { name: 'Save continent' }).click();
    await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();

    await page.goto('/countries/new');
    await page.getByLabel('Continent *').selectOption({ label: continentName });
    await page.getByLabel('Country name *').fill(countryName);
    countrySlug = `${acceptanceSlugPrefix()}${countryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`;
    await page.getByLabel('Slug *').fill(countrySlug);
    await page.getByLabel('Page heading *').fill(`Study in ${countryName}`);
    await page.getByLabel('Short description *').fill('An isolated browser E2E catalog record.');

    await expect(page.getByLabel(/ISO alpha-2/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page).toHaveURL(/\/countries\/[a-f0-9-]+$/);

    await expect(page.getByRole('heading', { name: 'Edit country' })).toBeVisible();
    const countryEditorUrl = page.url();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    const publicDraft = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicDraft.status()).toBe(404);

    // Publishing ends the editing session: it returns to the list and confirms
    // there, rather than leaving the operator on a page they are done with.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page).toHaveURL(/\/countries$/);
    await expect(
      page.getByText(`${countryName} published successfully.`, { exact: true }),
    ).toBeVisible();
    const publicPublished = await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`);
    expect(publicPublished.status()).toBe(200);

    // Moving back to draft is mid-session, so it stays put and says so.
    await page.goto(countryEditorUrl);
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Move to draft', exact: true }).click();
    await expect(page.getByText('Country moved to draft.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(countryEditorUrl);
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();
    expect((await request.get(`${apiBaseUrl}/api/v1/countries/${countrySlug}`)).status()).toBe(404);

    // The real Countries list uses Delete (soft delete), not Archive. Filter to
    // the record first so cleanup is independent of first-page ordering.
    await page.goto('/countries');
    await page.getByRole('textbox', { name: 'Search countries' }).fill(countryName);
    const countryRow = page.getByRole('row').filter({ hasText: countryName });
    await expect(countryRow).toBeVisible();
    await countryRow.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteCountryDialog = page.getByRole('dialog');
    await deleteCountryDialog.getByPlaceholder(countryName).fill(countryName);
    await deleteCountryDialog.getByRole('button', { name: 'Delete country', exact: true }).click();
    await expect(page.getByText('Country soft-deleted.', { exact: true })).toBeVisible();

    // Continents also use Delete. Search before acting so list pagination/order
    // cannot hide the acceptance record.
    await page.goto('/continents');
    await page.getByPlaceholder('Search by name, slug or code').fill(continentName);
    const continentRow = page.getByRole('row').filter({ hasText: continentName });
    await expect(continentRow).toBeVisible();
    await continentRow.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteContinentDialog = page.getByRole('dialog');
    await deleteContinentDialog.getByLabel('Confirmation').fill(continentName);
    await deleteContinentDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Continent deleted.', { exact: true })).toBeVisible();
  });

  test('keeps mobile country actions accessible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/countries');
    await expect(page.getByRole('link', { name: 'Create country' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });

  test('recovers safely from an out-of-range lead page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/leads?page=9999');
    await expect(page).not.toHaveURL(/\/login/);

    // The product contract for an out-of-range page is "render a valid empty
    // state", not an error and not a redirect: the API caps `page` at a
    // minimum of 1 with no upper bound, so a high page is a legitimate query
    // that simply matches no rows.
    //
    // Assert the settled state via `data-state` rather than sampling
    // `getByRole('alert')).toHaveCount(0)`. That negative is trivially true
    // while the page is still loading, so it verified nothing and failed only
    // when the poll happened to land after a late error — the definition of a
    // flaky assertion. `toHaveAttribute` auto-waits for the container to
    // reach a terminal state, so this fails only if the real outcome is wrong.
    await expect(page.getByTestId('leads-results')).toHaveAttribute(
      'data-state',
      'empty',
    );
    await expect(page.getByTestId('leads-empty-state')).toBeVisible();
  });
});
