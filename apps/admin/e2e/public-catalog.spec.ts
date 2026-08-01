import { expect, test, type Page } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

const subjects = `${webBaseUrl}/subjects`;
const courses = `${webBaseUrl}/courses`;

function observePageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const target = new URL(request.url());
    const failure = request.failure()?.errorText ?? 'unknown failure';
    const expectedNavigationCancellation =
      target.searchParams.has('_rsc') &&
      request.resourceType() === 'fetch' &&
      /ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure);
    if (!expectedNavigationCancellation) {
      failedRequests.push(`${request.method()} ${request.url()} (${failure})`);
    }
  });

  return () => {
    expect(consoleErrors, 'unexpected browser console or hydration errors').toEqual(
      [],
    );
    expect(failedRequests, 'unexpected failed browser requests').toEqual([]);
  };
}

test.describe('approved public subject and course discovery', () => {
  test('renders the Countries listing as the home route', async ({ page }) => {
    // The Countries listing is the site's homepage: "/" renders it directly,
    // and "/countries" is kept only as a redirect to the same content.
    await page.goto(webBaseUrl);

    await expect(page).toHaveURL(webBaseUrl);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('Search a country')).toBeVisible();
    // Scope to the page body: the shared header/footer also expose their own
    // counselling CTA, which is intended.
    const hero = page.locator('main');
    await expect(hero.getByRole('link', { name: /counsel/i }).first()).toHaveAttribute('href', /counselling/);

    await page.goto(`${webBaseUrl}/countries`);
    await expect(page).toHaveURL(webBaseUrl);
    await expect(page.getByLabel('Search a country')).toBeVisible();
  });

  test('renders the approved seeded subject catalog with safe discovery paths', async ({ page }) => {
    await page.goto(subjects);

    await expect(page.getByRole('heading', { level: 1, name: 'Explore Subjects' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Popular subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browse by category' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A–Z subject directory' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Computer Science/i }).first()).toBeVisible();
    await expect(page.locator('#categories a').filter({ hasText: 'Computer Science' })).toHaveAttribute(
      'href',
      '/courses?subject=computer-science',
    );
    const popularHrefs = await page.locator('#popular a.subj-card').evaluateAll((links) => (
      links.map((link) => link.getAttribute('href'))
    ));
    expect(new Set(popularHrefs).size).toBe(popularHrefs.length);
  });

  test('preserves subject search state in the shareable URL and search field', async ({ page }) => {
    await page.goto(`${subjects}?q=Computer`);

    await expect(page.getByRole('combobox', { name: 'Search subjects' })).toHaveValue('Computer');
    await expect(page.locator('#popular a.subj-card')).toHaveCount(1);
  });

  test('offers API-backed subject suggestions with keyboard selection', async ({ page }) => {
    const assertHealthyPage = observePageHealth(page);
    await page.goto(subjects);
    const search = page.getByRole('combobox', { name: 'Search subjects' });
    const suggestionResponse = page.waitForResponse((response) => {
      const target = new URL(response.url());
      return (
        target.pathname === '/api/subjects/suggestions' &&
        target.searchParams.get('q') === 'comp'
      );
    });

    await search.fill('comp');
    expect((await suggestionResponse).status()).toBe(200);
    await expect(
      page.getByRole('option', { name: 'Computer Science', exact: true }),
    ).toBeVisible();
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await search.press('ArrowDown');
    await search.press('Enter');

    await expect(page).toHaveURL(/q=Computer\+Science/);
    await expect(search).toHaveValue('Computer Science');
    await expect(page.locator('#popular a.subj-card')).toHaveCount(1);
    assertHealthyPage();
  });

  test('submits specialization search and focuses the filtered results', async ({ page }) => {
    const assertHealthyPage = observePageHealth(page);
    await page.goto(`${subjects}/computer-science/specializations`);

    await page.getByRole('textbox', { name: 'Search specializations' }).fill('Cyber');
    await page.getByRole('button', { name: 'Find specializations' }).click();

    await expect(page).toHaveURL(/q=Cyber/);
    const results = page.locator('#all');
    await expect(results).toBeFocused();
    await expect(results.getByRole('heading', { name: 'Cybersecurity' })).toBeVisible();
    await expect(results.getByRole('heading', { name: 'Artificial Intelligence' })).toHaveCount(0);
    await expect(page.locator('#cybersecurity')).toHaveCount(1);

    await results.getByRole('link', { name: 'Explore courses' }).click();
    await expect(page).toHaveURL(/subject=computer-science/);
    await expect(page).toHaveURL(/subSubject=cybersecurity/);
    await expect(page.getByRole('checkbox', { name: /Computer Science/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Cybersecurity/ })).toBeChecked();
    assertHealthyPage();
  });

  test('restores specialization search with refresh, back, and clear', async ({ page }) => {
    const assertHealthyPage = observePageHealth(page);
    const route = `${subjects}/computer-science/specializations`;
    await page.goto(`${route}?page=3`);
    await page.getByRole('textbox', { name: 'Search specializations' }).fill('data');
    await page.getByRole('button', { name: 'Find specializations' }).click();
    await expect(page).toHaveURL(/q=data/);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Search specializations' })).toHaveValue('data');
    await expect(
      page.getByRole('heading', { name: 'Data Science', exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page).toHaveURL(route);
    await page.goBack();
    await expect(page).toHaveURL(/q=data/);
    await expect(page.getByRole('textbox', { name: 'Search specializations' })).toHaveValue('data');
    await page.goForward();
    await expect(page).toHaveURL(route);
    await expect(page.getByRole('textbox', { name: 'Search specializations' })).toHaveValue('');
    assertHealthyPage();
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

  test('combines supported filters and keeps OR selections within a dimension', async ({ page }) => {
    await page.goto(courses);

    await page.getByRole('checkbox', { name: /Canada/ }).check();
    await page.getByRole('checkbox', { name: /Computer Science/ }).check();
    await page.getByRole('checkbox', { name: /Undergraduate/ }).check();
    await page.getByRole('checkbox', { name: /^Diploma / }).check();
    await page.getByRole('checkbox', { name: /IELTS/ }).check();
    await page.getByRole('button', { name: 'Apply filters' }).click();

    await expect(page).toHaveURL(/englishTest=IELTS/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('country')).toBe('canada');
    expect(params.get('subject')).toBe('computer-science');
    expect(params.get('level')).toBe('DIPLOMA,UG');
    expect(params.get('englishTest')).toBe('IELTS');
    await expect(page.getByRole('heading', { name: 'Diploma in Cybersecurity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bachelor of Computer Science' })).toBeVisible();
  });

  test('keeps quick filters and sort controls synchronized with the URL', async ({ page }) => {
    await page.goto(courses);

    await page.getByRole('button', { name: 'Scholarships' }).click();
    await expect(page).toHaveURL(/scholarshipAvailable=true/);
    await expect(page.getByRole('button', { name: 'Scholarships' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('combobox', { name: 'Sort courses' }).selectOption('name');
    await expect(page).toHaveURL(/sort=name/);
    const names = await page.locator('.course-list .course h3').allTextContents();
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
  });

  test('enables destination-currency tuition inputs and pagination', async ({ page }) => {
    const assertHealthyPage = observePageHealth(page);
    await page.goto(`${courses}?country=canada&pageSize=3`);

    await expect(page.getByText(/Amounts in CAD/)).toBeVisible();
    await page.getByLabel('Minimum').fill('1000');
    await page.getByLabel('Maximum').fill('999999');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/minTuition=1000/);
    await expect(page).toHaveURL(/maxTuition=999999/);

    const pagination = page.getByRole('navigation', {
      name: 'Course results pagination',
    });
    await expect(pagination).toHaveCount(1);
    await expect(
      pagination.getByRole('button', {
        name: 'Previous results page',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      pagination.getByText('Page 1 of 2', { exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await pagination
      .getByRole('button', { name: 'Next results page', exact: true })
      .click();
    await expect(page).toHaveURL(/page=2/);
    expect(new URL(page.url()).searchParams.get('country')).toBe('canada');
    expect(new URL(page.url()).searchParams.get('minTuition')).toBe('1000');
    await expect(
      pagination.getByText('Page 2 of 2', { exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      pagination.getByRole('button', {
        name: 'Previous results page',
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      pagination.getByRole('button', {
        name: 'Next results page',
        exact: true,
      }),
    ).toBeDisabled();

    await page.getByLabel('Maximum').fill('2000000');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.has('page'))
      .toBe(false);
    assertHealthyPage();
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
    for (const viewport of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 700 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of [
        subjects,
        `${subjects}/computer-science`,
        `${subjects}/computer-science/specializations`,
        courses,
        `${courses}/diploma-cybersecurity?country=canada`,
      ]) {
        await page.goto(route);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }

      await page.goto(subjects);
      // The mobile menu is now the shared Admin-managed drawer in the root
      // layout, so it is asserted on every template rather than per page.
      const subjectMenu = page.getByRole('button', { name: /menu/i });
      await expect(subjectMenu).toBeVisible();
      await subjectMenu.click();
      await expect(subjectMenu).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page.getByRole('navigation', { name: 'Mobile navigation' }),
      ).toBeVisible();
    }
  });

  test('shows the selected course, not only its country, in counselling context', async ({ page }) => {
    await page.goto(`${courses}/diploma-cybersecurity?country=canada`);
    await page.getByRole('link', { name: 'Talk to a counsellor' }).click();

    await expect(page.getByText('Started from: Course · Diploma Cybersecurity · Canada')).toBeVisible();
    await expect(page.getByLabel('Interested country')).toHaveValue('canada');
  });
});
