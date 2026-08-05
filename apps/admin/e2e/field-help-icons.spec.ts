import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

// Focused coverage for the shared field-help ("(!)" info icon) architecture
// across a couple of representative, structurally different forms — a
// standalone catalog form (Country) and a Phase1StructuredEditor form
// (Scholarship). This intentionally does not submit either form, so it
// creates no records and needs no acceptance-run cleanup.
test.describe('Field help icons', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Country form: icon opens correct content, keyboard and outside-click close it, only one stays open', async ({ page }) => {
    await page.goto('/countries/new');
    const form = page.getByRole('form').or(page.locator('form')).first();
    await expect(form).toBeVisible();

    const nameIcon = form.getByRole('button', { name: 'Information about Country name' });
    const slugIcon = form.getByRole('button', { name: 'Information about Slug' });
    await expect(nameIcon).toBeVisible();
    await expect(slugIcon).toBeVisible();

    // Opens on click, shows purpose/data type/required content, and does not
    // touch the field it sits beside.
    const nameInput = form.getByLabel('Country name', { exact: true });
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

    // Keyboard-only: Tab to the icon and open with Enter.
    await nameIcon.focus();
    await page.keyboard.press('Enter');
    await expect(nameDialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Scholarship form (Phase1StructuredEditor): icon renders beside a shared Field/Select and never submits the form', async ({ page }) => {
    await page.goto('/phase1/scholarships');
    await page.getByRole('link', { name: /New|Create/i }).first().click();

    const titleIcon = page.getByRole('button', { name: 'Information about Title' });
    await expect(titleIcon).toBeVisible();
    await titleIcon.click();
    const dialog = page.getByRole('dialog', { name: 'Information about Title' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('display title');

    // Clicking the icon must never submit the form.
    await expect(page).not.toHaveURL(/\/(scholarships)$/);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
