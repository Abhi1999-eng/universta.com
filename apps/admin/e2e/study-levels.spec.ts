import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginAsAdmin } from './helpers/admin-auth';

/**
 * The one list of study levels: it says what it is, where each level is
 * used, and keeps a level's code -- the address of its level pages -- fixed
 * once the level exists. A study mode, on the same screen, keeps an
 * editable code.
 */
test.describe('study levels', () => {
  test('explains the list, shows usage, and locks a code once saved', async ({ page }) => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const code = `E2E${suffix}`;
    const name = `E2E level ${suffix}`;

    await loginAsAdmin(page);
    await page.goto('/catalog-masters?section=course-levels');

    await expect(page.getByRole('heading', { level: 2, name: 'Study levels' })).toBeVisible();
    await expect(page.getByText(/The one list of study levels that subjects, specializations/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Study levels', exact: true })).toHaveAttribute('aria-current', 'page');

    const usage = page.getByTestId('level-usage');
    await expect(usage.first()).toBeVisible();
    for (const line of await usage.allTextContents()) {
      expect(line).toMatch(/^(Used in .+|Not used yet)$/);
    }

    // An existing level: the code is read-only and says why.
    const masters = page.getByText("Master's", { exact: true }).locator('..').locator('..');
    await masters.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit study level' });
    const codeInput = dialog.getByRole('textbox', { name: /Code/ });
    await expect(codeInput).toHaveAttribute('readonly', '');
    await expect(codeInput).toHaveValue('PG');
    await expect(dialog.getByText('Locked. Level page addresses use it: /subjects/…/masters. Change the name instead.')).toBeVisible();
    await expect(dialog.getByText(/Shown on this level's pages/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // A new level: any code on Add, fixed after; the name still changes.
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const add = page.getByRole('dialog', { name: 'Add study level' });
    await expect(add.getByText("Can't be changed after you save. Level page addresses are built from it.")).toBeVisible();
    await add.getByRole('textbox', { name: /Code/ }).fill(code);
    await add.getByRole('textbox', { name: /Name/ }).fill(name);
    await add.getByRole('button', { name: 'Save' }).click();
    await expect(add).toBeHidden();

    const row = () => page.getByText(`${code} · ACTIVE`, { exact: true }).locator('..').locator('..');
    await expect(row().getByTestId('level-usage')).toHaveText('Not used yet');
    await row().getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit study level' });
    await expect(edit.getByRole('textbox', { name: /Code/ })).toHaveAttribute('readonly', '');
    await expect(edit.getByText(`Locked. Level page addresses use it: /subjects/…/${code.toLowerCase()}. Change the name instead.`)).toBeVisible();
    await edit.getByRole('textbox', { name: /Name/ }).fill(`${name} renamed`);
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(edit).toBeHidden();
    await expect(row().getByText(`${name} renamed`, { exact: true })).toBeVisible();

    await row().getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: 'Delete master record?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(`${code} · ACTIVE`, { exact: true })).toHaveCount(0);

    // Study modes share the screen and keep an editable code.
    await page.goto('/catalog-masters?section=study-modes');
    await expect(page.getByRole('heading', { level: 2, name: 'Study modes' })).toBeVisible();
    await expect(page.getByText(/The lists that course editors pick from/)).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const mode = page.getByRole('dialog', { name: 'Edit study mode' });
    await expect(mode.getByRole('textbox', { name: /Code/ })).not.toHaveAttribute('readonly', '');
    await mode.getByRole('button', { name: 'Cancel' }).click();
  });
});
