import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceRunId, acceptanceSlugPrefix, acceptanceTextPrefix } from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';
import { request as playwrightRequest } from '@playwright/test';
import { e2eEmail, e2ePassword } from '../playwright.config';

/** Catalogue-backed sections must let an admin say where the content comes
 * from in plain language, and those choices have to survive a save. */
test.describe('section content source', () => {
  const run = acceptanceRunId();

  test('offers Automatic and manual picking, and persists the choice', async ({
    page,
  }, testInfo) => {
    const unique = `${run}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
    const context = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
    const login = await context.post('/api/v1/admin/auth/login', {
      data: { email: e2eEmail, password: e2ePassword },
    });
    const token = ((await login.json()) as { data: { accessToken: string } }).data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    const title = `${acceptanceTextPrefix(run)} Source ${unique}`;
    let pageId = '';

    try {
      const created = await context.post('/api/v1/admin/phase1/pages', {
        headers,
        data: {
          title,
          slug: `${acceptanceSlugPrefix(run)}source-${unique}`,
          pageType: 'EDITORIAL_PAGE',
        },
      });
      pageId = ((await created.json()) as { data: { id: string } }).data.id;

      await loginAsAdmin(page);
      await page.goto('/phase1/pages');
      const row = page.getByRole('row').filter({ hasText: title });
      await row.getByRole('button', { name: 'Edit', exact: true }).click();

      await page.getByRole('button', { name: 'Add section', exact: true }).click();
      await page.getByTestId('add-section-UNIVERSITY_DIRECTORY').click();

      const source = page.getByTestId('section-data-source');
      await expect(source).toBeVisible();
      await expect(source).toContainText('universities from your catalogue');
      // Plain language, no query-parameter jargon.
      await expect(source.getByText('dataMode')).toHaveCount(0);
      await expect(source.getByText('limit', { exact: true })).toHaveCount(0);

      // Automatic exposes only filters the API really supports.
      await expect(source.getByLabel('Number to show')).toHaveValue('6');
      await expect(source.getByLabel('Country (optional)')).toBeVisible();

      await source.getByLabel('Number to show').fill('3');
      await page.getByTestId('data-mode-manual').click();
      await expect(source).toContainText('Nothing chosen yet');

      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Draft saved.');

      // The choice survives a reload rather than snapping back to Automatic.
      await page.reload();
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      const reopened = page.getByTestId('section-data-source');
      await expect(reopened.getByTestId('data-mode-manual')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(reopened.getByLabel('Number to show')).toHaveValue('3');
    } finally {
      if (pageId)
        await context.delete(`/api/v1/admin/phase1/pages/${pageId}`, { headers });
      await context.dispose();
    }
  });
});
