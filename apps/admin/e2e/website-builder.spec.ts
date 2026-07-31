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
    await expect(page.locator('.wb-chip', { hasText: 'Static page' })).toBeVisible();

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

test.describe('Website Builder registration', () => {
  test('lists every approved Phase 1 page and template in one selector', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/website`);

    // Every approved entry, by the label the client uses.
    const required = [
      'Home', 'About Us', 'Contact Us', 'Book Free Counselling', 'Success Stories',
      'Testimonials', 'FAQ', 'Countries Listing', 'Country Detail Template',
      'Cities Listing', 'City Detail Template', 'Universities Listing',
      'University Detail Template', 'University Courses Template',
      'Single University Course Offering Template', 'Subjects Listing',
      'Subject Detail Template', 'Specializations Listing', 'Generic Courses Listing',
      'Generic Course Detail Template', 'Scholarships Listing',
      'Scholarship Detail Template', 'Consultants Listing', 'Consultant Detail Template',
      'Consultant Location Template', 'Country Comparison', 'University Comparison',
      'Course Comparison', 'Consultant Comparison', 'Careers Listing',
      'Job Detail Template', 'Events Listing', 'Event Detail Template',
    ];
    await expect(page.getByRole('row').first()).toBeVisible();
    for (const label of required) {
      await expect(
        page.getByRole('row').filter({ hasText: new RegExp(`^${label}`) }).first(),
        `"${label}" must be visible in the Website Pages selector`,
      ).toBeVisible();
    }
    await expect(page.getByRole('row')).toHaveCount(required.length + 1); // + header row
  });

  test('every entry opens a real Builder workspace, none needs creating first', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/website`);

    const builderLinks = page.getByRole('link', { name: 'Open in Builder' });
    // Wait for the table to finish loading before counting.
    await expect(builderLinks.first()).toBeVisible();
    const hrefs = await builderLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href') ?? ''),
    );
    expect(hrefs).toHaveLength(33);
    // Nothing may fall back to /seo, and nothing may still require the
    // "Create editable page" action.
    expect(hrefs.every((href) => /\/website\/(pages|templates)\/[0-9a-f-]+\/builder$/.test(href))).toBe(true);
    await expect(page.getByRole('button', { name: 'Create editable page' })).toHaveCount(0);
  });

  test('opens a listing page and a detail template from the same selector', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/website`);

    for (const label of [
      'Universities Listing', 'Scholarships Listing', 'Consultants Listing',
      'Country Comparison', 'University Comparison', 'Course Comparison', 'Consultant Comparison',
    ]) {
      await page.goto(`${adminBaseUrl}/website`);
      const row = page.getByRole('row').filter({ hasText: new RegExp(`^${label}`) }).first();
      await expect(row).toBeVisible();
      await row.getByRole('link', { name: 'Open in Builder' }).click();
      await expect(page).toHaveURL(/\/website\/pages\/[0-9a-f-]+\/builder$/);
      await expect(page.locator('body')).toContainText('Header & Footer');
    }
  });

  test('a detail template previews against a real published entity', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/website`);
    const tplRow = page.getByRole('row').filter({ hasText: /^University Detail Template/ }).first();
    await expect(tplRow).toBeVisible();
    await tplRow.getByRole('link', { name: 'Open in Builder' }).click();
    await expect(page).toHaveURL(/\/website\/templates\/[0-9a-f-]+\/builder$/);

    const picker = page.locator('#tpl-entity');
    await expect(picker).toBeVisible();
    // Entities come from real records, so the list must not be empty and the
    // frame must point at the genuine public route.
    expect(await picker.locator('option').count()).toBeGreaterThan(0);
    await expect(page.locator('.wb-preview-frame iframe')).toHaveAttribute(
      'src', /\/universities\/[a-z0-9-]+$/,
    );
  });
});
