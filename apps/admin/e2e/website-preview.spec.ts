import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { adminBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/** Website Builder draft preview.
 *
 * Two things must hold at once: an admin can see unpublished content in a
 * device frame, and nobody else can see it at all. The second half is the
 * reason this spec exists -- a preview that leaks drafts to the public URL
 * would be worse than having no preview. */

test.describe('Website Builder device preview', () => {
  test('offers Desktop/Tablet/Mobile frames at real logical widths', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/website`);

    const aboutRow = page.getByRole('row').filter({ hasText: 'About Us' });
    await aboutRow.getByRole('button', { name: 'Preview' }).click();

    const dialog = page.getByRole('dialog', { name: /Preview of/ });
    await expect(dialog).toBeVisible();
    // The note has to state the two things an admin needs to know before
    // sharing a screen: this is draft, and the link dies.
    await expect(dialog).toContainText('unpublished draft content');
    await expect(dialog).toContainText('expires at');

    const frame = dialog.locator('.wb-preview-frame iframe');
    for (const [label, width] of [
      ['Desktop', '1440'],
      ['Tablet', '768'],
      ['Mobile', '390'],
    ] as const) {
      await dialog.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await expect(frame).toHaveAttribute('width', width);
    }

    // Scaling the 1440 frame down must not make the admin page scroll sideways.
    await dialog.getByRole('button', { name: /^Desktop/ }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('refuses to render draft content without a valid preview token', async ({ page }) => {
    // Scoped to the preview notice: Next renders its own aria-live route
    // announcer with role="alert" on every page.
    const notice = page.locator('.usta-preview-empty');

    // No token at all.
    await page.goto(`${webBaseUrl}/preview?slug=about`);
    await expect(notice).toContainText('Preview link incomplete');

    // A syntactically plausible but unsigned token.
    await page.goto(`${webBaseUrl}/preview?slug=about&token=eyJhbGciOiJIUzI1NiJ9.e30.bad`);
    await expect(notice).toContainText('Preview unavailable');

    // The whole point: no draft content reaches an unauthorised viewer.
    await expect(page.locator('.phase1-editorial')).toHaveCount(0);

    // And the page must never be indexable even when it does render.
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute('content');
    expect(robots).toContain('noindex');
  });

  test('keeps the preview route out of robots.txt and the sitemap', async ({ request }) => {
    const robots = await (await request.get(`${webBaseUrl}/robots.txt`)).text();
    expect(robots).toContain('/preview');

    const sitemap = await (await request.get(`${webBaseUrl}/sitemap.xml`)).text();
    expect(sitemap).not.toContain('/preview');
  });
});
