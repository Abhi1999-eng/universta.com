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
    type: 'consultants',
    items: [
      'lakeside-demo-consultant',
      'ember-demo-consultant',
      'universta-demo-guidance',
    ],
  },
];

test.describe('published Phase 1 comparisons', () => {
  test('keeps four programme comparisons shareable and responsive', async ({ page }) => {
    const path = `${webBaseUrl}/compare/courses`;
    await page.goto(path);
    const picker = page.getByLabel('Add a course to the comparison');
    const selected: string[] = [];
    for (let index = 0; index < 4; index++) {
      const slug = await picker.locator('option').nth(1).getAttribute('value');
      expect(slug).toBeTruthy();
      selected.push(slug!);
      await picker.selectOption(slug!);
      await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe(selected.join(','));
    }
    await expect(picker).toBeDisabled();
    await expect(page.locator('.comparetable thead th')).toHaveCount(5);
    await page.reload();
    await expect(page.locator('.comparetable thead th')).toHaveCount(5);
    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get('items')?.split(',').length).toBe(3);
    await page.goForward();
    await expect(page.locator('.comparetable thead th')).toHaveCount(5);
    await page.getByRole('link', { name: /^Remove .* from the comparison$/ }).first().click();
    await expect(page.locator('.comparetable thead th')).toHaveCount(4);
    await expect(picker).toBeEnabled();
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex,\s*follow/);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', /\/compare\/courses$/);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
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

      // Prove Back/Forward independently from reload. A reload may replace the
      // current browser history entry, so create a fresh base -> comparison
      // transition before asserting traversal in both directions.
      await page.goto(path);
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(0);
      for (const slug of comparison.items) {
        await input.fill(slug);
        await page.getByRole('button', { name: /^Add / }).first().click();
      }
      await page.getByRole('button', { name: 'Compare selected' }).click();
      await expect(page).toHaveURL(new RegExp(`/compare/${comparison.type}\\?items=`));
      await page.goBack({ waitUntil: 'commit' });
      await expect(page).toHaveURL(path);
      await page.goForward({ waitUntil: 'commit' });
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);

      const firstLabel = await page.getByLabel('Selected comparison items').locator('span').first().innerText();
      await page.getByRole('button', { name: new RegExp(`Remove ${firstLabel.replace('×', '').trim()}`) }).click();
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(2);
      await input.fill(comparison.items[0]);
      await page.getByRole('button', { name: /^Add / }).first().click();

      // Next.js can transiently stream a duplicate metadata node into the body
      // before reconciling it into <head>. The canonical document metadata is
      // the head entry, so assert that stable target rather than every streamed
      // copy in the live DOM.
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex,\s*follow/,
      );
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`/compare/${comparison.type}$`),
      );

      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.phase1-compare-mobile article')).toHaveCount(3);
      const removeButtonBox = await page
        .getByLabel('Selected comparison items')
        .getByRole('button', { name: /^Remove / })
        .first()
        .boundingBox();
      expect(removeButtonBox?.width).toBeGreaterThanOrEqual(32);
      expect(removeButtonBox?.height).toBeGreaterThanOrEqual(32);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });
  }
});
