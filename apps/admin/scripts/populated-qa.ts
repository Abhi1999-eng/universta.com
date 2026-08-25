/*
 * Populated-data UI acceptance.
 *
 * `visual-qa.ts` proves a route renders, fits its viewport and stays quiet in
 * the console. This complements it with the class of defect that only real
 * seeded content exposes and that empty fixtures hide: text that outgrows its
 * box, cards in one grid that drift to different heights, images whose real
 * aspect ratio does not match the frame they are cropped into, rich text that
 * escapes its container, tables with no scroller, and template variables that
 * were never substituted.
 *
 * Route slugs are resolved from the running API, or from an agent handoff
 * manifest when one is present, so the same run works against a local seed and
 * against the deployed demo dataset without editing this file.
 *
 *   npx tsx scripts/populated-qa.ts [phase1|student|all]
 *
 * Evidence lands in <repo>/visual-qa/populated and is ignored by git.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  chromium,
  type Browser,
  type ConsoleMessage,
  type Page,
  type Response,
} from '@playwright/test';

const webBaseUrl = (process.env.VISUAL_QA_WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const apiBaseUrl = (process.env.VISUAL_QA_API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const manifestPath = process.env.QA_MANIFEST_PATH ?? '';
const studentEmail = process.env.QA_STUDENT_EMAIL ?? '';
const studentPassword = process.env.QA_STUDENT_PASSWORD ?? '';
const scope = (process.argv[2] ?? 'all').toLowerCase();
const outputRoot = resolve(process.cwd(), '../..', 'visual-qa', 'populated');

type Viewport = { name: string; width: number; height: number };
const viewports: Viewport[] = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'laptop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

type Route = { name: string; path: string; scope: 'phase1' | 'student' };
type Row = Record<string, unknown>;
type Manifest = Record<string, unknown> | null;

async function api<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBaseUrl}${path}`);
    if (!res.ok) return null;
    return ((await res.json()) as { data?: T }).data ?? null;
  } catch {
    return null;
  }
}

const slugOf = (row: Row) => String(row.slug ?? row.id ?? '');

/** Real slugs, preferring an agent handoff manifest when one is supplied. */
async function resolveRoutes(): Promise<{ routes: Route[]; source: string; manifest: Manifest }> {
  let manifest: Manifest = null;
  if (manifestPath && existsSync(manifestPath)) {
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { manifest = null; }
  }
  const pick = (fromManifest: unknown, fallback: string[]): string[] => {
    const list = Array.isArray(fromManifest) ? fromManifest.map(String).filter(Boolean) : [];
    return list.length ? list : fallback;
  };

  const [countries, unis, subjects, courses, scholarships, consultants, events, stories] = await Promise.all([
    api<Row[]>('/api/v1/countries?limit=50'),
    api<Row[]>('/api/v1/phase1/universities?limit=20'),
    api<Row[]>('/api/v1/subjects?limit=20'),
    api<Row[]>('/api/v1/courses?limit=20'),
    api<Row[]>('/api/v1/phase1/scholarships?limit=20'),
    api<Row[]>('/api/v1/phase1/consultants?limit=20'),
    api<Row[]>('/api/v1/phase1/events?limit=20'),
    api<Row[]>('/api/v1/phase1/success-stories?limit=20'),
  ]);

  // Longest names first: the ones most likely to break a card or a heading.
  const byLongestName = (rows: Row[] | null) =>
    (rows ?? [])
      .slice()
      .sort(
        (a, b) =>
          String(b.name ?? b.title ?? '').length -
          String(a.name ?? a.title ?? '').length,
      );

  const countrySlugs = pick(manifest?.countries, byLongestName(countries).slice(0, 3).map(slugOf));
  const uniSlugs = pick(manifest?.universities, byLongestName(unis).slice(0, 3).map(slugOf));
  const subjectSlugs = pick(manifest?.subjects, byLongestName(subjects).slice(0, 2).map(slugOf));
  const courseSlugs = pick(manifest?.courses, byLongestName(courses).slice(0, 2).map(slugOf));
  const scholarshipSlugs = pick(manifest?.scholarships, byLongestName(scholarships).slice(0, 2).map(slugOf));
  const consultantSlugs = pick(manifest?.consultants, byLongestName(consultants).slice(0, 2).map(slugOf));
  const eventSlugs = pick(manifest?.events, byLongestName(events).slice(0, 2).map(slugOf));
  const storySlugs = pick(manifest?.successStories, byLongestName(stories).slice(0, 2).map(slugOf));

  // Offerings hang off a university, so they are resolved per university.
  const offerings: Array<{ uni: string; offering: string }> = [];
  for (const uni of uniSlugs.slice(0, 2)) {
    const payload = await api<Row[] | { data?: Row[] }>(
      `/api/v1/phase1/universities/${uni}/courses?limit=10`,
    );
    const rows: Row[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
    for (const row of byLongestName(rows).slice(0, 2)) offerings.push({ uni, offering: slugOf(row) });
  }

  const routes: Route[] = [
    { scope: 'phase1', name: 'home', path: '/' },
    { scope: 'phase1', name: 'countries-listing', path: '/countries' },
    { scope: 'phase1', name: 'universities-listing', path: '/universities' },
    { scope: 'phase1', name: 'courses-listing', path: '/courses' },
    { scope: 'phase1', name: 'subjects-listing', path: '/subjects' },
    { scope: 'phase1', name: 'scholarships-listing', path: '/scholarships' },
    { scope: 'phase1', name: 'consultants-listing', path: '/study-abroad-consultants' },
    { scope: 'phase1', name: 'events-listing', path: '/events' },
    { scope: 'phase1', name: 'success-stories-listing', path: '/success-stories' },
    { scope: 'phase1', name: 'testimonials', path: '/testimonials' },
    { scope: 'phase1', name: 'cities-listing', path: '/cities' },
    { scope: 'phase1', name: 'careers', path: '/careers' },
  ];
  countrySlugs.forEach((s, i) => {
    routes.push({ scope: 'phase1', name: `country-detail-${i}-${s}`, path: `/countries/${s}` });
    routes.push({ scope: 'phase1', name: `study-in-${i}-${s}`, path: `/study-in/${s}` });
    routes.push({ scope: 'phase1', name: `country-cities-${i}-${s}`, path: `/study-in/${s}/cities` });
  });
  uniSlugs.forEach((s, i) => {
    routes.push({ scope: 'phase1', name: `university-detail-${i}-${s}`, path: `/universities/${s}` });
    routes.push({ scope: 'phase1', name: `university-courses-${i}-${s}`, path: `/universities/${s}/courses` });
  });
  offerings.forEach(({ uni, offering }, i) =>
    routes.push({ scope: 'phase1', name: `offering-detail-${i}-${offering}`, path: `/universities/${uni}/courses/${offering}` }));
  subjectSlugs.forEach((s, i) => {
    routes.push({ scope: 'phase1', name: `subject-detail-${i}-${s}`, path: `/subjects/${s}` });
    routes.push({ scope: 'phase1', name: `subject-specializations-${i}-${s}`, path: `/subjects/${s}/specializations` });
  });
  courseSlugs.forEach((s, i) => routes.push({ scope: 'phase1', name: `course-detail-${i}-${s}`, path: `/courses/${s}` }));
  scholarshipSlugs.forEach((s, i) => routes.push({ scope: 'phase1', name: `scholarship-detail-${i}-${s}`, path: `/scholarships/${s}` }));
  consultantSlugs.forEach((s, i) => routes.push({ scope: 'phase1', name: `consultant-detail-${i}-${s}`, path: `/study-abroad-consultants/${s}` }));
  eventSlugs.forEach((s, i) => routes.push({ scope: 'phase1', name: `event-detail-${i}-${s}`, path: `/events/${s}` }));
  storySlugs.forEach((s, i) => routes.push({ scope: 'phase1', name: `success-story-${i}-${s}`, path: `/success-stories/${s}` }));

  for (const [name, path] of [
    ['home', '/student'], ['applications', '/student/applications'], ['saved', '/student/saved'],
    ['scholarships', '/student/scholarships'], ['deadlines', '/student/deadlines'],
    ['recommendations', '/student/recommendations'], ['documents', '/student/documents'],
    ['messages', '/student/messages'], ['notifications', '/student/notifications'],
    ['support', '/student/support'], ['referrals', '/student/referrals'],
    ['profile', '/student/profile'], ['settings', '/student/settings'],
    ['more', '/student/more'], ['onboarding', '/student/onboarding'],
  ] as [string, string][]) routes.push({ scope: 'student', name: `student-${name}`, path });

  return { routes, source: manifest ? 'manifest' : 'api', manifest };
}

/** Everything measured in the page realm. Written as a string so tsx helpers
 * never leak into the browser. */
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const text = document.body.innerText || '';
  const rawTokens = [];
  for (const bad of ['undefined', 'NaN', '[object Object]']) if (text.includes(bad)) rawTokens.push(bad);
  if (/(^|[\\s>(])null([\\s<).,]|$)/.test(text)) rawTokens.push('null');
  const variableTokens = (text.match(/\\{\\{[^}]{1,40}\\}\\}|%%[A-Za-z0-9_]{1,40}%%|\\$\\{[^}]{1,40}\\}/g) || []).slice(0, 6);

  const visible = (el) => {
    const s = getComputedStyle(el); const b = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0;
  };
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0,2).join('.') : '');

  // text that paints outside its own box
  const overflowingText = [];
  document.querySelectorAll('h1,h2,h3,h4,p,span,a,li,td,th,div').forEach((el) => {
    if (!visible(el)) return;
    if (el.children.length > 0) return;
    const s = getComputedStyle(el);
    if (s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowX === 'auto' || s.overflowX === 'scroll') return;
    if (el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== 'ellipsis' && s.whiteSpace !== 'nowrap') {
      overflowingText.push(label(el) + ' scrollW=' + el.scrollWidth + ' clientW=' + el.clientWidth + ' "' + (el.textContent||'').trim().slice(0,40) + '"');
    }
  });

  // sibling cards in one grid/flex row that differ in height
  const cardDrift = [];
  document.querySelectorAll('ul,ol,div,section').forEach((container) => {
    const s = getComputedStyle(container);
    if (s.display !== 'grid' && s.display !== 'flex') return;
    if (s.display === 'flex' && s.flexWrap === 'nowrap' && s.flexDirection.startsWith('row')) return;
    const kids = [...container.children].filter(visible);
    if (kids.length < 2) return;
    const boxes = kids.map((k) => k.getBoundingClientRect());
    const tops = new Set(boxes.map((b) => Math.round(b.top)));
    // only compare items that sit on the same visual row
    tops.forEach((top) => {
      const row = boxes.filter((b) => Math.abs(Math.round(b.top) - top) <= 2);
      if (row.length < 2) return;
      const heights = row.map((b) => Math.round(b.height));
      const spread = Math.max(...heights) - Math.min(...heights);
      if (spread > 24) cardDrift.push(label(container) + ' row@' + top + ' heights=' + heights.join(',') + ' spread=' + spread);
    });
  });

  // images: broken, distorted, or unrendered
  const images = [...document.images].filter(visible).map((img) => {
    const b = img.getBoundingClientRect();
    const fit = getComputedStyle(img).objectFit;
    const naturalRatio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
    const renderedRatio = b.width && b.height ? b.width / b.height : null;
    const distorted = fit === 'fill' && naturalRatio && renderedRatio
      ? Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.12 : false;
    return {
      src: (img.currentSrc || img.src || '').slice(-70),
      broken: img.complete && img.naturalWidth === 0,
      distorted, fit, alt: img.alt || '',
      natural: img.naturalWidth + 'x' + img.naturalHeight,
      rendered: Math.round(b.width) + 'x' + Math.round(b.height),
    };
  });

  // tables that exceed their container without a scroller
  const tableOverflow = [];
  document.querySelectorAll('table').forEach((t) => {
    if (!visible(t)) return;
    let scroller = null;
    for (let p = t.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') { scroller = p; break; }
    }
    const b = t.getBoundingClientRect();
    if (!scroller && b.right > vw + 1) tableOverflow.push(label(t) + ' right=' + Math.round(b.right) + ' vw=' + vw);
  });

  // rich text escaping its container
  const richOverflow = [];
  document.querySelectorAll('[class*="rich"],[class*="prose"],[class*="content"],[class*="body"]').forEach((el) => {
    if (!visible(el)) return;
    const b = el.getBoundingClientRect();
    if (b.right > vw + 1 || el.scrollWidth > el.clientWidth + 2) {
      richOverflow.push(label(el) + ' scrollW=' + el.scrollWidth + ' clientW=' + el.clientWidth);
    }
  });

  // heading order inside main
  const main = document.querySelector('main') || document.body;
  const levels = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
  let headingSkip = null;
  for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i-1] > 1) { headingSkip = 'h' + levels[i-1] + '->h' + levels[i]; break; }

  // fixed/sticky elements covering interactive content
  const stickyCollisions = [];
  const fixed = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el); return (s.position === 'fixed' || s.position === 'sticky') && visible(el);
  });
  fixed.forEach((f) => {
    const fb = f.getBoundingClientRect();
    if (fb.height > window.innerHeight * 0.9) return;
    document.querySelectorAll('a,button').forEach((c) => {
      if (f.contains(c) || !visible(c)) return;
      const cb = c.getBoundingClientRect();
      const ox = Math.min(fb.right, cb.right) - Math.max(fb.left, cb.left);
      const oy = Math.min(fb.bottom, cb.bottom) - Math.max(fb.top, cb.top);
      if (ox > 4 && oy > Math.min(cb.height, 12)) stickyCollisions.push(label(f) + ' covers ' + label(c) + ' "' + (c.textContent||'').trim().slice(0,24) + '"');
    });
  });

  return {
    rawTokens, variableTokens,
    overflowingText: overflowingText.slice(0, 8),
    cardDrift: [...new Set(cardDrift)].slice(0, 8),
    images, tableOverflow, richOverflow: [...new Set(richOverflow)].slice(0, 5),
    headingSkip, h1Count: main.querySelectorAll('h1').length,
    stickyCollisions: [...new Set(stickyCollisions)].slice(0, 6),
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    textLength: text.length,
  };
})()`;

async function signInStudent(page: Page) {
  if (!studentEmail || !studentPassword) return false;
  await page.goto(`${webBaseUrl}/student/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(studentEmail);
  await page.getByLabel('Password').fill(studentPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  try { await page.waitForURL(/\/student(\?|$)/, { timeout: 25_000 }); return true; }
  catch { return false; }
}

