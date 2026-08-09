import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { webBaseUrl } from './helpers/e2e-urls';

/** The header editor must speak plainly and only offer controls the public
 * header genuinely honours. */
test.describe('global header editor', () => {
  test('edits the header in plain language and shows it publicly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/website/header');
    await expect(
      page.getByRole('heading', { name: 'Global Header' }),
    ).toBeVisible();

    // Grouped, described controls -- never raw settings keys.
    await expect(page.getByText('ctaLabel')).toHaveCount(0);
    await expect(page.getByText('announcementVisible')).toHaveCount(0);
    await expect(page.getByText('menuKey')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save header' })).toBeVisible();

    // Advanced settings stay collapsed until asked for.
    const sticky = page.getByLabel('Keep the header visible while scrolling');
    await expect(sticky).toBeHidden();
    await page.getByText('Advanced', { exact: true }).click();
    await expect(sticky).toBeVisible();

    const label = `Talk to us ${Date.now()}`;
    await page.getByLabel('Button text').fill(label);
    await page.getByLabel('Where it goes').fill('/counselling');
    await page.getByRole('button', { name: 'Save header' }).click();
    await expect(page.getByRole('status')).toContainText('Header saved.');

    await page.reload();
    await expect(page.getByLabel('Button text')).toHaveValue(label);

    // The change reaches the live header, not just the admin form.
    const publicPage = await page.context().newPage();
    await publicPage.goto(`${webBaseUrl}/`);
    await expect(publicPage.locator('header')).toContainText(label);
    await publicPage.close();
  });
});
