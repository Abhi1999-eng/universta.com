/*
 * A deterministic, local-only rendered UI audit. This deliberately complements
 * the product E2E suite: it captures evidence (screenshots + measurable DOM
 * diagnostics) without turning subjective pixel diffs into a CI gate.
 *
 * Start the repository's normal local Web/API stack first, seed the explicit
 * demo catalogue, then run one of:
 *
 *   npm --workspace apps/admin run visual:qa:phase1
 *   npm --workspace apps/admin run visual:qa:phase2
 *   npm --workspace apps/admin run visual:qa:student
 *   npm --workspace apps/admin run visual:qa:all
 *
 * Generated evidence lives under <repo>/visual-qa and is ignored by git.
 */

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';

type Scope = 'phase1' | 'phase2' | 'student';

type RouteDefinition = {
  name: string;
  path: string;
  scope: Scope;
  requiresStudent?: boolean;
};

type Viewport = {
  name: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  width: number;
  height: number;
};

type PageDiagnostics = {
  horizontalOverflow: boolean;
  h1Count: number;
  clippedInteractiveElements: string[];
  smallTouchTargets: string[];
  overlappingControls: string[];
  missingImageAlt: number;
};

type Diagnostic = {
  route: string;
  viewport: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  screenshot: string;
  httpStatus: number | null;
  diagnostics: PageDiagnostics;
  consoleErrors: string[];
  failedRequests: string[];
  httpFailures: string[];
};

