import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { adminBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/** The consolidated Website Builder workspace.
 *
 * The value of this screen is that one person can do one job without moving
 * between screens, so what is asserted is the presence of the whole control
 * set on a single route -- not that any individual control works, which is
 * covered by the specs for those features. */

const ABOUT_PATH = '/about';

async function openBuilderForAbout(page: import('@playwright/test').Page) {
  await loginAsAdmin(page);
  await page.goto(`${adminBaseUrl}/website`);
  const row = page.getByRole('row').filter({ hasText: 'About Us' });
  await row.getByRole('link', { name: 'Open in Builder' }).click();
  await expect(page).toHaveURL(/\/website\/pages\/[0-9a-f-]+\/builder$/);
}

test.describe('consolidated Website Builder', () => {
  test('reaches the builder from the Website Pages selector', async ({ page }) => {
    await openBuilderForAbout(page);
    await expect(page.getByRole('combobox', { name: 'Select a page to edit' })).toBeVisible();
  });

  test('puts the whole control set on one screen', async ({ page }) => {
    await openBuilderForAbout(page);

    // Top bar
    await expect(page.locator('#wb-page-search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeVisible();
    await expect(page.locator('.wb-chip', { hasText: 'Page — sections editable' })).toBeVisible();

    // Page settings, SEO, template, chrome
    const body = page.locator('body');
    await expect(body).toContainText('SEO title');
    await expect(body).toContainText('Page template');
    await expect(body).toContainText('Header & Footer');

    // Sections, with device visibility and reorder affordances
    await expect(page.getByRole('button', { name: 'Add section' })).toBeVisible();
    await expect(body).toContainText('Show on Desktop');
    // Keyboard reorder controls: the move-up/move-down buttons live on each
    // section row. Matched by title rather than glyph, which is decorative.
    await expect(page.getByRole('button', { name: 'Move section up' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move section down' }).first()).toBeVisible();

    // The whole point of the structured editor: no raw JSON anywhere.
    const jsonTextareas = await page
      .locator('textarea')
      .evaluateAll((nodes) =>
        nodes.filter((node) => /^\s*[{[]/.test((node as HTMLTextAreaElement).value || '')).length,
      );
    expect(jsonTextareas).toBe(0);
  });

  test('opens the device preview and version history in place', async ({ page }) => {
    await openBuilderForAbout(page);

    await page.getByRole('button', { name: 'Preview' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Preview of/ });
    await expect(dialog).toBeVisible();
    // Scoped to the dialog: the page editor has its own Close button.
    await dialog.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.locator('.wb-history')).toBeVisible();
  });
});

test.describe('page-level header and footer overrides', () => {
  test('offers structured controls with no JSON field', async ({ page }) => {
    await openBuilderForAbout(page);
    const panel = page.locator('fieldset', { has: page.locator('legend', { hasText: 'Header & Footer' }) });
    await expect(panel).toBeVisible();

    const headerMode = panel.getByLabel('Header', { exact: false }).first();
    await expect(headerMode).toBeVisible();
    // The three required modes must all be offered.
    await expect(panel.locator('option', { hasText: 'Use Global' }).first()).toHaveCount(1);
    await expect(panel.locator('option', { hasText: 'Alternate variant' }).first()).toHaveCount(1);
    await expect(panel.locator('option', { hasText: 'Hide' }).first()).toHaveCount(1);
  });

  test('warns about legal and contact links when the footer is hidden', async ({ page }) => {
    await openBuilderForAbout(page);
    const panel = page.locator('fieldset', { has: page.locator('legend', { hasText: 'Header & Footer' }) });
    const selects = panel.locator('select');
    // The footer mode select is the second one while both are on Use Global.
    await selects.nth(1).selectOption('HIDE');
    await expect(panel.getByRole('alert')).toContainText('privacy policy');
  });
});

test.describe('public chrome stays global by default', () => {
  test('renders exactly one header and one footer with no variant class', async ({ page }) => {
    await page.goto(`${webBaseUrl}${ABOUT_PATH}`);
    await expect(page.locator('header.usta-header')).toHaveCount(1);
    await expect(page.locator('footer.usta-footer')).toHaveCount(1);
    // No page has an override in the deterministic demo data, so no variant
    // class should be present on a clean database.
    await expect(page.locator('header.usta-header-compact')).toHaveCount(0);
    await expect(page.locator('footer.usta-footer-minimal')).toHaveCount(0);
  });
});
