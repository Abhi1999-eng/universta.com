# Phase 1 deep local manual-demo and exploratory UAT

## 1. Environment

- Date: 2026-07-28.
- Repository: `/Users/abhishekchaubey/projects/universta-phase1-leads`
- Branch: `feat/phase1-expanded-local`
- Starting revision (prior handoff): `876c0bde51a35bd82960068f4faa226c23dbcbf3`
- Revision at the start of this final pass: `ab657f10078f95a0ea7c4c6742b25543f1f17aa0` (working tree clean; the two commits ahead of the prior handoff — `fix(web): resolve phase1 public demo issues` and `test(phase1): cover manual uat regressions` — were inspected and are legitimate continuations of the manual UAT recorded below, not unexpected drift).
- Scope: local API (`127.0.0.1:4000`), Web (`localhost:3000`), Admin (`localhost:3001`) and local MySQL only.
- Browser contexts: fresh desktop (1440×900) and mobile (390×844); tablet behavior is covered by the existing responsive Playwright suite.

## 2. Demo data counts

`PASS` — repeated explicit demo seed remained idempotent:

| Entity | Count |
| --- | ---: |
| Universities / campuses / offerings | 3 / 4 / 8 |
| Scholarships | 5 |
| Consultants / locations | 4 / 3 |
| Jobs / events | 3 / 4 |
| Success stories / testimonials | 3 / 5 |

The deployment/startup/migration paths contain no automatic demo-catalog seed. CI alone explicitly enables the isolated demo seed.

## 3. Routes tested

`PASS` — loaded in a fresh desktop browser without an application error boundary: `/`, `/about`, `/contact`, `/faq`, `/counselling`, `/countries`, `/countries/canada`, `/subjects`, `/subjects/computer-science`, `/subjects/computer-science/specializations`, `/courses`, a generic course detail, the four-level course discovery route, University list/detail/course-list/offering-detail, Scholarship list/detail, Consultant list/detail/location, Careers list/detail, Events list/detail, Success stories, Testimonials, and all four comparison routes.

## 4. Manual workflow matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Global navigation, logo, header/footer links | PASS | Fresh browser walkthrough; no `#` or empty visible links found. |
| Homepage/editorial pages | PASS | Home, About and FAQ rendered with a single primary H1 and working discovery/counselling links. |
| Contact enquiry | PASS | Valid fictional contact submitted on `localhost`; success state shown. |
| Contact-to-Lead | PASS | New UI E2E covers visible inquiry, idempotent conversion, disabled repeat action and single Lead. |
| Counselling lead | PASS | Contextual Canada request submitted manually with success state and no console error. |
| Catalog search/filter/history/pagination | PASS | Existing browser tests plus direct URL, Back/Forward and normalized legacy redirect walkthrough. |
| Admin structured CRUD/publish | PASS | Existing eight-resource visible UI suite exercises validation, reload, relations, publish/unpublish and archive confirmation. |
| Invalid/malformed detail routes | PASS | Direct browser checks returned noindex 404s without an app error boundary. |
| API-unavailable error state | PARTIAL | Existing route failure handling was inspected through supported flows; destructive service interruption was not used during the final clean regression. |

## 5. Public page and filter/search matrix

| Surface | Status | Notes |
| --- | --- | --- |
| Countries and country comparison | PASS | Search suggestions, keyboard selection, structured filters, drawer, A–Z, pagination, URL/history and source-aware detail are covered by `public-countries.spec.ts`. |
| Subjects and specializations | PASS | Search/suggestions, specialization result focus, refresh/history and unpublished safety are covered by `public-catalog.spec.ts`. |
| Generic courses and discovery hierarchy | PASS | Filters, sort, pagination, mobile drawer, URL/history and legacy hierarchy redirect were exercised. Legacy values now normalize lowercase. |
| Universities and offerings | PASS | Listing/detail/relations and three-item comparison loaded using real seeded records. |
| Scholarships | PASS | Listing/detail and multi-relationship Admin workflow exercised. |
| Consultants and locations | PASS | Listing/detail/location and three-item comparison loaded using real seeded records. |
| Careers and events | PASS | Listing/detail, published data and invalid-slug behavior exercised. |
| Stories and testimonials | PASS | Separated listings loaded with fictional attribution. |

## 6. Four-comparison matrix

`PASS` — countries, universities, university offerings and consultants each loaded with three distinct published records. Existing comparison E2E validates item order, refresh, Back/Forward, remove/re-add, invalid/duplicate handling, noindex/follow, base canonical and 390px stacking.

