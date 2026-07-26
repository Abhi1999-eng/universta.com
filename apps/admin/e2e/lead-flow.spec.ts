import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { adminBaseUrl, webBaseUrl } from './helpers/e2e-urls';

test('captures a contextual counselling lead and manages it in Admin', async ({
  page,
}) => {
  const unique = Date.now();
  const fullName = `Fictional Lead ${unique}`;
  const email = `phase1-lead-${unique}@example.invalid`;
  const phone = `+1555${String(unique).slice(-8)}`;
  const internalNote = `<script>alert("qa")</script> Fictional follow-up note ${unique}`;

  await page.goto(`${webBaseUrl}/countries/canada`);
  await page
    .locator('.hero-btns')
    .getByRole('link', { name: 'Talk to a counsellor' })
    .click();
  await expect(page).toHaveURL(
    /\/counselling\?source=country&country=canada/,
  );
  await expect(page.getByText(/Started from: Country · canada/)).toBeVisible();
  await expect(page.getByLabel('Interested country')).toHaveValue('canada');

  await page.getByLabel('Full name').fill(fullName);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Phone number').fill(phone);
  await page.getByLabel('Study level').selectOption({ index: 1 });
  await page.getByLabel('Intended intake').selectOption({ index: 1 });
  await page
    .getByLabel('I agree to be contacted about study abroad counselling.')
    .check();
  await page.getByRole('button', { name: 'Request free counselling' }).click();

  const confirmation = page.getByRole('status');
  await expect(confirmation).toBeFocused();
  await expect(
    page.getByRole('heading', {
      name: 'Thank you. We’ll help you plan your next step.',
    }),
  ).toBeVisible();

  await page.goto(`${adminBaseUrl}/login`);
  await loginAsAdmin(page);
  await page.getByRole('link', { name: 'Leads' }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/q=phase1-lead-/);
  const leadRow = page.getByRole('row').filter({ hasText: fullName });
  await expect(leadRow).toBeVisible();
  await leadRow.getByRole('link', { name: 'View lead' }).click();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  await page.getByLabel('Current status').selectOption('CONTACTED');
  await page.getByLabel('Reason (optional)').fill('Fictional browser follow-up');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('Lead status updated.', { exact: true })).toBeVisible();
  await expect(page.getByText('New → Contacted', { exact: true })).toBeVisible();

  await page.getByLabel('Add internal note').fill(internalNote);
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Internal note added.', { exact: true })).toBeVisible();
  await expect(page.getByText(internalNote, { exact: true })).toBeVisible();
  await expect(page.locator('script').filter({ hasText: 'alert("qa")' })).toHaveCount(0);
  await expect(page.getByText('Lead Note Created', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${webBaseUrl}/counselling?source=country&country=canada&from=%2Fcountries%2Fcanada`);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('heading', { name: /clear plan/i })).toBeVisible();

  await page.goto(`${adminBaseUrl}/leads`);
  await expect(page).not.toHaveURL(/\/login/);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByLabel('Search').fill(email);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const leadCard = page.locator('article').filter({ hasText: fullName });
  await expect(leadCard).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const detailLink = leadCard.getByRole('link', { name: 'View lead' });
  const detailPath = await detailLink.getAttribute('href');
  expect(detailPath).toMatch(/^\/leads\/[a-f0-9-]+$/);
  await detailLink.click();
  await expect(page).toHaveURL(`${adminBaseUrl}${detailPath}`);
  await expect(
    page.getByRole('heading', { level: 2, name: fullName }),
  ).toBeVisible();
  const detailWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          element: element.tagName,
          className:
            typeof element.className === 'string'
              ? element.className.slice(0, 120)
              : '',
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          text: (element.textContent ?? '').trim().slice(0, 80),
        };
      })
      .filter(
        (element) =>
          element.left < -1 ||
          element.right > document.documentElement.clientWidth + 1,
      )
      .slice(0, 12),
  }));
  expect(
    detailWidth.scrollWidth,
    JSON.stringify(detailWidth.offenders),
  ).toBeLessThanOrEqual(detailWidth.clientWidth);
});
