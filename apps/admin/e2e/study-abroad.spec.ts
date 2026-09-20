import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { adminBaseUrl, webBaseUrl } from './helpers/e2e-urls';
import { acceptanceEmail } from './helpers/acceptance-run';

/**
 * The Study Abroad experience in a real browser: the directory, one country
 * guide, the assessment reaching the existing lead system, and the addresses it
 * replaced.
 *
 * The guide used is Canada from the demo catalogue, the same fixture the
 * listing and counselling specs rely on.
 */

/* The destination listing is the homepage: /study-abroad now redirects here. */
const directory = `${webBaseUrl}/`;
const guide = `${webBaseUrl}/study-abroad/canada`;

function watchHealth(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return () => expect(problems, 'no console or hydration errors').toEqual([]);
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

test.describe('study abroad', () => {
  test('lists published guides as links and the rest as coming soon', async ({ page }) => {
    const healthy = watchHealth(page);
    await page.goto(directory);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Your Study Abroad Journey, Connected.',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: 'Where do you want to study?' }),
    ).toBeVisible();
    await expect(page.locator('a.dir__card[href="/study-abroad/canada"]')).toBeVisible();
    /* A destination without a guide has nowhere to go, so it is not a link. */
    await expect(page.locator('.dir__card--soon').first()).toBeVisible();
    await expect(page.locator('a.dir__card--soon')).toHaveCount(0);

    await page.getByTestId('directory-search').fill('Canada');
    await expect(page.locator('a.dir__card[href="/study-abroad/canada"]')).toBeVisible();
    await page.getByTestId('directory-search').fill('zzzz-not-a-destination');
    await expect(page.getByTestId('directory-empty')).toBeVisible();

    await page.getByTestId('directory-search').fill('');
    await page
      .locator('[data-filter-group="region"]')
      .getByRole('button', { name: 'Europe', exact: true })
      .click();
    await expect(page.locator('a.dir__card[href="/study-abroad/canada"]')).toHaveCount(0);

    await page.locator('a.dir__card').first().waitFor();
    healthy();
  });

  test('renders a country guide with its own chrome, landmarks and canonical', async ({ page }) => {
    const healthy = watchHealth(page);
    await page.goto(guide);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Canada');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', guide);
    /* One content landmark, with the route's own header and footer outside it. */
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main footer, main .nav')).toHaveCount(0);
    /* The site-wide chrome stands down rather than stacking a second nav. */
    await expect(page.locator('footer.usta-footer')).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: /Canada country snapshot/ })).toBeVisible();

    const headingFont = await page
      .getByRole('heading', { level: 1 })
      .evaluate((element) => getComputedStyle(element).fontFamily.toLowerCase());
    expect(headingFont).toContain('sora');
    healthy();
  });

  test('keeps the approved design scoped to its own routes', async ({ page }) => {
    /* `/` is inside the family now, so the proof has to come from a route
       outside it: the scoped stylesheet and its typefaces must not leak. */
    await page.goto(`${webBaseUrl}/courses`);
    await expect(page.locator('.sa')).toHaveCount(0);
    await expect(page.locator('footer.usta-footer')).toBeVisible();
    const fonts = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => getComputedStyle(element).fontFamily.toLowerCase())
        .filter((font) => font.includes('sora') || font.includes('manrope')),
    );
    expect(fonts).toEqual([]);
  });

  test('operates the study paths and FAQs from the keyboard', async ({ page }) => {
    await page.goto(guide);

    const tabs = page.getByRole('tablist', { name: 'Study levels' }).getByRole('tab');
    if ((await tabs.count()) > 1) {
      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    }

    const question = page.locator('.faq__q').first();
    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'false');
  });

  test('turns an assessment into a lead that Admin can find', async ({ page }) => {
    const unique = Date.now();
    const fullName = `Fictional Assessment ${unique}`;
    const email = acceptanceEmail(`assessment-${unique}`);

    await page.goto(guide);
    const opener = page.locator('.hero__actions').getByRole('button', { name: /Check My Eligibility/ });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /./ });
    await expect(dialog).toBeVisible();

    /* Escape always closes it; opening again starts over. */
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await opener.click();
    await expect(dialog).toBeVisible();

    for (let step = 1; step <= 10; step += 1) {
      await expect(dialog.getByText(`Question ${step} of 10`)).toBeVisible();
      /* Opened from the Canada guide, the destination step arrives answered. */
      const chosen = dialog.locator('.asm__opt[aria-pressed="true"]');
      await ((await chosen.count()) ? chosen.first() : dialog.locator('.asm__opt').first()).click();
    }

    await dialog.getByRole('button', { name: 'Show My Recommendations' }).click();
    await dialog.getByLabel('Full name').fill(fullName);
    await dialog.getByLabel('WhatsApp number').fill(`+1555${String(unique).slice(-7)}`);
    await dialog.getByLabel('Email').fill(email);
    const submitted = page.waitForResponse(
      (response) => response.url().includes('/api/study-abroad/assessment') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Show My Recommendations' }).click();
    expect((await submitted).status()).toBeLessThan(300);
    await expect(dialog.getByRole('heading', { name: 'Your plan is on its way.' })).toBeVisible();

    await page.goto(`${adminBaseUrl}/login`);
    await loginAsAdmin(page);
    await page.goto(`${adminBaseUrl}/leads`);
    await page.getByLabel('Search').fill(email);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('row').filter({ hasText: fullName })).toBeVisible();
  });

  test('redirects the addresses it replaced, permanently', async ({ page }) => {
    const cases: Array<[string, string]> = [
      ['/countries', '/'],
      ['/study-abroad', '/'],
      ['/countries/canada', '/study-abroad/canada'],
      ['/study-in/canada', '/study-abroad/canada'],
      /* The merged listing has no budget, IELTS or subject filters to
         honour, so a filtered /countries URL lands on the listing itself
         rather than carrying a promise the page can no longer keep. */
      ['/countries?q=Canada', '/?q=Canada'],
    ];
    for (const [from, to] of cases) {
      const response = await page.request.get(`${webBaseUrl}${from}`, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(new URL(response.headers().location, webBaseUrl).href, from).toBe(`${webBaseUrl}${to}`);
    }
  });

  test('lays out without horizontal overflow at three widths', async ({ page }) => {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ] as Array<[number, number]>) {
      await page.setViewportSize({ width, height });
      await page.goto(directory);
      await noHorizontalOverflow(page);
      await page.goto(guide);
      await noHorizontalOverflow(page);
    }

    /* The mobile menu opens and closes. */
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('.drawer')).toHaveAttribute('data-open', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.drawer')).toHaveAttribute('data-open', 'false');
    await page.setViewportSize({ width: 1440, height: 900 });
  });
});
