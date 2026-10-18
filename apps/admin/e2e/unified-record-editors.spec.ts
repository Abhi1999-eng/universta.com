import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';

test.describe('unified record editors', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Course exposes the complete unsaved record before the first draft save', async ({ page }) => {
    await page.goto('/courses/new');

    await expect(page.getByRole('heading', { name: 'Create course', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Country availability', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content sections', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQs', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Related courses', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEO', exact: true })).toBeVisible();

    // Empty child collections must still render their first editable row. The
    // admin should never have to save a parent draft or click an Add button just
    // to discover the rest of the form.
    await expect(page.getByRole('heading', { name: 'Country availability 1', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content section 1', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQ 1', exact: true })).toBeVisible();
    // Field-help buttons intentionally include the field name in their aria
    // labels, so target the actual form controls by role instead of getByLabel.
    await expect(page.getByRole('textbox', { name: 'SEO title', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Meta description', exact: true })).toBeVisible();

    // Core mandatory fields use real required semantics in addition to the red
    // visual marker, so required inputs are clear before validation fails.
    await expect(page.getByRole('combobox', { name: 'Subject', exact: true })).toHaveAttribute('required', '');
    await expect(page.getByRole('combobox', { name: 'Course level', exact: true })).toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Course name', exact: true })).toHaveAttribute('required', '');

    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeVisible();
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

    // Level pages follow the study level ticks before the subject exists: none
    // ticked, none listed; a level ticked shows its row at once, with the one
    // way to write it -- save the subject, then open its page.
    const card = page.locator('#subject-level-pages');
    await expect(card.getByRole('heading', { name: 'Level pages', exact: true })).toBeVisible();
    await expect(card.getByText(/No study level is ticked yet/)).toBeVisible();
    await page.getByRole('checkbox', { name: "Bachelor's", exact: true }).check();
    await expect(card.getByRole('button', { name: "Save and write the Bachelor's page" })).toHaveText('Save and write');
    await expect(card.getByText('Not saved yet', { exact: true })).toBeVisible();
    await expect(card.getByText(/No study level is ticked yet/)).toHaveCount(0);
  });

  test('Specialization shows its Level pages card before the first draft save', async ({ page }) => {
    await page.goto('/specializations/new');

    await expect(page.getByRole('heading', { name: 'Create specialization' })).toBeVisible();
    const card = page.locator('#specialization-level-pages');
    await expect(card.getByRole('heading', { name: 'Level pages', exact: true })).toBeVisible();
    await expect(card.getByText(/No study level is ticked yet/)).toBeVisible();
    // A ticked level is listed at once; before the first save it can only be
    // written through "Save and write", never a plain link to an editor that
    // would refuse it.
    await page.getByRole('checkbox', { name: 'PhD', exact: true }).check();
    await expect(card.getByRole('button', { name: 'Save and write the PhD page' })).toHaveText('Save and write');
    await expect(page.getByRole('link', { name: /^(Write|Edit) the .+ page$/ })).toHaveCount(0);
  });

  test('Country exposes source-owned data guidance, configuration, editorial content and SEO before the first draft save', async ({ page }) => {
    await page.goto('/countries/new');

    await expect(page.getByRole('heading', { name: 'Create country' })).toBeVisible();
    await expect(page.getByLabel(/ISO alpha-2/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Study destination setup' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Available intake months' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content sections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'FAQs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consultant cards' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible();
    /* The profile cards render from the start now, so their per-card Save
     * buttons are on the page -- this used to pass only because the whole
     * section was replaced by a "save first" placeholder. The rule it was
     * written to protect still holds and is what is checked here: before the
     * first save, Save draft and Publish are the only actions that do
     * anything, and every per-card Save is disabled until the country exists
     * to attach a card to. */
    await expect(page.getByRole('heading', { name: 'Cost and budget' })).toBeVisible();
    /* Intakes are authored once, as the Country's own twelve-month selection
     * in its configuration card, so there is no intake profile card here. */
    await expect(page.getByRole('heading', { name: /^Intakes$/ })).toHaveCount(0);
    await expect(
      page.getByRole('group', { name: 'Available intake months' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    const cardSaves = page.getByRole('button', {
      name: /^Save (cost and budget|work and visa|english requirements|statistics)$/i,
    });
    await expect(cardSaves).toHaveCount(4);
    for (const save of await cardSaves.all())
      await expect(save).toBeDisabled();
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
