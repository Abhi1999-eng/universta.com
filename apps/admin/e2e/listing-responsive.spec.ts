import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/**
 * Listing pages must not give the page horizontal scroll at the tablet width.
 *
 * `1fr` is `minmax(auto, 1fr)`, so a two- or three-across grid is floored at
 * its items' min-content width. On the deployed catalogue a long institution
 * name in a nested mini-card pushed the row past its container and the whole
 * /universities page scrolled sideways by 5px at 768px. The assertion is the
 * page-level one because that is what a visitor feels.
 */
test.describe('listing pages at tablet width', () => {
  for (const route of ['/universities', '/countries', '/subjects', '/scholarships', '/courses']) {
    test(`${route} does not scroll sideways at 768px`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'networkidle' });
      const { scrollWidth, clientWidth, offenders } = await page.evaluate(() => {
        const de = document.documentElement;
        const wide: string[] = [];
        document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > de.clientWidth + 1) {
            wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').filter(Boolean).slice(0, 2).join('.')} right=${Math.round(r.right)}`);
          }
        });
        return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders: wide.slice(0, 5) };
      });
      expect(
        scrollWidth,
        `${route} overflows by ${scrollWidth - clientWidth}px: ${offenders.join(', ')}`,
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
