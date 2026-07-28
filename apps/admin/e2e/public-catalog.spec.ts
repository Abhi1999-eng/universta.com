import { expect, test } from '@playwright/test';

const subjects = 'http://localhost:3000/subjects';
const courses = 'http://localhost:3000/courses';

test.describe('approved public subject and course discovery', () => {
  test('renders the approved seeded subject catalog with safe discovery paths', async ({ page }) => {
    await page.goto(subjects);

    await expect(page.getByRole('heading', { level: 1, name: /Explore Subjects to Study Abroad/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Popular subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browse by subject category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All subjects' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Computer Science/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore courses' }).first()).toBeVisible();
  });

  test('submits specialization search and focuses the filtered results', async ({ page }) => {
    await page.goto(`${subjects}/computer-science/specializations`);

    await page.getByRole('textbox', { name: 'Search specializations' }).fill('Cyber');
    await page.getByRole('button', { name: 'Find specializations' }).click();

    const results = page.locator('#all');
    await expect(results).toBeFocused();
    await expect(results.getByRole('heading', { name: 'Cybersecurity' })).toBeVisible();
    await expect(results.getByRole('heading', { name: 'Artificial Intelligence' })).toHaveCount(0);
  });

  test('keeps the subject specialisations route safe when the record is unpublished', async ({ page }) => {
    const response = await page.goto(`${subjects}/not-a-published-subject/specializations`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible();
  });

  test('does not load reference HTML or persist auth tokens on public subject pages', async ({ page }) => {
    await page.goto(subjects);
    const inspection = await page.evaluate(() => ({
      resources: performance.getEntriesByType('resource').map((entry) => entry.name),
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
    }));

    expect(inspection.resources.some((resource) => /\.html(?:$|[?#])/i.test(resource))).toBe(false);
    expect(inspection.localKeys.join(',')).not.toMatch(/token|auth|refresh/i);
    expect(inspection.sessionKeys.join(',')).not.toMatch(/token|auth|refresh/i);
  });

  test('hydrates approved course filters from the URL and preserves them on submit', async ({ page }) => {
    await page.goto(`${courses}?q=computer&level=UG&country=canada`);

    await expect(page.getByRole('heading', { level: 1, name: /Find the Perfect Course to Study Abroad/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search courses' })).toHaveValue('computer');
    await expect(page.getByRole('combobox', { name: 'Search courses' })).toBeEditable();
    await expect(page.getByRole('checkbox', { name: /Undergraduate/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Canada/ })).toBeChecked();

    await page.getByRole('checkbox', { name: /United Kingdom/ }).check();
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/q=computer/);
    await expect(page).toHaveURL(/level=UG/);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('country'))
      .toBe('canada,united-kingdom');
    expect(new URL(page.url()).searchParams.get('country')).toBe(
      'canada,united-kingdom',
    );
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    await expect(page.getByRole('heading', { name: 'Bachelor of Computer Science' })).toBeVisible();
  });

  test('restores course filter controls with browser back and forward navigation', async ({ page }) => {
    await page.goto(`${courses}?level=UG&country=canada`);
    await page.getByRole('checkbox', { name: /^Diploma / }).check();
    await page.getByRole('checkbox', { name: /Undergraduate/ }).uncheck();
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/level=DIPLOMA/);

    await page.goBack();
    await expect(page).toHaveURL(/level=UG/);
    await expect(page.getByRole('checkbox', { name: /Undergraduate/ })).toBeChecked();

    await page.goForward();
    await expect(page).toHaveURL(/level=DIPLOMA/);
    await expect(page.getByRole('checkbox', { name: /^Diploma / })).toBeChecked();
  });

  test('opens the approved course filter drawer on mobile and applies a URL filter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(courses);

    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.locator('#course-filter-panel')).toHaveClass(/open/);
    await page.getByRole('checkbox', { name: /Canada/ }).check();
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/country=canada/);
    await expect(page.locator('#course-filter-panel')).not.toHaveClass(/open/);

    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#course-filter-panel')).not.toHaveClass(/open/);
  });

  test('removes unfinished Save and Compare controls from the public course listing', async ({ page }) => {
    await page.goto(courses);

    await expect(page.getByRole('button', { name: /^Save / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Compare courses/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Compare Courses/i })).toHaveCount(0);
  });

  test('mobile menus are functional and catalog layouts do not overflow horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(subjects);
    const subjectMenu = page.getByRole('button', { name: /menu/ });
    await subjectMenu.click();
    await expect(subjectMenu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto(courses);
    const courseMenu = page.getByRole('button', { name: /menu/ });
    await courseMenu.click();
    await expect(courseMenu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
