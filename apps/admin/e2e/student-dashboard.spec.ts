import { expect, test, type Page } from '@playwright/test';
import { apiBaseUrl, webBaseUrl } from './helpers/e2e-urls';

/**
 * Student dashboard quality gates.
 *
 * These cover defects that were found by measuring the running portal rather
 * than by reading it: a progress timeline that rendered as one run-on string, a
 * saved-items page that highlighted no navigation entry, an empty-state link
 * that was the same colour as the sentence around it, and routes that shipped
 * with no way to reach them. Every assertion here is structural — element
 * relationships, computed colours, equal heights — so it survives visual
 * tuning but fails again if the underlying rule is lost.
 */

const PASSWORD = 'StudentPass123x';

/** Every authenticated destination the portal serves. */
const ROUTES = [
  '/student',
  '/student/applications',
  '/student/saved',
  '/student/scholarships',
  '/student/deadlines',
  '/student/recommendations',
  '/student/documents',
  '/student/messages',
  '/student/notifications',
  '/student/support',
  '/student/referrals',
  '/student/profile',
  '/student/settings',
  '/student/more',
  '/student/onboarding',
];

async function signUpAndIn(page: Page, tag: string) {
  const email = `dash.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
  await page.request.post(`${apiBaseUrl}/api/v1/student/auth/register`, {
    data: { firstName: 'Nina', email, password: PASSWORD },
  });
  await page.goto(`${webBaseUrl}/student/login`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/student$/);
  return email;
}

async function tokenFor(page: Page, email: string) {
  const login = await page.request.post(`${apiBaseUrl}/api/v1/student/auth/login`, {
    data: { email, password: PASSWORD },
  });
  return (await login.json()).data.accessToken as string;
}

/** Published catalogue ids, read from the portal's own recommendations feed so
 * the fixtures track whatever the seed happens to contain. */
async function catalogue(page: Page, token: string) {
  const res = await page.request.get(`${apiBaseUrl}/api/v1/student/recommendations`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = res.ok() ? (await res.json()).data : {};
  return {
    offeringId: String(data?.offerings?.[0]?.id ?? ''),
    universityId: String(data?.universities?.[0]?.id ?? ''),
  };
}

/** Signs in and starts one application, so progress UI has something to show. */
async function studentWithApplication(page: Page) {
  const email = await signUpAndIn(page, 'app');
  const token = await tokenFor(page, email);
  const { offeringId } = await catalogue(page, token);
  if (!offeringId) return { email, token, applicationId: '' };
  const started = await page.request.post(`${apiBaseUrl}/api/v1/student/applications`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { offeringId },
  });
  return { email, token, applicationId: started.ok() ? String((await started.json()).data.id) : '' };
}

test.describe('student dashboard', () => {
  test('every destination keeps one h1, a breadcrumb and no sideways scroll', async ({ page }) => {
    await signUpAndIn(page, 'shell');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const route of ROUTES) {
        await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('h1'), `${route} @${width}`).toHaveCount(1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
          `${route} @${width} must not scroll sideways`,
        ).toBe(true);
        // The dashboard root is the breadcrumb's own origin, so it has none.
        await expect(page.locator('.stu-breadcrumbs'), `${route} breadcrumb`).toHaveCount(
          route === '/student' ? 0 : 1,
        );
      }
    }
  });

  test('marks exactly one navigation entry as the current page', async ({ page }) => {
    await signUpAndIn(page, 'nav');
    await page.setViewportSize({ width: 1440, height: 900 });
    // Two sidebar entries deep-link into sections of /student/saved. Both used
    // to match nothing, leaving the page with no highlight at all.
    for (const route of ['/student', '/student/applications', '/student/saved', '/student/documents']) {
      await page.goto(`${webBaseUrl}${route}`, { waitUntil: 'networkidle' });
      await expect(
        page.locator('.stu-nav a[aria-current="page"]'),
        `${route} highlights exactly one entry`,
      ).toHaveCount(1);
    }
  });

  test('keeps desktop and tablet sidebar navigation in one left-aligned icon grid', async ({ page }) => {
    await signUpAndIn(page, 'sidebar-alignment');

    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${webBaseUrl}/student`, { waitUntil: 'networkidle' });

      const layout = await page.locator('.stu-nav > a').evaluateAll((items) =>
        items.map((item) => {
          const icon = item.querySelector<HTMLElement>('.ic')!;
          const label = item.querySelector<HTMLElement>('.stu-nav-label')!;

          return {
            iconLeft: Math.round(icon.getBoundingClientRect().left),
            iconWidth: Math.round(icon.getBoundingClientRect().width),
            labelLeft: Math.round(label.getBoundingClientRect().left),
            justifyContent: getComputedStyle(item).justifyContent,
            overflow: item.scrollWidth > item.clientWidth,
          };
        }),
      );

      expect(layout.length, `${width}px sidebar entries`).toBeGreaterThan(3);
      const diagnostic = JSON.stringify(layout);
      expect(new Set(layout.map((item) => item.iconLeft)).size, diagnostic).toBe(1);
      expect(new Set(layout.map((item) => item.iconWidth)).size, diagnostic).toBe(1);
      expect(new Set(layout.map((item) => item.labelLeft)).size, diagnostic).toBe(1);
      expect(layout.every((item) => item.justifyContent === 'flex-start')).toBe(true);
      expect(layout.every((item) => !item.overflow)).toBe(true);
      await expect(page.locator('.stu-nav a[aria-current="page"]')).toHaveCount(1);
    }
  });

  test('shows application progress as separate status and note lines', async ({ page }) => {
    const { applicationId } = await studentWithApplication(page);
    test.skip(!applicationId, 'no published offering available to apply to');
    await page.goto(`${webBaseUrl}/student/applications/${applicationId}`, { waitUntil: 'networkidle' });

    const first = page.locator('.stu-timeline li').first();
    await expect(first).toBeVisible();
    // The status and its note are separate blocks. Left inline they rendered as
    // "Application startedApplication started".
    for (const child of ['strong', 'span']) {
      expect(
        await first.locator(child).evaluate((el) => getComputedStyle(el).display),
        `${child} must be its own line`,
      ).toBe('block');
    }
    expect(await first.innerText()).toContain('\n');
  });

  test('gives empty-state links an affordance the surrounding text does not have', async ({ page }) => {
    await signUpAndIn(page, 'empty');
    await page.goto(`${webBaseUrl}/student/applications`, { waitUntil: 'networkidle' });
    const empty = page.locator('.stu-empty').first();
    await expect(empty).toBeVisible();
    const link = empty.locator('a').first();
    await expect(link).toBeVisible();
    const [linkColor, textColor] = await Promise.all([
      link.evaluate((el) => getComputedStyle(el).color),
      empty.evaluate((el) => getComputedStyle(el).color),
    ]);
    expect(linkColor, 'a link must not be the same colour as the sentence').not.toBe(textColor);
    expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain('underline');
  });

  test('keeps every phone tab the same height', async ({ page }) => {
    await signUpAndIn(page, 'tabs');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${webBaseUrl}/student`, { waitUntil: 'networkidle' });
    const heights = await page.locator('.stu-tabbar a').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height)),
    );
    expect(heights.length).toBeGreaterThan(3);
    // One long label used to wrap and make its tab 18px taller than the rest.
    expect(new Set(heights).size, `tab heights: ${heights.join(',')}`).toBe(1);

    // The bar is fixed, so the page must reserve at least its height.
    const { barHeight, clearance } = await page.evaluate(() => ({
      barHeight: Math.round(document.querySelector('.stu-tabbar')!.getBoundingClientRect().height),
      clearance: parseFloat(getComputedStyle(document.querySelector('.stu-shell')!).paddingBottom),
    }));
    expect(clearance).toBeGreaterThanOrEqual(barHeight);
  });

  test('reaches account settings and deadlines on a phone', async ({ page }) => {
    await signUpAndIn(page, 'more');
    await page.setViewportSize({ width: 390, height: 844 });
    // The sidebar holds the account link and is hidden on a phone, so More has
    // to carry it; Deadlines shipped with no inbound link at all.
    await page.goto(`${webBaseUrl}/student/more`, { waitUntil: 'networkidle' });
    for (const [label, href] of [
      ['Your account', '/student/settings'],
      ['Upcoming deadlines', '/student/deadlines'],
    ]) {
      const link = page.locator(`.stu-card a[href="${href}"]`);
      await expect(link, `${label} is listed under More`).toHaveCount(1);
    }
    await page.locator('.stu-card a[href="/student/settings"]').click();
    await page.waitForURL('**/student/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  });

  test('makes the compare control a real target, not a bare 13px box', async ({ page }) => {
    const email = await signUpAndIn(page, 'compare');
    const token = await tokenFor(page, email);
    const { universityId } = await catalogue(page, token);
    test.skip(!universityId, 'no published university available to save');
    const saved = await page.request.post(
      `${apiBaseUrl}/api/v1/student/saved/universities/${universityId}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(saved.ok()).toBeTruthy();

    await page.goto(`${webBaseUrl}/student/saved`, { waitUntil: 'networkidle' });
    const choice = page.locator('.stu-choice').first();
    await expect(choice).toBeVisible();
    // Clicking the label — the actual target — must toggle the box, and that
    // target must be tall enough to hit.
    const height = await choice.evaluate((el) => Math.round(el.getBoundingClientRect().height));
    expect(height).toBeGreaterThanOrEqual(24);
    const input = choice.locator('input[type="checkbox"]');
    await expect(input).not.toBeChecked();
    await choice.click();
    await expect(input).toBeChecked();
  });
});
