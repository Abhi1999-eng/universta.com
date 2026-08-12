import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

/** The Admin shell owns the page h1 and every workspace titles itself with an
 * h2. That convention is what keeps each screen to a single primary heading;
 * one workspace had drifted back to an h1, giving those pages two. */

const routes = [
  ['Dashboard', '/dashboard'],
  ['Countries', '/countries'],
  ['Universities', '/phase1/universities'],
  ['Courses', '/courses'],
  ['Subjects', '/subjects'],
  ['Scholarships', '/phase1/scholarships'],
  ['Consultants', '/phase1/consultants'],
  ['Bulk data', '/bulk-data'],
  ['Website Builder', '/website'],
  ['Global Header', '/website/header'],
  ['Global Footer', '/website/footer'],
  ['Media', '/media'],
  ['Settings', '/settings?section=general'],
] as const;

test.describe('Admin heading structure', () => {
  test('every representative screen has exactly one h1', async ({ page }) => {
    await loginAsAdmin(page);

    const offenders: Array<{ route: string; count: number; texts: string[] }> = [];
    for (const [label, route] of routes) {
      await page.goto(route);
      // The shell's title is the last thing to settle after a client-side load.
      await expect(page.locator('h1')).toHaveCount(1, { timeout: 15_000 }).catch(() => {});
      const headings = await page.locator('h1').allTextContents();
      if (headings.length !== 1) {
        offenders.push({ route: `${label} (${route})`, count: headings.length, texts: headings });
      }
      // The visible page title must still be there, whatever its level.
      expect(
        await page.locator('h1, h2').first().textContent(),
        `${label} should still show a page title`,
      ).toBeTruthy();
    }

    expect(offenders, `screens with the wrong number of h1 elements: ${JSON.stringify(offenders)}`)
      .toEqual([]);
  });

  test('a workspace title survives as a heading, just not a second h1', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/website/header');

    await expect(page.getByRole('heading', { level: 2, name: 'Global Header' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
