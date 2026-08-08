import { expect, request as playwrightRequest, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { acceptanceRunId, acceptanceSlugPrefix, acceptanceTextPrefix } from './helpers/acceptance-run';
import { apiBaseUrl } from './helpers/e2e-urls';
import { e2eEmail, e2ePassword } from '../playwright.config';

/** Applying a page template is one action from the admin's point of view:
 * choose a template, press Apply, see the sections. The fixtures are created
 * over the API so the assertions stay about the page editor's behaviour
 * rather than about the template manager's form. */
test.describe('page template apply', () => {
  const run = acceptanceRunId();

  async function apiContext() {
    const context = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
    const login = await context.post('/api/v1/admin/auth/login', {
      data: { email: e2eEmail, password: e2ePassword },
    });
    const token = ((await login.json()) as { data: { accessToken: string } }).data
      .accessToken;
    return {
      context,
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  test('applies a template in one action and shows the sections immediately', async ({
    page,
  }, testInfo) => {
    const unique = `${run}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
    const { context, headers } = await apiContext();
    let pageId = '';
    let templateId = '';

    try {
      const template = await context.post('/api/v1/admin/page-templates', {
        headers,
        data: {
          name: `${acceptanceTextPrefix(run)} Template ${unique}`,
          pageFamily: 'EDITORIAL_PAGE',
          isActive: true,
          defaultSections: [
            { sectionType: 'RICH_TEXT', heading: 'About Universta' },
            { sectionType: 'RICH_TEXT', heading: 'What We Do' },
            { sectionType: 'CTA', heading: 'Talk To Our Counsellors' },
          ],
        },
      });
      templateId = ((await template.json()) as { data: { id: string } }).data.id;

      const pageTitle = `${acceptanceTextPrefix(run)} Page ${unique}`;
      const created = await context.post('/api/v1/admin/phase1/pages', {
        headers,
        data: {
          title: pageTitle,
          slug: `${acceptanceSlugPrefix(run)}page-${unique}`,
          pageType: 'EDITORIAL_PAGE',
        },
      });
      pageId = ((await created.json()) as { data: { id: string } }).data.id;

      await loginAsAdmin(page);
      await page.goto('/phase1/pages');
      // Located by this run's own unique title rather than by position, so a
      // repeat run or a reordered list cannot pick up somebody else's row.
      const row = page.getByRole('row').filter({ hasText: pageTitle });
      await expect(row).toBeVisible();
      await row.getByRole('button', { name: 'Edit', exact: true }).click();

      const select = page.getByTestId('page-template-select');
      await expect(select).toBeVisible();
      await select.selectOption(templateId);

      // Choosing a template says what applying it will do, before committing.
      const preview = page.getByTestId('template-preview');
      await expect(preview).toContainText('Includes 3 sections');
      await expect(preview).toContainText('About Universta');

      await page.getByTestId('apply-template').click();

      // Sections appear without a manual reload, and the result is reported.
      await expect(page.getByRole('status')).toContainText('3 sections added');
      await expect(page.getByText('No sections yet. Add one above.')).toHaveCount(0);
      const headings = page.getByLabel('Heading', { exact: true });
      await expect(headings).toHaveCount(3);
      await expect(headings.nth(0)).toHaveValue('About Universta');
      await expect(headings.nth(1)).toHaveValue('What We Do');
      await expect(headings.nth(2)).toHaveValue('Talk To Our Counsellors');

      // Applying again is safe: nothing duplicates, and the copy says so
      // rather than surfacing a server error.
      await page.getByTestId('apply-template').click();
      await expect(page.getByRole('status')).toContainText('already existed');
      await expect(page.getByText('Internal server error')).toHaveCount(0);
      await expect(page.getByLabel('Heading', { exact: true })).toHaveCount(3);
    } finally {
      if (pageId)
        await context.delete(`/api/v1/admin/phase1/pages/${pageId}`, { headers });
      if (templateId)
        await context.delete(`/api/v1/admin/page-templates/${templateId}`, { headers });
      await context.dispose();
    }
  });

  /** The editor must not ask an admin to understand persistence: there is one
   * Save, and section edits ride along with it. */
  test('offers a single save lifecycle, with no separate section save', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/phase1/pages');
    await expect(
      page.getByRole('button', { name: 'Save sections', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Save assignment', exact: true }),
    ).toHaveCount(0);
  });

  /** Website Pages is the canonical way in; the record list stays reachable
   * but is clearly labelled as the raw list so nobody has to choose. */
  test('names Website Pages as the canonical page-building entry point', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(nav.getByRole('link', { name: 'Website Pages' })).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Page records (raw list)' }),
    ).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Pages', exact: true })).toHaveCount(0);
  });
});
