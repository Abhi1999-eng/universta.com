import { expect, test, type Page } from '@playwright/test';
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

async function openUniversityDraftSearch(page: Page) {
  const input = page.getByLabel('Search published universities');
  if (!(await input.isVisible())) {
    await page.locator('summary').filter({ hasText: 'Search published universities' }).click();
  }
  await expect(input).toBeVisible();
}

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

  test('adds universities immediately and keeps the ZIP comparison URL and mobile table usable', async ({ page }) => {
    const path = `${webBaseUrl}/compare/universities`;
    const universities = comparisons.find((comparison) => comparison.type === 'universities')!.items;
    await page.goto(path);
    await expect(page.locator('.sa')).toHaveCount(1);
    const picker = page.getByLabel('Add a university to the comparison');
    const selected: string[] = [];
    for (const slug of universities) {
      await picker.selectOption(slug);
      selected.push(slug);
      await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe(selected.join(','));
      await expect(page.locator('.comparetable thead th')).toHaveCount(selected.length + 1);
    }

    await page.reload();
    await expect(page.locator('.comparetable thead th')).toHaveCount(4);
    expect(new URL(page.url()).searchParams.get('items')).toBe(selected.join(','));
    await page.goBack({ waitUntil: 'commit' });
    await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe(selected.slice(0, 2).join(','));
    await expect(page.locator('.comparetable thead th')).toHaveCount(3);
    await page.goForward({ waitUntil: 'commit' });
    await expect(page.locator('.comparetable thead th')).toHaveCount(4);

    await page.getByRole('link', { name: /^Remove .* from the comparison$/ }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe(selected.slice(1).join(','));
    await expect(page.locator('.comparetable thead th')).toHaveCount(3);
    await expect(picker).toBeEnabled();
    await picker.selectOption(selected[0]);
    await expect.poll(() => new URL(page.url()).searchParams.get('items')).toBe([...selected.slice(1), selected[0]].join(','));
    await expect(page.locator('.comparetable thead th')).toHaveCount(4);

    await page.setViewportSize({ width: 390, height: 844 });
    const region = page.getByRole('region', { name: 'University comparison' });
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('tabindex', '0');
    const tableSize = await region.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(tableSize.width).toBeGreaterThan(0);
    expect(tableSize.scroll, 'the comparison scrolls within its own region on a phone').toBeGreaterThan(tableSize.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByTestId('university-compare-clear').click();
    await expect(page).toHaveURL(path);
    await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(0);

    // Repeated and unpublished slugs cannot create duplicate or invented
    // columns, or consume a valid published university's position.
    const invalid = 'not-a-published-comparison-university';
    await page.goto(`${path}?items=${universities[0]},${universities[0]},${invalid},${universities[1]}`);
    await expect(page.locator('.comparetable thead th')).toHaveCount(3);
    await expect(page.getByText(new RegExp(`Not published.*${invalid}`))).toBeVisible();
    await expect(page.locator('.comparetable')).not.toContainText(invalid);
    await page.getByTestId('university-compare-clear').click();
    await expect(page).toHaveURL(path);
  });

  for (const comparison of comparisons) {
    test(`keeps ${comparison.type} comparison state shareable and responsive`, async ({ page }) => {
      const path = `${webBaseUrl}/compare/${comparison.type}`;
      const items = comparison.items.join(',');
      await page.goto(path);

      if (comparison.type === 'universities') await openUniversityDraftSearch(page);

      const input = page.getByLabel(`Search published ${comparison.type}`);
      for (const slug of comparison.items) {
        await input.fill(slug);
        await page.getByRole('button', { name: /^Add / }).first().click();
      }
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);
      await expect(page.getByRole('button', { name: 'Compare selected' })).toBeEnabled();
      if (comparison.type === 'universities') {
        // Universities now allow five. These three seed records still prove
        // the staged search flow without inventing extra catalogue records.
        await expect(page.getByRole('status')).toContainText('3/5 selected');
      } else {
        expect(
          await page.getByRole('button', { name: /^Add / }).evaluateAll((buttons) =>
            buttons.every((button) => (button as HTMLButtonElement).disabled),
          ),
        ).toBe(true);
      }
      await page.getByRole('button', { name: 'Compare selected' }).click();
      await expect(page).toHaveURL(new RegExp(`/compare/${comparison.type}\\?items=`));
      expect(new URL(page.url()).searchParams.get('items')).toBe(items);
      await expect(page.locator(
        comparison.type === 'universities' ? '.comparetable thead th' : '.phase1-compare-desktop thead th',
      )).toHaveCount(4);

      await page.reload();
      await expect(page.getByLabel('Selected comparison items').locator('span')).toHaveCount(3);

      // Prove Back/Forward independently from reload. A reload may replace the
      // current browser history entry, so create a fresh base -> comparison
      // transition before asserting traversal in both directions.
      await page.goto(path);
      if (comparison.type === 'universities') await openUniversityDraftSearch(page);
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

      if (comparison.type === 'universities') await openUniversityDraftSearch(page);

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
      if (comparison.type === 'universities') {
        const table = page.getByRole('region', { name: 'University comparison' });
        await expect(table).toBeVisible();
        await expect(table.locator('.comparetable thead th')).toHaveCount(4);
      } else {
        await expect(page.locator('.phase1-compare-mobile article')).toHaveCount(3);
      }
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
