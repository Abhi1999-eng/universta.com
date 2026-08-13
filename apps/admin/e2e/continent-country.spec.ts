import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import {
  acceptanceContinentName,
  acceptanceCountryName,
} from './helpers/acceptance-run';

/**
 * Continent administration as an operator meets it: the slug that fills itself
 * in, the delete that is refused with a reason, and the continent that can be
 * created again after it was deleted — which used to be blocked forever by a
 * database constraint that counted deleted rows.
 *
 * Names carry the acceptance run prefix so the shared cleanup owns everything
 * created here, including anything left behind by a run that failed part-way.
 */

const slugOf = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Opens the create dialog and returns its two required inputs, name first. */
async function openCreateContinent(page: Page) {
  await page.goto('/continents');
  await page.getByRole('button', { name: 'Create continent' }).click();
  const dialog = page.getByRole('dialog');
  const required = dialog.locator('input[required]');
  await expect(required).toHaveCount(2);
  return { dialog, name: required.nth(0), slug: required.nth(1) };
}

async function createContinent(page: Page, continentName: string) {
  const { dialog, name } = await openCreateContinent(page);
  await name.fill(continentName);
  await dialog.getByRole('button', { name: 'Save continent' }).click();
  await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();
}

/** Filters the list to one continent so the assertions do not depend on paging. */
async function findContinent(page: Page, continentName: string) {
  await page.goto('/continents');
  await page.getByPlaceholder('Search by name, slug or code').fill(continentName);
  const row = page.getByRole('row').filter({ hasText: continentName });
  await expect(row).toBeVisible();
  return row;
}

test.describe.serial('continent administration', () => {
  test('fills the slug in from the name and then leaves an edited slug alone', async ({ page }, testInfo) => {
    const base = `${acceptanceContinentName()} Slug ${testInfo.repeatEachIndex}-${testInfo.retry}`;
    await loginAsAdmin(page);
    const { dialog, name, slug } = await openCreateContinent(page);

    await name.fill(base);
    await expect(slug).toHaveValue(slugOf(base));

    // Taking the slug over has to survive further edits to the name.
    const chosen = `${slugOf(base)}-chosen`;
    await slug.fill(chosen);
    await name.fill(`${base} Renamed`);
    await expect(slug).toHaveValue(chosen);

    await dialog.getByRole('button', { name: 'Save continent' }).click();
    await expect(page.getByText('Continent created.', { exact: true })).toBeVisible();
    await expect((await findContinent(page, `${base} Renamed`)).getByText(`/${chosen}`)).toBeVisible();
  });

  test('creates the same continent again after it was deleted', async ({ page }, testInfo) => {
    const continentName = `${acceptanceContinentName()} Recreate ${testInfo.repeatEachIndex}-${testInfo.retry}`;
    await loginAsAdmin(page);
    await createContinent(page, continentName);

    const row = await findContinent(page, continentName);
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirm = page.getByRole('dialog');
    await confirm.getByLabel('Confirmation').fill(continentName);
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Continent deleted.', { exact: true })).toBeVisible();

    // The regression: identical name and slug, and it has to be accepted.
    await createContinent(page, continentName);
    await expect(page.getByText('conflict with an existing record')).toHaveCount(0);

    // Exactly one row, not a resurrected duplicate.
    await page.goto('/continents');
    await page.getByPlaceholder('Search by name, slug or code').fill(continentName);
    await expect(page.getByRole('row').filter({ hasText: continentName })).toHaveCount(1);
  });

  test('adds a continent without leaving the country form, and reuses it instead of duplicating', async ({ page }, testInfo) => {
    const continentName = `${acceptanceContinentName()} Inline ${testInfo.repeatEachIndex}-${testInfo.retry}`;
    await loginAsAdmin(page);
    await page.goto('/countries/new');
    await expect(page.getByRole('heading', { name: 'Create country' })).toBeVisible();

    await page.getByRole('button', { name: '+ Add continent' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Continent name').fill(continentName);
    await expect(dialog.getByLabel('Slug')).toHaveValue(slugOf(continentName));
    await dialog.getByRole('button', { name: 'Add continent' }).click();

    // Created and selected, without losing the country being filled in.
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel('Continent *')).toHaveValue(/.+/);
    const selected = await page.getByLabel('Continent *').inputValue();
    await expect(page.getByLabel('Continent *').locator(`option[value="${selected}"]`)).toHaveText(continentName);

    // Asking for the same continent again selects it rather than making a second.
    await page.getByRole('button', { name: '+ Add continent' }).click();
    await dialog.getByLabel('Continent name').fill(continentName.toUpperCase());
    await dialog.getByRole('button', { name: 'Add continent' }).click();
    await expect(dialog).toBeHidden();
    expect(await page.getByLabel('Continent *').inputValue()).toBe(selected);
    await expect(page.getByLabel('Continent *').locator('option', { hasText: continentName })).toHaveCount(1);
  });

  test('refuses to delete a continent that still has countries, and says which', async ({ page }, testInfo) => {
    const suffix = `Dependency ${testInfo.repeatEachIndex}-${testInfo.retry}`;
    const continentName = `${acceptanceContinentName()} ${suffix}`;
    const countryName = `${acceptanceCountryName()} ${suffix}`;
    await loginAsAdmin(page);
    await createContinent(page, continentName);

    await page.goto('/countries/new');
    await page.getByLabel('Continent *').selectOption({ label: continentName });
    await page.getByLabel('Country name *').fill(countryName);
    await page.getByLabel('Slug *').fill(slugOf(countryName));
    await page.getByLabel('Page heading *').fill(`Study in ${countryName}`);
    await page.getByLabel('Short description *').fill('A browser E2E record for the continent dependency rule.');

    // The private-use QA-QZ range impersonates no real country. Uniqueness is
    // scoped to live rows now, but a concurrent live fixture can still hold a
    // code, so walk the range until one is free.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    let saved = false;
    for (const letter of letters) {
      await page.getByLabel('ISO alpha-2 *').fill(`Q${letter}`);
      await page.getByLabel('ISO alpha-3 *').fill(`Q${letter}Y`);
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      try {
        await expect(page).toHaveURL(/\/countries\/[a-f0-9-]+$/, { timeout: 3_000 });
        saved = true;
        break;
      } catch {
        await expect(
          page.getByText('Country ISO code already exists'),
          'Save draft failed for a reason other than an ISO code clash',
        ).toBeVisible();
      }
    }
    expect(saved, 'every QA-QZ ISO code is already taken locally').toBe(true);

    const row = await findContinent(page, continentName);
    await expect(row.getByText('1', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();

    const blocked = page.getByRole('dialog');
    await expect(blocked.getByRole('heading', { name: 'This continent is still in use' })).toBeVisible();
    await expect(blocked.getByText(countryName)).toBeVisible();
    await expect(blocked.getByRole('link', { name: 'Edit country' })).toBeVisible();
    // It offers a way forward, never a way to delete the countries.
    await expect(blocked.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    await expect(blocked.getByLabel('Confirmation')).toHaveCount(0);

    // Nothing was deleted: the continent and its country are both still there.
    await blocked.getByRole('button', { name: 'Close', exact: true }).click();
    await expect((await findContinent(page, continentName)).getByText('1', { exact: true })).toBeVisible();
  });
});
