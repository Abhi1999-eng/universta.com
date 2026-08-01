import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

const comparisons = [
  { type: 'countries', items: ['australia', 'brazil', 'canada'] },
  {
    type: 'universities',
    items: [
      'ember-demo-institute',
      'lakeside-demo-university',
      'northstar-demonstration-university',
    ],
  },
  {
    type: 'courses',
    items: [
      'northstar-demo-business-insights',
      'northstar-demo-data-analytics',
      'lakeside-demo-digital-design',
    ],
  },
  {
    type: 'consultants',
    items: [
      'lakeside-demo-consultant',
      'ember-demo-consultant',
      'universta-demo-guidance',
    ],
  },
];

test.describe('published Phase 1 comparisons', () => {
  for (const comparison of comparisons) {
    test(`keeps ${comparison.type} comparison state shareable and responsive`, async ({ page }) => {
      const path = `${webBaseUrl}/compare/${comparison.type}`;
      const items = comparison.items.join(',');
      await page.goto(path);

      const input = page.getByLabel(`Search published ${comparison.type}`);
      for (const slug of comparison.items) {
        await input.fill(slug);
        await page.getByRole('button', { name: /^Add / }).first().click();
      }
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);
      await expect(page.getByRole('button', { name: 'Compare selected' })).toBeEnabled();
      expect(
        await page.getByRole('button', { name: /^Add / }).evaluateAll((buttons) =>
          buttons.every((button) => (button as HTMLButtonElement).disabled),
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Compare selected' }).click();
      await expect(page).toHaveURL(new RegExp(`/compare/${comparison.type}\\?items=`));
      expect(new URL(page.url()).searchParams.get('items')).toBe(items);
      await expect(
        page.locator('.phase1-compare-desktop thead th'),
      ).toHaveCount(4);

      await page.reload();
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);
      await page.goBack({ waitUntil: 'commit' });
      await expect(page).toHaveURL(path);
      await page.goForward({ waitUntil: 'commit' });
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);

      const firstLabel = await page.getByLabel('Selected comparison items').locator('span').first().innerText();
      await page.getByRole('button', { name: new RegExp(`Remove ${firstLabel.replace('×', '').trim()}`) }).click();
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(2);
      await input.fill(comparison.items[0]);
      await page.getByRole('button', { name: /^Add / }).first().click();

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex,\s*follow/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`/compare/${comparison.type}$`),
      );

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.phase1-compare-mobile article')).toHaveCount(3);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  }
});
