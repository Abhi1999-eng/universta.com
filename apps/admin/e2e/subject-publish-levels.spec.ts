import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceCountryName } from './helpers/acceptance-run';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * An editor publishes a subject with Bachelor's and PhD ticked. Publish ends
 * the editing session: the list opens with a green confirmation. On the
 * website the level toggle follows the ticks -- Bachelor's and PhD, not the
 * six levels it used to show regardless -- even before a course is filed,
 * each level ending with its own page, and so does the subject's page in a
 * destination.
 *
 * A level page exists only for a level the subject is offered at: its
 * PhD page opens, its MBA page is not found, and the destination's empty
 * PhD panel links to the PhD page everywhere.
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
    /* The subject's levels are a toggle: Bachelor's and PhD, nothing else,
       each panel ending with the level's own page. */
    const toggle = page.getByRole('group', { name: 'Study level', exact: true });
    await expect(toggle.getByRole('button')).toHaveText(["Bachelor's", 'PhD']);
    await expect(page.locator('#programs section.studylevel')).toHaveCount(2);
    await expect(page.locator('#level-ug .studylevel__elsewhere a')).toHaveAttribute('href', `/subjects/${slug}/bachelors`);
    await toggle.getByRole('button', { name: 'PhD' }).click();
    await expect(toggle.getByRole('button', { name: 'PhD' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#level-phd')).toBeVisible();
    await expect(page.locator('#level-ug')).toBeHidden();
    await expect(page.locator('#level-phd a.coursegroup__head')).toHaveAttribute('href', `/subjects/${slug}/phd?view=guides`);
    await expect(page.locator('#level-phd .studylevel__elsewhere a')).toHaveAttribute('href', `/subjects/${slug}/phd`);
    await expect(page.locator('#level-phd')).not.toContainText('every destination');
    await expect(page.getByRole('heading', { name: 'Foundation Program', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'MBA', exact: true })).toHaveCount(0);

    /* In a destination the page is the subject's, studied there: its own
       heading, and the ticked levels as the bar to pick from, each saying
       it has nothing listed there yet. */
    const countries = await request.get(`${apiBaseUrl}/api/v1/countries?limit=1`);
    const country = ((await countries.json()) as { data: Array<{ slug: string; name: string }> }).data[0];
    expect(country).toBeTruthy();
    await page.goto(`${webBaseUrl}/study-abroad/${country.slug}/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^Study ${name} in `));
    const bar = page.getByRole('group', { name: 'Study level', exact: true });
    await expect(bar.getByRole('button')).toHaveText(["Bachelor's", 'PhD']);
    await bar.getByRole('button', { name: 'PhD' }).click();
    await expect(bar.getByRole('button', { name: 'PhD' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#level-phd')).toBeVisible();
    await expect(page.locator('#level-phd')).toContainText(/Not listed in .+ yet/);
    await expect(page.locator('#level-ug')).toBeHidden();
    await expect(page.locator('#level-phd .studylevel__elsewhere a')).toHaveAttribute('href', `/subjects/${slug}/phd`);

    /* The level pages: one for each level it is offered at, and a real 404
       for any other, its alias included. */
    const phd = await page.goto(`${webBaseUrl}/subjects/${slug}/phd`);
    expect(phd?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`PhD in ${name}`);
    await expect(page.getByRole('navigation', { name: 'Study levels' }).getByRole('link')).toHaveText(["Bachelor's", 'PhD']);
    const mba = await page.goto(`${webBaseUrl}/subjects/${slug}/mba`);
    expect(mba?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();
    const masters = await page.goto(`${webBaseUrl}/subjects/${slug}/pg`);
    expect(masters?.status()).toBe(404);
  });
});
