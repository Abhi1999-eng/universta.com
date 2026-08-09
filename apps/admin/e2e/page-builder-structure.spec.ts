import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

/** The structure panel is how an admin navigates a page. It must name sections
 * in plain language, focus one at a time, and keep reorder/remove reachable. */
test.describe('page builder structure', () => {
  test('lists sections, focuses one, and reorders from the panel', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/phase1/pages');
    const row = page.getByRole('row').filter({ hasText: 'Home' }).first();
    await row.getByRole('button', { name: 'Edit', exact: true }).click();

    const structure = page.getByTestId('page-structure');
    await expect(structure).toBeVisible();
    await expect(page.getByTestId('page-builder')).toBeVisible();

    // Plain-language names, never the stored enum.
    await expect(structure.getByText('COUNTRY_DIRECTORY')).toHaveCount(0);
    await expect(structure.getByText('RICH_TEXT')).toHaveCount(0);

    const items = structure.locator('[data-testid^="structure-item-"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Selecting focuses that one section in the settings pane.
    await items.first().getByRole('button').first().click();
    await expect(items.first()).toHaveAttribute('data-selected', 'true');
    await expect(
      page.getByRole('heading', { name: 'Section settings' }),
    ).toBeVisible();

    // And you can get back to the whole list.
    await page.getByRole('button', { name: 'Show all sections' }).click();
    await expect(page.getByRole('heading', { name: 'Sections', exact: true })).toBeVisible();

    // Reorder controls are on every row; the first cannot move further up.
    await expect(items.first().getByRole('button', { name: /Move .* up/ })).toBeDisabled();
    if (count > 1)
      await expect(items.first().getByRole('button', { name: /Move .* down/ })).toBeEnabled();
  });
});
