import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/** Direct regression coverage for a real incident: the site's header menu
 * sat INACTIVE for hours after an unrelated change, and the public header
 * rendered a logo with nothing else -- silently, since the query that
 * resolves it filters by status and just finds nothing. This is the specific
 * symptom that broke, asserted on its own so it cannot regress unnoticed
 * behind an unrelated navigation-completeness failure. */

test.describe('public header menu health', () => {
  test('the header renders at least one navigation item', async ({ page }) => {
    await page.goto(webBaseUrl);
    const items = page.locator('header nav a, header nav button');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(0);
  });
});
