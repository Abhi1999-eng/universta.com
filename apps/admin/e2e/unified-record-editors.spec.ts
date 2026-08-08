import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

test.describe('unified record editors', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Course exposes the complete unsaved record before the first draft save', async ({ page }) => {
    await page.goto('/courses/new');

    await expect(page.getByRole('heading', { name: 'Create course' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Country availability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content sections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Related courses' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible();

    // Empty child collections must still render their first editable row. The
    // admin should never have to save a parent draft or click an Add button just
    // to discover the rest of the form.
    await expect(page.getByRole('heading', { name: 'Country availability 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content section 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQ 1' })).toBeVisible();
    await expect(page.getByLabel('SEO title')).toBeVisible();
    await expect(page.getByLabel('Meta description')).toBeVisible();

    // Core mandatory fields use real required semantics in addition to the red
    // visual marker, so required inputs are clear before validation fails.
    await expect(page.getByRole('combobox', { name: 'Subject', exact: true })).toHaveAttribute('required', '');
    await expect(page.getByRole('combobox', { name: 'Course level', exact: true })).toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Course name', exact: true })).toHaveAttribute('required', '');

    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /save (availability|content|faq|seo)/i })).toHaveCount(0);
  });

  test('Subject exposes Specializations and SEO before the first draft save', async ({ page }) => {
    await page.goto('/subjects/new');

    await expect(page.getByRole('heading', { name: 'Create subject' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Specializations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /save seo/i })).toHaveCount(0);
  });

  test('Country exposes profiles, intakes, editorial content and SEO before the first draft save', async ({ page }) => {
    await page.goto('/countries/new');

    await expect(page.getByRole('heading', { name: 'Create country' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Country profiles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intakes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content sections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consultant cards' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save (cost|work|language|statistics|intakes|SEO)/i })).toHaveCount(0);
  });

  test('Phase 1 structured records expose only the unified draft/publish actions', async ({ page }) => {
    await page.goto('/phase1/universities');
    await page.getByRole('button', { name: 'Create record' }).click();

    const form = page.getByRole('form', { name: 'Create universities' });
    await expect(form).toBeVisible();
    await expect(form.getByText('Publish state', { exact: true })).toBeHidden();
    await expect(form.getByText('Save draft', { exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Create draft' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  });
});
