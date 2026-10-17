import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * An editor publishes a subject with Bachelor's and PhD ticked. Publish ends
 * the editing session: the list opens with a green confirmation. On the
 * website the level block follows the ticks -- Bachelor's and PhD, not the
 * six levels it used to show regardless -- even before a course is filed.
 *
 * The subject is named with this run's country prefix, so the acceptance
 * cleanup removes it with the rest of the run's records.
 */
test.describe('subject publishing and its study levels', () => {
  test('publishes back to the list and shows only the ticked levels on the site', async ({ page, request }) => {
    const name = `${acceptanceCountryName()} Levels Subject`;
    await loginAsAdmin(page);
    await page.goto('/subjects/new');
    await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await page.getByRole('textbox', { name: 'Short description', exact: true }).fill('Levels follow the ticks.');
    await page.getByRole('checkbox', { name: "Bachelor's", exact: true }).check();
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).check();

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL(/\/subjects$/);
    const toast = page.getByText(`${name} published successfully.`, { exact: true });
    await expect(toast).toBeVisible();
    await expect(toast.locator('xpath=ancestor::*[@data-toast-tone][1]')).toHaveAttribute('data-toast-tone', 'success');

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const detail = await request.get(`${apiBaseUrl}/api/v1/subjects/${slug}`);
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as { data: { offeredLevels?: Array<{ name: string }> } };
    expect((body.data.offeredLevels ?? []).map((level) => level.name)).toEqual(["Bachelor's", 'PhD']);

    await page.goto(`${webBaseUrl}/subjects/${slug}`);
    const levels = page.getByRole('navigation', { name: /study level/i });
    const block = (await levels.count()) ? levels : page.locator('main');
    await expect(block.getByText("Bachelor's", { exact: false }).first()).toBeVisible();
    await expect(block.getByText('PhD', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Foundation Program', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'MBA', exact: true })).toHaveCount(0);
  });
});
