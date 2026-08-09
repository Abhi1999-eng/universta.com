import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

/** The Add Section library is the admin's entry point into the builder, so it
 * has to offer plain-language choices and never a raw type name. */
test.describe('add section library', () => {
  test('offers plain-language sections and adds the chosen one', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/phase1/pages');
    const row = page.getByRole('row').filter({ hasText: 'Home' }).first();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();

    await page.getByRole('button', { name: 'Add section', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Add a section' });
    await expect(library).toBeVisible();

    // Described by what they do, not by their stored type.
    await expect(library.getByText('Questions and answers')).toBeVisible();
    await expect(library.getByText('Countries')).toBeVisible();
    await expect(library.getByText('FAQ_GROUP')).toHaveCount(0);
    await expect(library.getByText('COUNTRY_DIRECTORY')).toHaveCount(0);

    // Types the public site cannot render must not be offered.
    await expect(library.getByText('Hero', { exact: true })).toHaveCount(0);
    await expect(library.getByText('Custom', { exact: true })).toHaveCount(0);

    await library.getByPlaceholder('Try “countries” or “questions”').fill('questions');
    await expect(library.getByText('Questions and answers')).toBeVisible();
    await expect(library.getByText('Cards', { exact: true })).toHaveCount(0);

    await library.getByTestId('add-section-FAQ_GROUP').click();
    await expect(library).toHaveCount(0);
    // Added pre-filled from the registry's defaults, not blank.
    await expect(
      page.getByLabel('Heading', { exact: true }).last(),
    ).toHaveValue('Frequently asked questions');
  });
});