async function main() {
  const { routes: allRoutes, source, manifest } = await resolveRoutes();
  const wanted = scope === 'all' ? ['phase1', 'student'] : [scope];
  const routes = allRoutes.filter((r) => wanted.includes(r.scope));
  await mkdir(outputRoot, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let studentReady = false;
  if (wanted.includes('student')) studentReady = await signInStudent(page);

  const findings: Row[] = [];
  for (const route of routes) {
    if (route.scope === 'student' && !studentReady) continue;
    for (const vp of viewports) {
      const consoleErrors: string[] = [];
      const httpFailures: string[] = [];
      const onConsole = (m: ConsoleMessage) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
      };
      const onResponse = (r: Response) => {
        const u = new URL(r.url());
        if (r.status() >= 400 && (u.origin === webBaseUrl || u.pathname.startsWith('/api/'))) {
          httpFailures.push(`${r.status()} ${r.request().method()} ${u.pathname}`);
        }
      };
      page.on('console', onConsole); page.on('response', onResponse);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      let httpStatus: number | null = null;
      try {
        const res = await page.goto(`${webBaseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 45_000 });
        httpStatus = res?.status() ?? null;
      } catch { httpStatus = null; }
      await page.waitForTimeout(300);
      let probe: Row = {};
      try {
        probe = (await page.evaluate(PROBE)) as Row;
      } catch (e) {
        probe = { evalError: String(e).slice(0, 200) };
      }
      const shot = `${route.name}-${vp.name}.png`;
      await mkdir(dirname(resolve(outputRoot, shot)), { recursive: true });
      await page.screenshot({ path: resolve(outputRoot, shot), fullPage: true }).catch(() => undefined);
      findings.push({ route: route.name, path: route.path, scope: route.scope, viewport: vp.name, httpStatus, screenshot: shot, consoleErrors, httpFailures, ...probe });
      page.off('console', onConsole); page.off('response', onResponse);
    }
  }

  await browser.close();
  await writeFile(resolve(outputRoot, 'findings.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), webBaseUrl, apiBaseUrl,
    slugSource: source, datasetMarker: manifest?.datasetMarker ?? null,
    studentSignedIn: studentReady, routeCount: routes.length, renders: findings.length, findings,
  }, null, 2));
  console.log(`populated-qa: ${routes.length} routes x ${viewports.length} viewports = ${findings.length} renders`);
  console.log(`slug source: ${source}; student signed in: ${studentReady}`);
  console.log(`evidence: ${resolve(outputRoot, 'findings.json')}`);
}

void main();
