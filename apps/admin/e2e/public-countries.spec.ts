import { expect, test } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/* The filterable destination listing is the homepage; /countries redirects
 * there when it carries filters and to the Study Abroad directory when it
 * does not. A country's own page is its Study Abroad guide. */
const listing = `${webBaseUrl}/`;
const guide = `${webBaseUrl}/study-abroad/canada`;

test.describe('approved public country experience', () => {
  test('renders the API-backed approved listing without browser auth persistence', async ({ page }) => {
    await page.goto(listing);

    await expect(page.getByRole('heading', { level: 1, name: /Where will your degree take you/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Search a country' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Browse every destination A–Z' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore Canada/ })).toBeVisible();
    // The footer is now the single Admin-managed one rendered by the root
    // layout, rather than a per-template footer inside the page.
    await expect(page.locator('footer.usta-footer')).toBeVisible();

    expect(await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage).filter((key) => /token|auth|refresh/i.test(key)),
    }))).toEqual({ local: [], session: [] });
  });

  test('hydrates approved search, region, and structured controls from a shareable URL', async ({ page }) => {
    await page.goto(`${listing}?q=Canada&region=north-america&budgetBand=MID_RANGE&ieltsOptional=true`);

    await expect(page.getByRole('combobox', { name: 'Search a country' })).toHaveValue('Canada');
    await expect(page.getByRole('button', { name: /North America/i })).toHaveClass(/on/);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.getByLabel('Budget')).toHaveValue('MID_RANGE');
    await expect(page.getByLabel('IELTS requirement')).toHaveValue('true');
  });

  test('submits country search through the router and keeps the URL canonical', async ({ page }) => {
    await page.goto(listing);
    const search = page.getByRole('combobox', { name: 'Search a country' });

    await expect(search).toBeEditable();
    await search.fill('Canada');
    await search.press('Enter');

    await expect(page).toHaveURL(/q=Canada/);
    await expect(search).toHaveValue('Canada');
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  });

  test('applies structured filters while preserving search and region state', async ({ page }) => {
    await page.goto(`${listing}?q=Canada&region=north-america&budgetBand=MID_RANGE&ieltsOptional=true`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Budget').selectOption('PREMIUM');
    await page.getByTestId('country-apply').click();

    await expect(page).toHaveURL(/q=Canada/);
    await expect(page).toHaveURL(/region=north-america/);
    await expect(page).toHaveURL(/budgetBand=PREMIUM/);
    await expect(page).toHaveURL(/ieltsOptional=true/);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  });

  test('restores combined filter state through browser back and forward navigation', async ({ page }) => {
    await page.goto(`${listing}?q=Canada&region=north-america&budgetBand=MID_RANGE&page=2`);
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByLabel('Budget').selectOption('PREMIUM');
    await page.getByTestId('country-apply').click();
    await expect(page).toHaveURL(/budgetBand=PREMIUM/);
    expect(new URL(page.url()).searchParams.has('page')).toBe(false);

    await page.goBack();
    await expect(page).toHaveURL(/budgetBand=MID_RANGE/);
    await expect(page).toHaveURL(/page=2/);
    const toggle = page.getByRole('button', { name: /^Filters/ });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(page.getByLabel('Budget')).toHaveValue('MID_RANGE');

    await page.goForward();
    await expect(page).toHaveURL(/budgetBand=PREMIUM/);
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(page.getByLabel('Budget')).toHaveValue('PREMIUM');
  });

  test('clears result filters without removing the independent A–Z directory', async ({ page }) => {
    // Clearing the filters keeps the visitor on the listing's own address.
    await page.goto(`${listing}?q=not-a-real-country&budgetBand=PREMIUM&page=2`);
    await page.getByRole('button', { name: 'Clear all filters' }).click();

    await expect(page).toHaveURL(listing);
    await expect(page.getByRole('heading', { name: 'Browse every destination A–Z', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore Canada/ })).toBeVisible();
  });

  test('supports keyboard country suggestion selection', async ({ page }) => {
    await page.goto(listing);
    const search = page.getByRole('combobox', { name: 'Search a country' });
    const suggestionsLoaded = page.waitForResponse((response) => (
      response.url().includes('/api/countries/suggestions?')
      && response.ok()
    ));

    await expect(search).toBeEditable();
    await search.fill('Can');
    await suggestionsLoaded;
    await expect(page.getByRole('listbox')).toBeVisible();
    await search.press('ArrowDown');
    await search.press('Enter');

    await expect(page).toHaveURL(/q=Canada/);
    await expect(search).toHaveValue('Canada');
  });

  test('announces country suggestion no-results state', async ({ page }) => {
    await page.goto(listing);
    const search = page.getByRole('combobox', { name: 'Search a country' });
    const suggestionsLoaded = page.waitForResponse((response) => (
      response.url().includes('/api/countries/suggestions?')
      && response.ok()
    ));

    await expect(search).toBeEditable();
    await search.fill('zzzz-not-a-destination');
    await suggestionsLoaded;
    await expect(page.getByText('No destinations found.', { exact: true })).toBeVisible();
  });

  test('opens and closes the approved country filter drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(listing);

    await page.getByRole('button', { name: /^Filters/ }).click();
    await expect(page.locator('#country-filter-panel')).toHaveClass(/is-open/);
    await expect(page.getByLabel('Budget')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('#country-filter-panel')).not.toHaveClass(/is-open/);
  });

  test('provides URL-backed pagination controls for an out-of-range page', async ({ page }) => {
    await page.goto(`${listing}?page=2`);
    const pagination = page.getByRole('navigation', { name: 'Country results pages' });

    await expect(pagination).toBeVisible();
    await pagination.getByRole('button', { name: 'Previous' }).click();
    await expect(page).toHaveURL(/page=1/);
  });

  test('renders every A–Z control and jumps to available sticky-safe groups', async ({ page }) => {
    await page.goto(listing);

    await expect(page.locator('.directory-letter')).toHaveCount(26);
    expect(await page.locator('.directory-letter:disabled').count()).toBeGreaterThan(0);

    const available = page.locator('a.directory-letter').first();
    const href = await available.getAttribute('href');
    expect(href).toMatch(/^#directory-letter-[A-Z]$/);
    await available.click();
    await expect(page).toHaveURL(new RegExp(`${href?.slice(1)}$`));
    await expect(page.locator(href as string)).toBeVisible();
  });

  test('renders the country guide sections with in-page links that resolve', async ({ page }) => {
    await page.goto(guide);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Canada');
    await expect(page.getByRole('heading', { name: 'What it costs' })).toBeVisible();
    /* Intakes are the Country's own month selection. */
    await expect(page.getByRole('heading', { name: /^Intakes in / })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Language requirements' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'After you arrive, and after you graduate' }),
    ).toBeVisible();

    const links = await page.locator('a[href^="#"]').evaluateAll((elements) => (
      elements.map((element) => element.getAttribute('href')).filter((href) => href && href !== '#')
    ));
    for (const href of links) await expect(page.locator(href as string)).toHaveCount(1);
  });

  test('links every city guide at an address the site actually serves', async ({ page }) => {
    await page.goto(`${webBaseUrl}/study-in-canada/cities`);

    const cityLinks = await page.locator('a[href^="/study-in-canada/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
    );
    const guides = [...new Set(cityLinks.filter((href) => href !== '/study-in-canada/cities'))];
    expect(guides.length).toBeGreaterThan(0);
    for (const href of guides) {
      // A city guide lives under its destination; /cities/<slug> is not a route.
      expect(href).toMatch(/^\/study-in-canada\/[a-z0-9-]+$/);
      const response = await page.request.get(`${webBaseUrl}${href}`);
      expect(response.status(), `${href} should not 404`).toBe(200);
    }
  });

  test('keeps unpublished consultants off a public location page', async ({ page }) => {
    await page.goto(`${webBaseUrl}/study-abroad-consultants/locations/demo-harbour`);

    const links = await page.locator('a[href^="/study-abroad-consultants/"]').evaluateAll((all) =>
      all.map((link) => link.getAttribute('href')).filter(Boolean),
    );
    const profiles = [...new Set(links.filter((href) => /^\/study-abroad-consultants\/[^/]+$/.test(href)))];
    for (const href of profiles) {
      const response = await page.request.get(`${webBaseUrl}${href}`);
      expect(response.status(), `${href} is linked publicly so it must resolve`).toBe(200);
    }
  });

  test('publishes breadcrumb, FAQ and organisation JSON-LD on a country guide', async ({ page }) => {
    await page.goto(guide);

    // BreadcrumbList (this page) + site-wide Organization (root layout) always
    // render; FAQPage renders whenever the country has at least one real FAQ.
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(3);
    const types = await scripts.evaluateAll((nodes) =>
      nodes.map((node) => (JSON.parse(node.textContent ?? '{}') as { '@type'?: string })['@type']),
    );
    expect(types.sort()).toEqual(['BreadcrumbList', 'FAQPage', 'Organization']);
  });

  test('keeps country listing and detail layouts free of horizontal mobile overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(listing);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.goto(guide);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