## 7. Contact-to-Lead and counselling matrices

`PASS` — fictional-only data was used. Contact submission validates consent and remains a traceable inquiry; the new browser regression verifies conversion creates exactly one Lead. Counselling submission preserved country context, submitted successfully and showed no console error. Existing `lead-flow.spec.ts` verifies Admin search, status update, note, audit presentation, refresh persistence and mobile layout.

## 8. Auth/security matrix

`PASS` — existing auth API (11 cases) and Admin browser auth (4 cases) cover empty/malformed/invalid sessions, invalid login, valid login, safe and unsafe `returnTo`, protected routes, logout and no token persistence. The Admin API requires authentication in browser coverage.

## 9. Course SEO routing matrix

`PASS` — the legacy URL with upper/mixed case values redirected to `/courses/computer-science/cybersecurity/canada/september?english-test=ielts&scholarship=true`; its canonical excludes query noise and discovery pages are noindex/follow. Generic course detail stayed distinct from hierarchy paths.

## 10. Sitemap, robots and metadata

`PASS` — `robots.txt` allows public content and disallows API/comparison pages. `sitemap.xml` contains Home and major public sections, has no Admin/comparison URLs or duplicates, and excludes known unpublished demo records. Browser metadata checks confirmed canonical and Open Graph URL on Home, country, subject, generic course, University, offering, Scholarship, Consultant, location, Job, Event and all comparisons. Comparison routes are `noindex, follow` with base canonicals.

## 11. Responsive/accessibility matrix

`PASS` — direct 390px walkthrough of major listings, country detail, specializations, courses, universities, scholarships, consultants, comparisons, Contact and Counselling found no document horizontal overflow. The shared Phase 1 header now has a keyboard-accessible mobile menu; it opens, Escape closes it, and the page remains scrollable. Existing browser suites cover responsive Admin actions/forms and comparison stacking. Labels, visible validation, named buttons and heading structure were checked on the exercised flows.

## 12. Console/network observations

`PASS` — no browser console errors on the manual public, contact, counselling, metadata, responsive, redirect or invalid-route walkthroughs. One local configuration observation is intentionally documented: requests served from `127.0.0.1:3000` are rejected by the configured CORS allow-list; use the supported `http://localhost:3000` local Web origin in the start instructions below.

## 13. Defects found and fixed

| Severity | Reproduction and root cause | Fix | Retest |
| --- | --- | --- | --- |
| Major demo/SEO | Phase 1 University, offering, Scholarship, Consultant, location, Job and Event details inherited the generic title and emitted no canonical/OG URL. | Shared `phaseOneMetadata` helper and per-route `generateMetadata`. | PASS — fresh browser checks show title, canonical, OG URL and index/follow. |
| Functional | A checked contact consent checkbox serializes as the string `"true"`, while the API contract correctly requires boolean `true`; Contact always failed with “Privacy consent is required”. | Typed `contactPayload` maps the checkbox to a boolean. | PASS — manual fictional submission succeeds; unit regression added. |
| Major mobile/keyboard | Shared Phase 1 header wrapped seven links at 390px and provided no menu control. | Accessible toggle menu with Escape close and mobile CSS. | PASS — menu opens/closes in browser without overflow. |
| Route/SEO | Legacy course redirect retained uppercase `IELTS` and other values. | Normalized hierarchy/query values in `legacyCourseDiscoveryUrl`. | PASS — direct browser redirect is lowercase; unit regression added. |
| Broken route | The three-level course hierarchy route `/courses/[subjectSlug]/[specializationSlug]/[countrySlug]` (subject + specialization + country, no intake) had no `page.tsx` and returned a hard 404 on direct load; the legacy `?subject=&subSubject=&country=` redirect also only fired when `intake` was additionally present, so it never reached this level. | Added the missing `page.tsx` (mirrors the sibling two- and four-level pages, passing filters without `intake`); relaxed the `/courses` redirect condition to fire on subject+subSubject+country alone; `legacyCourseDiscoveryUrl` now omits the trailing intake segment when no intake is supplied. | PASS — direct browser load of `/courses/computer-science/cybersecurity/canada` now renders the filtered discovery page (1 matching course, no console errors); the legacy query-only URL now redirects to the same lowercase three-level path; unit regression added in `course-discovery-url.test.ts`. |

## 14. Remaining visual/content polish

