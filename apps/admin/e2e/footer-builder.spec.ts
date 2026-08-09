import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { webBaseUrl } from './helpers/e2e-urls';

/** The footer builder has to let a non-developer add a row, choose a shape,
 * put content in it, and see it on the live site -- then get back to the
 * standard footer by removing it. */
test.describe('global footer builder', () => {
  test('composes a footer row and renders it publicly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/website/footer');

    const structure = page.getByTestId('footer-structure');
    await expect(structure).toBeVisible();
    // Nothing built yet: the site keeps its standard footer.
    await expect(page.getByText('using its standard footer')).toBeVisible();

    await page.getByRole('button', { name: 'Add row', exact: true }).click();
    const row = structure.locator('[data-testid^="footer-row-"]').first();
    await expect(row).toBeVisible();

    // Layouts are described, never shown as their stored value.
    const layout = row.getByLabel('Row 1 layout');
    await expect(layout).toBeVisible();
    await expect(layout.getByText('three-columns')).toHaveCount(0);
    await layout.selectOption('one-column');

    await row.getByRole('button', { name: 'Add block' }).first().click();
    const library = page.getByRole('dialog', { name: 'Add a footer block' });
    await expect(library).toBeVisible();
    await expect(library.getByText('LINK_LIST')).toHaveCount(0);
    await library.getByTestId('add-footer-block-TEXT').click();

    const settings = page.getByTestId('footer-block-settings');
    await expect(settings).toBeVisible();
    const marker = `Composed footer check ${Date.now()}`;
    await settings.getByLabel('Text', { exact: true }).fill(marker);

    await page.getByRole('button', { name: 'Save footer', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Footer saved.');

    // Survives a reload rather than living only in local state.
    await page.reload();
    await expect(
      page.getByTestId('footer-structure').locator('[data-testid^="footer-row-"]'),
    ).toHaveCount(1);

    // And the public site actually shows it.
    const publicPage = await page.context().newPage();
    await publicPage.goto(`${webBaseUrl}/`);
    await expect(publicPage.locator('footer')).toContainText(marker);
    await publicPage.close();

    // Removing the row returns the site to its standard footer.
    await page
      .getByTestId('footer-structure')
      .getByRole('button', { name: 'Remove row 1' })
      .click();
    await page.getByRole('button', { name: 'Save footer', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Footer saved.');
    await page.reload();
    await expect(page.getByText('using its standard footer')).toBeVisible();
  });
});