const webBaseUrl = (process.env.VISUAL_QA_WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const requestedScope = (process.argv[2] ?? 'all').toLowerCase();
const outputRoot = resolve(process.cwd(), '../..', 'visual-qa');

const viewports: Viewport[] = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'laptop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

// These paths are a finite inventory of product routes, not a crawler. The
// explicit local demo seed owns the fixture slugs, making the evidence stable.
const routeInventory: RouteDefinition[] = [
  { scope: 'phase1', name: 'home', path: '/' },
  { scope: 'phase1', name: 'countries-listing', path: '/countries' },
  { scope: 'phase1', name: 'country-detail', path: '/countries/canada' },
  { scope: 'phase1', name: 'country-cities', path: '/study-in/canada/cities' },
  { scope: 'phase1', name: 'universities-listing', path: '/universities' },
  { scope: 'phase1', name: 'university-detail', path: '/universities/northstar-demonstration-university' },
  { scope: 'phase1', name: 'university-courses', path: '/universities/northstar-demonstration-university/courses' },
  { scope: 'phase1', name: 'university-offering-detail', path: '/universities/northstar-demonstration-university/courses/northstar-demo-data-analytics' },
  { scope: 'phase1', name: 'subjects-listing', path: '/subjects' },
  { scope: 'phase1', name: 'subject-detail', path: '/subjects/computer-science' },
  { scope: 'phase1', name: 'subject-specializations', path: '/subjects/computer-science/specializations' },
  { scope: 'phase1', name: 'courses-listing', path: '/courses' },
  { scope: 'phase1', name: 'course-detail', path: '/courses/bachelor-computer-science' },
  { scope: 'phase1', name: 'scholarships-listing', path: '/scholarships' },
  { scope: 'phase1', name: 'scholarship-detail', path: '/scholarships/northstar-local-demo-scholarship' },
  { scope: 'phase1', name: 'consultants-listing', path: '/study-abroad-consultants' },
  { scope: 'phase1', name: 'consultant-detail', path: '/study-abroad-consultants/lakeside-demo-consultant' },
  { scope: 'phase1', name: 'consultant-location', path: '/study-abroad-consultants/locations/demo-harbour' },
  { scope: 'phase1', name: 'events-listing', path: '/events' },
  { scope: 'phase1', name: 'event-detail', path: '/events/local-demo-campus-session' },
  { scope: 'phase1', name: 'success-stories-listing', path: '/success-stories' },
  { scope: 'phase1', name: 'success-story-detail', path: '/success-stories/local-demo-story-ember' },
  { scope: 'phase1', name: 'testimonials', path: '/testimonials' },
  { scope: 'phase1', name: 'careers', path: '/careers' },
  { scope: 'phase1', name: 'about', path: '/about' },
  { scope: 'phase1', name: 'contact', path: '/contact' },
  { scope: 'phase1', name: 'counselling', path: '/counselling' },
  { scope: 'phase1', name: 'faq', path: '/faq' },
  { scope: 'phase1', name: 'compare-countries', path: '/compare/countries?items=canada,united-kingdom,australia' },
  { scope: 'phase1', name: 'compare-universities', path: '/compare/universities?items=northstar-demonstration-university,ember-demo-institute,lakeside-demo-university' },
  { scope: 'phase1', name: 'compare-courses', path: '/compare/courses?items=northstar-demo-data-analytics,lakeside-demo-software-systems,ember-demo-sustainable-business' },
  { scope: 'phase1', name: 'compare-consultants', path: '/compare/consultants?items=lakeside-demo-consultant,ember-demo-consultant,universta-demo-guidance' },
  { scope: 'phase2', name: 'student-login', path: '/student/login' },
  { scope: 'phase2', name: 'student-register', path: '/student/register' },
  { scope: 'phase2', name: 'student-forgot-password', path: '/student/forgot-password' },
  { scope: 'phase2', name: 'student-reset-password', path: '/student/reset-password' },
  { scope: 'phase2', name: 'student-verify-email', path: '/student/verify-email' },
  { scope: 'student', name: 'student-dashboard', path: '/student', requiresStudent: true },
  { scope: 'student', name: 'student-profile', path: '/student/profile', requiresStudent: true },
  { scope: 'student', name: 'student-onboarding', path: '/student/onboarding', requiresStudent: true },
  { scope: 'student', name: 'student-applications', path: '/student/applications', requiresStudent: true },
  { scope: 'student', name: 'student-deadlines', path: '/student/deadlines', requiresStudent: true },
  { scope: 'student', name: 'student-documents', path: '/student/documents', requiresStudent: true },
  { scope: 'student', name: 'student-messages', path: '/student/messages', requiresStudent: true },
  { scope: 'student', name: 'student-recommendations', path: '/student/recommendations', requiresStudent: true },
  { scope: 'student', name: 'student-saved', path: '/student/saved', requiresStudent: true },
  { scope: 'student', name: 'student-scholarships', path: '/student/scholarships', requiresStudent: true },
  { scope: 'student', name: 'student-referrals', path: '/student/referrals', requiresStudent: true },
  { scope: 'student', name: 'student-notifications', path: '/student/notifications', requiresStudent: true },
  { scope: 'student', name: 'student-support', path: '/student/support', requiresStudent: true },
  { scope: 'student', name: 'student-settings', path: '/student/settings', requiresStudent: true },
  { scope: 'student', name: 'student-more', path: '/student/more', requiresStudent: true },
];

function selectedScopes(): Scope[] {
  if (requestedScope === 'all') return ['phase1', 'phase2', 'student'];
  if (requestedScope === 'phase1' || requestedScope === 'phase2' || requestedScope === 'student') {
    return [requestedScope];
  }
  throw new Error(`Unknown visual QA scope "${requestedScope}". Use phase1, phase2, student, or all.`);
}

function slug(value: string) {
  return value.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
}

function routeDirectory(route: RouteDefinition) {
  return route.scope === 'student' ? 'student-dashboard' : route.scope;
}

function isCriticalResponse(url: string, status: number) {
  if (status < 400) return false;
  const target = new URL(url);
  return target.origin === webBaseUrl || target.pathname.startsWith('/api/');
}

async function createLocalStudent(context: BrowserContext) {
  const page = await context.newPage();
  const email = `visual.qa.${Date.now()}.${randomBytes(4).toString('hex')}@example.test`;
  const password = `VisualQa-${randomBytes(18).toString('base64url')}`;
  await page.goto(`${webBaseUrl}/student/register`, { waitUntil: 'networkidle' });
  await page.getByLabel('First name').fill('Visual QA');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor({ timeout: 20_000 });
  await page.goto(`${webBaseUrl}/student/login?returnTo=%2Fstudent`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${webBaseUrl}/student`, { timeout: 20_000 });
  await page.close();
}

async function auditRoute(
  page: Page,
  route: RouteDefinition,
  viewport: Viewport,
): Promise<Diagnostic> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const httpFailures: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onRequestFailed = (request: { method(): string; url(): string; failure(): { errorText?: string } | null }) => {
    const failure = request.failure()?.errorText ?? 'unknown failure';
    const target = new URL(request.url());
    const intentionalRscCancellation = target.searchParams.has('_rsc') && /ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure);
    if (!intentionalRscCancellation) failedRequests.push(`${request.method()} ${request.url()} (${failure})`);
  };
  const onResponse = (response: { status(): number; url(): string; request(): { method(): string } }) => {
    if (isCriticalResponse(response.url(), response.status())) {
      httpFailures.push(`${response.request().method()} ${response.status()} ${response.url()}`);
    }
  };
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const response = await page.goto(`${webBaseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 45_000 });
  // A string deliberately avoids a transpiler helper leaking into the browser
  // realm when this TypeScript runner is executed through tsx.
  const metrics = await page.evaluate(`(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const describe = (element) => \
      element.tagName.toLowerCase() + ':' + ((element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80));
    const inViewport = (element) => {
      const box = element.getBoundingClientRect();
      return box.bottom > 0 && box.top < viewportHeight && box.right > 0 && box.left < viewportWidth;
    };
    const insideIntentionalHorizontalScroller = (element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth + 1) {
          return true;
        }
      }
      return false;
    };
    const controls = [...document.querySelectorAll('a,button,input,select,textarea')].filter(visible).filter(inViewport);
    const clippedInteractiveElements = controls
      .filter((element) => !insideIntentionalHorizontalScroller(element))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.left < -1 || box.right > viewportWidth + 1;
      })
      .slice(0, 10)
      .map(describe);
    // Inline prose links are not standalone tap targets; only controls with a
    // dedicated widget role belong in this diagnostic.
    const smallTouchTargets = window.innerWidth > 700 ? [] : controls
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const tag = element.tagName.toLowerCase();
        return (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') && (box.width < 32 || box.height < 32);
      })
      .slice(0, 10)
      .map(describe);
    const headerControls = [...document.querySelectorAll('header a,header button')]
      .filter(visible)
      .filter(inViewport)
      .filter((element) => element.getBoundingClientRect().width > 1);
    const overlappingControls = [];
    for (let first = 0; first < headerControls.length; first += 1) {
      const a = headerControls[first];
      const aBox = a.getBoundingClientRect();
      for (let second = first + 1; second < headerControls.length; second += 1) {
        const b = headerControls[second];
        const bBox = b.getBoundingClientRect();
        const overlapWidth = Math.min(aBox.right, bBox.right) - Math.max(aBox.left, bBox.left);
        const overlapHeight = Math.min(aBox.bottom, bBox.bottom) - Math.max(aBox.top, bBox.top);
        if (overlapWidth > 2 && overlapHeight > 2) {
          overlappingControls.push(describe(a) + ' ↔ ' + describe(b));
        }
      }
    }
    return {
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      h1Count: document.querySelectorAll('main h1').length,
      clippedInteractiveElements,
      smallTouchTargets,
      overlappingControls: overlappingControls.slice(0, 10),
      missingImageAlt: [...document.images].filter((image) => !image.alt.trim()).length,
    };
  })()`) as PageDiagnostics;

  const relativeScreenshot = `${routeDirectory(route)}/${slug(route.name)}-${viewport.name}-${viewport.width}.png`;
  await page.screenshot({ path: resolve(outputRoot, relativeScreenshot), fullPage: true });

  page.off('console', onConsole);
  page.off('requestfailed', onRequestFailed);
  page.off('response', onResponse);

  const status =
    !response || response.status() >= 500 || consoleErrors.length || failedRequests.length || httpFailures.length
      ? 'FAIL'
      : metrics.horizontalOverflow || metrics.clippedInteractiveElements.length || metrics.smallTouchTargets.length || metrics.overlappingControls.length || metrics.h1Count !== 1
        ? 'WARN'
        : 'PASS';
  return {
    route: route.path,
    viewport: viewport.name,
    status,
    screenshot: relativeScreenshot,
    httpStatus: response?.status() ?? null,
    diagnostics: metrics,
    consoleErrors,
    failedRequests,
    httpFailures,
  };
}

async function main() {
  const scopes = selectedScopes();
  const routes = routeInventory.filter((route) => scopes.includes(route.scope));
  const startedAt = new Date().toISOString();
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([...new Set(routes.map(routeDirectory))].map((directory) => mkdir(resolve(outputRoot, directory), { recursive: true })));

  const browser = await chromium.launch({ headless: true });
  const publicContext = await browser.newContext();
  const studentContext = await browser.newContext();
  if (routes.some((route) => route.requiresStudent)) await createLocalStudent(studentContext);

  const results: Diagnostic[] = [];
  for (const route of routes) {
    for (const viewport of viewports) {
      const context = route.requiresStudent ? studentContext : publicContext;
      const page = await context.newPage();
      try {
        results.push(await auditRoute(page, route, viewport));
      } catch (error) {
        const relativeScreenshot = `${routeDirectory(route)}/${slug(route.name)}-${viewport.name}-${viewport.width}.png`;
        await page.screenshot({ path: resolve(outputRoot, relativeScreenshot), fullPage: true }).catch(() => undefined);
        results.push({
          route: route.path,
          viewport: viewport.name,
          status: 'FAIL',
          screenshot: relativeScreenshot,
          httpStatus: null,
          diagnostics: { horizontalOverflow: false, h1Count: 0, clippedInteractiveElements: [], smallTouchTargets: [], overlappingControls: [], missingImageAlt: 0 },
          consoleErrors: [],
          failedRequests: [],
          httpFailures: [error instanceof Error ? error.message : String(error)],
        });
      } finally {
        await page.close();
      }
    }
  }

  await publicContext.close();
  await studentContext.close();
  await browser.close();

  const report = {
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl: webBaseUrl,
    scopes,
    routeCount: routes.length,
    renderCount: results.length,
    summary: {
      pass: results.filter((result) => result.status === 'PASS').length,
      warn: results.filter((result) => result.status === 'WARN').length,
      fail: results.filter((result) => result.status === 'FAIL').length,
    },
    results,
  };
  await writeFile(resolve(outputRoot, 'visual-qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