- Existing lint warnings remain for four deliberate raw `<img>` uses in approved template components. They are warnings, not runtime errors.
- The visual system intentionally uses the approved catalog templates on catalog pages and the structured Phase 1 shell on expanded public pages; content remains clearly labelled fictional/local demo where required.
- The `/courses` legacy-redirect path carries a default `page-size=12` query parameter into the normalized URL even when the visitor never requested pagination; cosmetic only, pre-existing before this pass, not fixed here.

## 15. User decisions

- Decide whether local development should additionally support browsing the Web app as `127.0.0.1:3000`; the current CORS configuration intentionally supports the documented `localhost` origin only.

## 16. Exact local start commands

From the repository root, in three terminals after loading the existing local-only API environment:

```sh
cd /Users/abhishekchaubey/projects/universta-phase1-leads
set -a; source /Users/abhishekchaubey/projects/universta/apps/api/.env; set +a
npm run db:migrate:deploy
SEED_DEMO_CATALOG=true NODE_ENV=development npm run seed:phase1-demo
npm run dev:api
```

```sh
cd /Users/abhishekchaubey/projects/universta-phase1-leads
API_BASE_URL=http://127.0.0.1:4000 npm run dev:web
```

```sh
cd /Users/abhishekchaubey/projects/universta-phase1-leads
API_BASE_URL=http://127.0.0.1:4000 ADMIN_APP_ORIGIN=http://localhost:3001 npm run dev:admin
```

Open Web at `http://localhost:3000`, Admin at `http://localhost:3001/login`, and API health at `http://127.0.0.1:4000/health`.

## 17. Recommended user demo order

1. Home → Countries → Canada → Country comparison.
2. Subjects → Computer Science → Specializations → Courses and filters.
3. University → offering → Scholarship → Consultant location and comparisons.
4. Contact enquiry → Admin Contact enquiries → Convert to Lead → Leads.
5. Counselling from a country/course context → Admin Lead status and notes.
6. Careers, Events, Success stories and Testimonials.

## 18. Final automated regression and git status

Executed against the local worktree after the manual UAT pass above, starting from revision `876c0bde51a35bd82960068f4faa226c23dbcbf3` at the prior handoff and continuing from `ab657f10078f95a0ea7c4c6742b25543f1f17aa0` (two legitimate continuation commits already on the branch: `fix(web): resolve phase1 public demo issues`, `test(phase1): cover manual uat regressions`).

- Prisma: `format`/`validate`/`generate` clean; `migrate status` — database schema up to date (2 migrations, local MySQL at `127.0.0.1:3306`).
- Demo seed: ran twice with `SEED_DEMO_CATALOG=true`; counts stable both times — 3 universities / 4 campuses / 8 offerings / 5 scholarships / 4 consultants / 3 locations / 3 jobs / 4 events / 3 stories / 5 testimonials. `PASS` idempotent.
- API unit: 44/44 passed.
- API E2E (full local suite, incl. auth): 59/59 passed.
- Admin unit: 48/48 passed.
- Web unit: 7/7 passed (includes the new three-level hierarchy regression).
- Full Playwright browser suite: 56/56 passed (grew from 55 with the new Contact-to-Lead traceability test already on the branch).
- Root lint: 0 errors. 53 pre-existing API `any`-safety warnings, 4 pre-existing Web `<img>` warnings — identical in count and kind to the prior handoff, no new warnings introduced.
- Production builds: API, Admin and Web all built successfully, including the new three-level course route.
- Package integrity: the Next.js dev server's transient platform-specific `swc` lockfile mutation appeared twice during this pass (once from Playwright's webServer, once from a manual `npm run dev:web`) and was reverted both times with `git checkout -- package-lock.json`; the committed lockfile is unchanged from HEAD.
- One real defect was found and fixed during this final pass beyond the four already recorded in section 13: the missing three-level course-hierarchy route (see section 13, "Broken route").
- The `phase1-structured-crud.spec.ts` and other Playwright specs created temporary `Acceptance Demo *` records for the 8 structured resources during this run; all were identified by their `acceptance-demo-*` slug/quote prefix and removed after the suite completed, restoring the exact demo counts above.
- `git status --short` at the end of this pass: only the four intended fix files touched by the three-level route defect, plus this report — `apps/web/src/app/courses/page.tsx`, `apps/web/src/lib/course-discovery-url.ts`, `apps/web/src/lib/course-discovery-url.test.ts`, the new `apps/web/src/app/courses/[slug]/[specializationSlug]/[countrySlug]/page.tsx`, and `docs/phase1-deep-manual-demo-report.md`. No `.env`, credentials, build output, or browser artifacts are tracked.
- Nothing was pushed, merged, or deployed. No AWS, remote database, or CI/CD change was made.
