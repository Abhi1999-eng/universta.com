import { expect, test, type Page } from '@playwright/test';
import { webBaseUrl } from './helpers/e2e-urls';

/**
 * The student portal, walked the way a student walks it: register, sign in,
 * onboard, upload, and out. Also proves the boundaries that matter — an
 * anonymous visitor is turned away, and a student cannot reach the Admin.
 */

const password = 'StudentPass123x';

function newEmail(tag: string) {
  return `p2a.web.${tag}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
}

async function registerAndSignIn(
  page: Page,
  email: string,
  returnTo = '/student',
) {
  await page.goto(`${webBaseUrl}/student/register`);
  await page.getByLabel('First name').fill('Rahul');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(
    `${webBaseUrl}/student/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${webBaseUrl}${returnTo}`);
}

test.describe('student portal', () => {
  test('keeps public navigation normal for visitors without a student session', async ({
    page,
  }) => {
    const studentAuthFailures: string[] = [];
    const studentAuthRequests: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith('/api/student/auth/')) {
        studentAuthRequests.push(pathname);
      }
    });
    page.on('response', (response) => {
      if (
        new URL(response.url()).pathname.startsWith('/api/student/auth/') &&
        response.status() >= 400
      ) {
        studentAuthFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto(`${webBaseUrl}/universities`);
    await expect(page.locator('.usta-header')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'My Dashboard' }),
    ).toHaveCount(0);
    await expect.poll(() => studentAuthFailures).toEqual([]);
    expect(studentAuthRequests).toContain('/api/student/auth/session');
    expect(studentAuthRequests).not.toContain('/api/student/auth/me');
    expect(studentAuthRequests).not.toContain('/api/student/auth/refresh');
  });

  test('sends anonymous visitors to sign in', async ({ page }) => {
    for (const route of ['/student', '/student/profile', '/student/documents']) {
      await page.goto(`${webBaseUrl}${route}`);
      await expect(page).toHaveURL(/\/student\/login$/);
    }
  });

  test('registers, signs in, and shows one clear next step', async ({ page }) => {
    await registerAndSignIn(page, newEmail('home'));

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Welcome back',
    );
    // Completion comes from the API; a brand new profile has done nothing yet.
    await expect(page.getByText('0%')).toBeVisible();
    await expect(page.getByText(/Next step:/)).toBeVisible();
    // Applications are now a shipped journey: the dashboard count must lead to
    // the student's own application list rather than a placeholder.
    const applications = page.getByRole('link', { name: '0 applications' });
    await expect(applications).toBeVisible();
    await applications.click();
    await expect(page).toHaveURL(/\/student\/applications$/);
    await expect(
      page.getByRole('heading', { name: 'My applications' }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('keeps public discovery connected to the student dashboard', async ({
    page,
  }) => {
    await registerAndSignIn(page, newEmail('public'), '/universities');
    await expect(page.locator('.usta-header')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'My Dashboard' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Open student account menu' })
      .click();
    for (const name of ['Dashboard', 'Applications', 'Profile', 'Documents']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'My Dashboard' }).click();
    await expect(page).toHaveURL(/\/student$/);
    await page.goto(`${webBaseUrl}/universities`);
    await page
      .getByRole('button', { name: 'Open student account menu' })
      .click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(
      page.getByRole('link', { name: 'My Dashboard' }),
    ).toHaveCount(0);
  });

  test('uses safe return paths and falls back from external ones', async ({
    page,
  }) => {
    const email = newEmail('return');
    await page.goto(`${webBaseUrl}/student/register`);
    await page.getByLabel('First name').fill('Rahul');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.goto(
      `${webBaseUrl}/student/login?returnTo=https%3A%2F%2Fexample.invalid`,
    );
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/student$/);
  });

  test('walks onboarding and moves the completion the server reports', async ({
    page,
  }) => {
    await registerAndSignIn(page, newEmail('onboard'));
    await page.goto(`${webBaseUrl}/student/onboarding`);
    await expect(
      page.getByRole('heading', { name: 'Let’s build your study profile' }),
    ).toBeVisible();

    // Step 1 — personal details.
    await page.getByLabel('Date of birth').fill('2003-04-17');
    await page.getByLabel('Nationality').selectOption({ index: 1 });
    await page.getByLabel('Where you live now').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.getByText('Personal details saved.')).toBeVisible();

    // Step 2 — study preferences.
    await expect(
      page.getByRole('heading', { name: 'Study preferences' }),
    ).toBeVisible();
    await page.getByLabel('What do you want to study?').selectOption({ index: 1 });
    await page.getByLabel('Which degree?').selectOption({ index: 1 });
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.getByText('Study preferences saved.')).toBeVisible();

    // Step 3 — education.
    await page.getByLabel('Highest qualification').fill('Bachelor of Science');
    await page.getByLabel('School or university').fill('Demo College');
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await expect(page.getByText('Qualification added.')).toBeVisible();

    // The server decides the number; the page only shows it.
    await expect(page.getByText(/Profile \d+% complete/)).toBeVisible();
    await page.goto(`${webBaseUrl}/student`);
    await expect(page.getByText('0%')).toHaveCount(0);
  });

  test('keeps documents as a checklist and uploads one', async ({ page }) => {
    await registerAndSignIn(page, newEmail('docs'));
    await page.goto(`${webBaseUrl}/student/documents`);

    await expect(page.getByRole('heading', { name: 'Your documents' })).toBeVisible();
    for (const label of ['Passport', 'Resume', 'Statement of purpose']) {
      await expect(page.getByRole('heading', { name: label })).toBeVisible();
    }
    // A checklist, not a file manager.
    await expect(page.locator('table')).toHaveCount(0);

    await page.locator('#upload-RESUME').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 demo'),
    });
    await expect(page.getByText('resume.pdf')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Replace' }).first(),
    ).toBeVisible();
  });

  test('signs out and stops serving the portal', async ({ page }) => {
    await registerAndSignIn(page, newEmail('out'));
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page).toHaveURL(/\/student\/login$/);

    await page.goto(`${webBaseUrl}/student/profile`);
    await expect(page).toHaveURL(/\/student\/login$/);
  });

  test('a student session is not an admin session', async ({ page }) => {
    const email = newEmail('boundary');
    await registerAndSignIn(page, email);

    // The student's own API answers; the admin API does not.
    const mine = await page.request.get(`${webBaseUrl}/api/student/auth/me`);
    expect([200, 401]).toContain(mine.status());

    const adminApi = await page.request.get(
      `${webBaseUrl}/api/student/../admin/media`,
    );
    expect(adminApi.status()).not.toBe(200);
  });

  test('fits a phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerAndSignIn(page, newEmail('mobile'));

    for (const route of [
      '/student',
      '/student/profile',
      '/student/documents',
      '/student/onboarding',
      '/student/settings',
    ]) {
      await page.goto(`${webBaseUrl}${route}`);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        `${route} must not scroll sideways at 390px`,
      ).toBe(true);
      await expect(page.locator('h1')).toHaveCount(1);
    }
    // The phone gets a bottom bar, not a shrunken sidebar.
    await expect(page.locator('.stu-tabbar')).toBeVisible();
    await page.goto(`${webBaseUrl}/universities`);
    await expect(
      page.getByRole('link', { name: 'My Dashboard' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      'public header must not scroll sideways at 390px',
    ).toBe(true);
    await page.getByRole('link', { name: 'My Dashboard' }).click();
    await expect(page).toHaveURL(/\/student$/);
  });
});
