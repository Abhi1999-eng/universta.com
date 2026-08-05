import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

// Focused coverage for the shared field-help ("(!)" info icon) architecture
// across representative, structurally different forms. None of these tests
// submit a form or create a record, so no acceptance-run cleanup is needed.
test.describe('Field help icons', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Country form: icon opens correct content, keyboard and outside-click close it, only one stays open, coexists with validation errors, wraps on mobile', async ({ page }) => {
    await page.goto('/countries/new');
    const form = page.getByRole('form').or(page.locator('form')).first();
    await expect(form).toBeVisible();

    const nameIcon = form.getByRole('button', { name: 'Information about Country name' });
    const slugIcon = form.getByRole('button', { name: 'Information about Slug' });
    await expect(nameIcon).toBeVisible();
    await expect(slugIcon).toBeVisible();

    // Opens on click, shows purpose/data type/required content, and does not
    // touch the field it sits beside.
    const nameInput = form.getByRole('textbox', { name: /^Country name/ });
    await nameInput.fill('Should not change');
    await nameIcon.click();
    const nameDialog = page.getByRole('dialog', { name: 'Information about Country name' });
    await expect(nameDialog).toBeVisible();
    await expect(nameDialog).toContainText('display name');
    await expect(nameDialog).toContainText('Text');
    await expect(nameDialog).toContainText('Required');
    await expect(nameInput).toHaveValue('Should not change');
    await expect(nameInput).not.toBeFocused();

    // Opening a second popover closes the first — only one stays open.
    await slugIcon.click();
    await expect(nameDialog).not.toBeVisible();
    const slugDialog = page.getByRole('dialog', { name: 'Information about Slug' });
    await expect(slugDialog).toBeVisible();
    await expect(slugDialog).toContainText('URL-friendly identifier');

    // Escape closes it.
    await page.keyboard.press('Escape');
    await expect(slugDialog).not.toBeVisible();

    // Outside click closes it.
    await nameIcon.click();
    await expect(nameDialog).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(nameDialog).not.toBeVisible();

    // Keyboard-only: focus the icon and open with Enter, then Space.
    await nameIcon.focus();
    await page.keyboard.press('Enter');
    await expect(nameDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nameDialog).not.toBeVisible();
    await nameIcon.focus();
    await page.keyboard.press(' ');
    await expect(nameDialog).toBeVisible();
    await page.keyboard.press('Escape');

    // Coexists with a validation error: submit empty required fields, then
    // confirm the icon still opens right beside the error state.
    await page.getByRole('button', { name: 'Save draft' }).click();
    await nameIcon.click();
    await expect(nameDialog).toBeVisible();
    await page.keyboard.press('Escape');

    // Mobile viewport: no horizontal overflow, and the popover repositions
    // to stay inside the viewport instead of overflowing off the right edge.
    await page.setViewportSize({ width: 375, height: 812 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await nameIcon.click();
    await expect(nameDialog).toBeVisible();
    const box = await nameDialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
  });

  test('Scholarship form (Phase1StructuredEditor): shared Field/Select/media-picker icons render and never submit the form', async ({ page }) => {
    await page.goto('/phase1/scholarships');
    await page.getByRole('button', { name: 'Create record' }).click();

    const titleIcon = page.getByRole('button', { name: 'Information about Title' });
    await expect(titleIcon).toBeVisible();
    await titleIcon.click();
    const dialog = page.getByRole('dialog', { name: 'Information about Title' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('display title');
    await page.keyboard.press('Escape');

    // A Select-backed field (Provider) and the media picker also get icons.
    await expect(page.getByRole('button', { name: 'Information about Provider' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Information about Media (optional)' })).toBeVisible();

    // Clicking the icon must never submit the form: this is an inline
    // editor (no navigation either way), so submission would show up as the
    // listing's record count changing or the editor closing — neither
    // happens.
    await expect(page.getByText('0 records')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create scholarships' })).toBeVisible();
  });

  test('Generic Course form: icon renders for a shared select field and opens correct content', async ({ page }) => {
    await page.goto('/courses/new');
    const levelIcon = page.getByRole('button', { name: 'Information about Course level' });
    await expect(levelIcon).toBeVisible();
    await levelIcon.click();
    await expect(page.getByRole('dialog', { name: 'Information about Course level' })).toContainText('qualification level');
  });

  test('Settings form: icon renders for a dynamically-keyed field and opens correct content', async ({ page }) => {
    await page.goto('/settings?section=general');
    const siteNameIcon = page.getByRole('button', { name: 'Information about Site name' });
    await expect(siteNameIcon).toBeVisible();
    await siteNameIcon.click();
    await expect(page.getByRole('dialog', { name: 'Information about Site name' })).toContainText('site’s name');
  });
});
