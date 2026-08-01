import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/** Direct regression coverage for the header's Resources dropdown.
 *
 * The trigger opened on hover but also toggled on click. A real mouse click
 * fires pointerenter (which opens the panel) immediately before its own
 * click event, so the click's toggle instantly closed what hover had just
 * opened -- the panel was unusable by mouse. This exercises every input
 * modality the fix needs to serve. */

test.describe('header Resources dropdown', () => {
  test('a real mouse click opens it and keeps it open, repeatedly', async ({ page }) => {
    await page.goto(webBaseUrl);
    const trigger = page.getByRole('button', { name: 'Resources' });
    const panel = page.locator('header').getByRole('link', { name: 'FAQ', exact: true });

    // This is the exact previously-broken interaction: click, not hover.
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // A second click must not flicker it closed either.
    await trigger.click();
    await expect(panel).toBeVisible();
  });

  test('Escape closes it and returns focus to the trigger', async ({ page }) => {
    await page.goto(webBaseUrl);
    const trigger = page.getByRole('button', { name: 'Resources' });
    await trigger.click();
    await expect(page.locator('header').getByRole('link', { name: 'FAQ' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('header').getByRole('link', { name: 'FAQ' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('clicking outside the panel closes it', async ({ page }) => {
    await page.goto(webBaseUrl);
    const trigger = page.getByRole('button', { name: 'Resources' });
    await trigger.click();
    await expect(page.locator('header').getByRole('link', { name: 'FAQ' })).toBeVisible();

    await page.locator('main').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('header').getByRole('link', { name: 'FAQ' })).toBeHidden();
  });

  test('keyboard-only: Tab reaches the trigger, Enter opens it, Tab reaches its links', async ({
    page,
  }) => {
    await page.goto(webBaseUrl);
    const trigger = page.getByRole('button', { name: 'Resources' });

    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Tab');
    await expect(
      page.locator('header').getByRole('link', { name: 'Success Stories' }),
    ).toBeFocused();
  });

  test('a touch tap opens it and a second tap closes it', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: false });
    const page = await context.newPage();
    await page.goto(webBaseUrl);
    const trigger = page.getByRole('button', { name: 'Resources' });
    const link = page.locator('header').getByRole('link', { name: 'FAQ', exact: true });

    await trigger.tap();
    await expect(link).toBeVisible();
    await trigger.tap();
    await expect(link).toBeHidden();
    await context.close();
  });
});
