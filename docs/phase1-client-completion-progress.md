# Phase 1 client completion — progress checkpoint

Recovery pointer: read this file first if context was compacted. It reflects
the actual repository state as of the last commit listed below, not intent.

Repository: `/Users/abhishekchaubey/projects/universta-phase1-leads`
Branch: `feat/phase1-expanded-local`

## Milestone status

| # | Milestone | Status |
| - | --- | --- |
| 1 | Scope audit and safe plan | DONE |
| 2 | CMS foundation completion | DONE |
| 3 | Media, links and URL management | DONE |
| 4 | A/B testing foundation | DONE |
| 5 | Location hierarchy and destination pages | DONE |
| 6 | Country Listing client composition | DONE |
| 7 | University Claim | DONE |
| 8 | Bulk data management | DONE (7 of ~13 modules — see summary) |
| 9 | Featured listings and advanced filters | DONE (scoped — see summary) |
| 10 | SEO and schema completion | pending |
| 11 | Full integration and defect fixing | pending |
| 12 | Final Phase 1 acceptance | pending |

## Local environment notes (read before running anything)

- `apps/api/.env` `DATABASE_URL`/`SHADOW_DATABASE_URL` were repointed from the
  shared `universta` / `universta_shadow` local databases to dedicated
  `universta_phase1_leads` / `universta_phase1_leads_shadow` databases, to
  avoid corrupting a sibling checkout of this project that shares the same
  local MySQL server. This file is gitignored; the fix is not committed
  anywhere and must be redone if `.env` is regenerated.
- If admin login E2E tests return 401/429 after repeated manual runs, it is
  account lockout (`users.locked_until` / `failed_login_attempts`), not a
  product defect — clear via
  `UPDATE users SET locked_until = NULL, failed_login_attempts = 0;` or reseed.
- Demo seed is idempotent; safe to rerun.
- Local dev servers for this repo run on **alternate ports** (api 4010, web
  3010, admin 3011) because the sibling `universta` checkout already had
  3000/3001/4000 bound. Admin needs `ADMIN_APP_ORIGIN=http://localhost:3011`
  set (its CSRF-style origin check defaults to `:3001` otherwise, which
  silently 403s every login from a differently-ported dev server).
  Full start commands:
  ```
  cd apps/api && set -a && source .env && set +a && PORT=4010 npm run start:dev
  cd apps/web && API_BASE_URL=http://127.0.0.1:4010 NEXT_PUBLIC_SITE_URL=http://localhost:3010 npx next dev -p 3010
  cd apps/admin && API_BASE_URL=http://127.0.0.1:4010 ADMIN_APP_ORIGIN=http://localhost:3011 npx next dev -p 3011
  ```
- Running the API's Jest e2e suite with default parallel workers causes
  cross-file interference (rate-limit/lockout and leftover fixture data)
  against this single local MySQL instance. Use `--runInBand` for a reliable
  full-suite run; individual files pass fine in parallel.
- The API's `ConfigModule` only assigns its own *validated* config keys back
  onto `process.env` (see `validateEnvironment` in `src/config/environment.ts`)
  — it does NOT dotenv-load the rest of `.env` into `process.env`. Test files
  that read `process.env.SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` directly
  need those exported into the shell first: run e2e as
  `set -a && source .env && set +a && npx jest --config test/jest-e2e.json --runInBand`,
  not a bare `npx jest ...` — otherwise every login-dependent e2e spec fails
  with a 400 validation error, which looks like a regression but isn't one.
- Adding/editing `apps/web/src/middleware.ts` does not always hot-reload into
  an already-running `next dev` process — symptoms are `HTTP 200` with an
  empty (0-byte) response body on every route. Fix: restart that dev server.
- The web app's own BFF routes (`contact-inquiries`, `experiments/conversions`)
  403 if `NEXT_PUBLIC_WEB_ORIGIN` isn't set to match the port actually in use
  — same pattern as admin's `ADMIN_APP_ORIGIN`, defaults to `:3000`.
- When running many long-lived dev-server restarts across a session, orphaned
  `nest start --watch` / `next dev` processes accumulate and can exhaust the
  system-wide file descriptor table (`ENFILE`) well before any per-process
  `ulimit`. Check `lsof -nP -iTCP -sTCP:LISTEN` for the port actually serving
  traffic, and kill only processes with no live listening child.
- **This Next.js version (16.2.11) never registers a route for an app-router
  folder name that mixes literal text with a bracket in the same segment**
  (e.g. `study-in-[countrySlug]`) — it silently never appears in
  `.next/routes-manifest.json`'s `dynamicRoutes`, in dev *or* production,
  no matter how many times `.next` is cleared and the server restarted.
  Every other dynamic route in this app uses the bracket as the *entire*
  segment name (`[slug]`, `[countrySlug]`), which is unaffected. If a URL
  needs a literal prefix, put the real page under a pure dynamic segment
  (`study-in/[countrySlug]`) and add a `rewrites()` entry in
  `next.config.ts` mapping the external hyphenated path to the internal
  one — this preserves the exact public URL with no redirect and no
  extra slash. Diagnostic trick: a *pre-existing, known-working* dynamic
  route (e.g. `/universities/[slug]`) suddenly 404ing too is the signal
  this bug is in play rather than something wrong with new code.

## Commits this effort (newest first)

- `68e3fba` feat(catalog): add featured-window scheduling and location/tuition filters
- `892a9be` feat(admin): add Bulk data admin UI
- `61eab27` feat(admin): add safe catalog bulk operations engine (API)
- `c89312f` docs(phase1): checkpoint after milestone 7
- `6df0a35` feat(universities): add university claim request workflow
- `fe482f2` feat(countries): wire Country Detail's Cities tab to the real City model
- `a54e633` feat(countries): wire Consultants section to real published data
- `1378300` docs(phase1): checkpoint after milestone 5
- `4d119bb` fix(admin): correct countries page-size cap in LocationsManager
- `c6c6c48` feat(locations): add state/city hierarchy and canonical country routes
- `7628d43` docs(phase1): checkpoint after milestone 4
- `2f6676c` feat(cms): add local ab testing support
- `7178803` feat(cms): add media library and redirect management
- `dc44146` docs(phase1): checkpoint after milestone 2
- `2366555` feat(cms): complete phase1 page builder and publishing workflows
- `afd58fb` docs(phase1): audit complete client scope

## Milestone 9 summary (done — scoped subset)

- Migration `20260730083831_add_featured_windows` adds `featuredPriority`
  (`Int @default(0)`), `featuredFrom`/`featuredUntil` (`DateTime?`) to
  University, UniversityCourseOffering, Scholarship, and Consultant —
  purely additive. Job and Event were **not** touched: neither model has
  an `isFeatured` field at all in this schema, so there is no existing
  boolean to extend into a window; adding one from scratch was scoped out.
- Read-time "effective featured" sort (mirrors the existing
  `effectivePublicationWhere()` read-time-gate pattern from Milestone 2,
  just for a boolean instead of a status): a row only counts as featured
  if `isFeatured` is true AND `now` falls inside the optional
  `[featuredFrom, featuredUntil)` window. Prisma can't express that as a
  DB-level `ORDER BY` without raw SQL, so `expanded.service.ts` fetches up
  to `FEATURED_FETCH_CAP` (500) matching rows, sorts in JS by
  `[effectiveFeatured desc, featuredPriority asc, displayOrder asc, name/title asc]`
  (Scholarship additionally tiebreaks on `deadline` before displayOrder,
  preserving its prior "soonest deadline first" behavior), then slices in
  JS for the requested page. 500 is far above any real per-resource count
  in this local/demo dataset.
- **Scoped deliberately to University and Scholarship only** — the two
  most-browsed public listings. Consultant and UniversityCourseOffering
  got the schema fields and are admin-settable (structured editor for
  University/Scholarship; API/bulk for the others), but their public list
  queries still sort on the plain `isFeatured desc` boolean, matching the
  same "scoped subset, honestly documented" call made in Milestone 8.
- New filters, both server-side query params validated against real Prisma
  `where` clauses: `city`/`state` on the `universities` list (matched
  against `UniversityCampus.city`/`.state` free text — University has no
  direct FK to the Milestone 5 City/State models, only its campuses do),
  and `tuitionMin`/`tuitionMax`/`courseLevel` on the
  `universities/:slug/courses` listing (course level matched by
  `CourseLevel.code`; tuition matched as a range overlap so a null bound
  on either side of a row doesn't wrongly exclude it).
- Admin: `Phase1StructuredEditor.tsx` gained a shared "Featured placement"
  fieldset (checkbox + priority number + two `datetime-local` inputs),
  rendered for University and Scholarship only. `expanded.service.ts`'s
  per-resource field allow-list (`writeData()`) now accepts `isFeatured`/
  `featuredPriority`/`featuredFrom`/`featuredUntil` for those two
  resources — previously `isFeatured` itself wasn't admin-writable for
  *any* resource through this path, a pre-existing gap this milestone
  also closed for University/Scholarship specifically.
- 3 new e2e tests (`featured-listings.e2e-spec.ts`): an expired featured
  window is confirmed to rank behind an actively-featured row (and
  `featuredPriority` breaks ties among actively-featured rows); city/state
  campus filters match/exclude correctly; tuition-range and course-level
  filters on offerings match/exclude correctly. Full regression after:
  140 API e2e + 44 API unit, admin build, all green.
- Real browser verification: logged into the local admin UI, opened
  "Ember Demo Institute" (a pre-existing fictional seed university),
  checked Featured + set priority 1 through the new UI, saved, confirmed
  it re-sorted to the top of both the admin list and the public
  `/universities` page, then reverted it back to unfeatured (direct SQL,
  since the admin UI's editor state got into a stale-ref condition
  mid-revert-attempt in the browser-automation tool — not a product bug,
  just a browser-automation hiccup) and re-confirmed the public page
  returned to its normal alphabetical order.

## Milestone 8 summary (done — scoped subset)

- New reusable bulk-operations engine (`apps/api/src/bulk/`): a
  dependency-free hand-rolled CSV reader/writer (`csv.util.ts`) and an
  `exceljs`-backed XLSX reader/writer (`xlsx.util.ts`), a per-resource
  `BulkResourceDefinition` registry (`bulk-resources.ts`) and a generic
  `BulkOperationsService` that any registered resource gets for free:
  downloadable template, dry-run (validates every row, writes nothing),
  create-mode import (rejects existing slugs as row errors), upsert-mode
  import (updates by slug), export, bulk-update (rejects any field not on
  that resource's explicit `updatableColumns` allow-list — identity/
  relation columns are never bulk-editable), and bulk-archive (per-row
  dependency check, e.g. a State with cities still attached is skipped
  and reported rather than silently orphaning those cities).
- **Dependency choice documented explicitly**: picked `exceljs` over the
  more commonly-reached-for `xlsx` (SheetJS) package after `npm audit`
  showed the npm-registry `xlsx` build (0.18.5) carries two unpatched
  HIGH-severity CVEs (prototype pollution, ReDoS) with `fixAvailable:
  false` — a real risk specifically for a feature that parses untrusted
  uploaded files. `exceljs`'s own audit flags are transitive
  (archiver/glob chain) and not reachable through this code's actual
  usage (no user-controlled paths are ever passed to those libraries
  here) — the safer of two imperfect options, not a clean bill of health.
- Wired for **7 of the brief's ~13 "primary modules"**: Countries,
  States, Cities, Subjects, Generic Courses, Jobs (Careers), Events.
  **Deliberately not wired**: Universities, Campuses, University Course
  Offerings, Scholarships, Consultants — their relational shape (campus/
  provider/intake/requirement graphs, multiple linked entities per row)
  needs a materially larger per-resource mapper than the flat-to-single-
  FK cases covered here, and giving them the same care within this
  milestone wasn't realistic. The engine itself doesn't care which
  resources exist — extending coverage later is adding another
  `BulkResourceDefinition`, not new engine work. Documented here rather
  than silently claimed as complete.
- File security: 3MB upload cap, 2000-row cap, `.csv`/`.xlsx` extension
  allow-list, CSV export escapes formula-injection-prone leading
  characters (`=`, `+`, `-`, `@`) with a leading tab (verified — a
  literal `=2+2` payload round-trips as `\t=2+2`, never as a live
  formula), every endpoint SUPER_ADMIN-guarded, every mutating operation
  writes an `AuditLog` row via the existing `writeAudit` helper.
- Admin UI: new "Bulk data" section — resource picker, template/export
  downloads (via authenticated blob download, since these need a Bearer
  token a plain `<a href>` can't send), file upload with dry-run/import,
  and a record picker driving bulk-update (one field + value) and
  bulk-archive (surfaces per-row dependency-block reasons).
- 13 new e2e tests (dry-run error reporting with no writes, create-mode
  duplicate rejection, upsert-mode update leaving unrelated fields
  untouched, country/state relational lookups including an
  unknown-slug rejection path, bulk-update field allow-list enforcement,
  bulk-archive, export round-trip, formula-injection escaping). Full
  137-test API e2e suite green.
- Verified the whole admin flow in a real browser, not just via curl:
  attached a real in-memory CSV `File` to the upload input (via
  `DataTransfer`, since a real OS file-picker isn't available to this
  environment), ran dry-run, imported it, bulk-updated the new record's
  status, bulk-archived it, and confirmed each step against the database
  directly. Found and cleaned up one stray disposable row left behind by
  an earlier (already-fixed) failing test assertion — a test-hygiene
  note (inline cleanup after an `expect()` never runs if that expect
  throws), not a product defect.

## Milestone 7 summary (done)

- New schema: `UniversityClaimRequest` (claimant contact fields, status,
  reviewer, `claimNumber`), `UniversityClaimNote` (mirrors `LeadNote`
  naming), `UniversityClaimStatusHistory` (mirrors `LeadStatusHistory`
  naming — `oldStatus`/`newStatus`/`changedByUserId`/`reason`) — migration
  `20260730073024_add_university_claim_workflow`, purely additive.
- New dedicated `UniversityClaimsModule`: public `POST
  phase1/university-claims` (honeypot silently no-ops, 10s rate limit per
  email+university mirroring the existing ContactInquiry convention,
  duplicate-open-request detection separate from the rate limiter, full
  field validation); admin `GET/GET-one/DELETE admin/university-claims`,
  `PATCH .../:id/status` (validated against the 6-state enum, writes a
  status-history row in the same transaction), `POST .../:id/notes`.
- Public: "Claim this university" link on the University Detail hero
  actions leads to `/universities/{slug}/claim` — a real form (name,
  work email, job title, organization, phone, official website, message,
  consent, honeypot) reusing the existing `.phase1-contact-form` CSS
  pattern from the Contact page rather than inventing new styling. A new
  web BFF route (`/api/university-claims`) forwards to the API using the
  same origin-check pattern as the existing contact-inquiries route.
- Admin: new "University claims" section (`UniversityClaimsManager.tsx`)
  — status-filterable queue, detail view with all claimant fields, a
  status-change dropdown with an optional reason, full status-history
  and notes display, note-adding, archive.
- 13 new e2e tests (validation, honeypot silently drops the row,
  duplicate-vs-rate-limit distinguished via a `Date.now` mock rather than
  a real 10s sleep, invalid status rejected, notes, full status-history
  transition, confirms approving a claim exposes no access-granting
  fields). Full 124-test API e2e suite green.
- Verified the entire flow in a real browser end-to-end: submitted a
  claim through the actual public form for the real seeded "Ember Demo
  Institute" university, reviewed it in the actual admin UI, added a
  note, transitioned SUBMITTED → UNDER_REVIEW → APPROVED, and confirmed
  via a direct login attempt that the claimant's email still cannot
  authenticate anywhere — approving a claim creates no account and no
  access, exactly as required. Archived the test claim afterward.
- Scope boundary honored explicitly: no University partner portal, no
  automatic ownership/access grant on approval, no domain-ownership
  auto-verification — all per the brief's own instruction not to build
  Phase 2/3 functionality here.

## Milestone 6 summary (done)

- Root cause confirmed by reading the actual code (not just the earlier
  audit note): the Country Listing page's "Study abroad consultants"
  section (`.cons-sec` in `ApprovedTemplatePages.tsx`) always rendered
  `<EmptyTemplateState label="Consultant profiles are not yet published" />`
  unconditionally — it never fetched or received any Consultant data at
  all, even though matching card CSS (`.cons`, `.cons-top`, `.free-badge`)
  already existed in `visual-reference.css`, implying the section was
  designed for real cards but never wired up.
- Fix: `apps/web/src/app/countries/page.tsx` now fetches published
  Consultants via the existing generic `phaseList('consultants', {limit:
  '6'})` (featured-first, published-only — enforced server-side, no
  client-side leak risk), passed down as a new `consultants` prop.
  `ApprovedCountriesListing` renders real cards — name, short
  description, a verification badge shown *only* when
  `verificationStatus === 'VERIFIED'` (never fabricated), and a working
  link to the real `/study-abroad-consultants/{slug}` detail page — with
  the original empty state kept as the genuine zero-data fallback.
- Audited the Hero and CTA copy across the whole page for the "Create
  Account" false-claim risk the brief calls out: no such text exists
  anywhere in this template (confirmed by direct search), so no change
  was needed — this was already honest CTA copy from an earlier pass.
- Verified in a real browser (not just curl): navigated to `/countries`,
  confirmed via `get_page_text` and a DOM query that the 3 seeded
  fictional demo consultants ("Demo Consultant 2", "Demo Consultant 3",
  "Universta Demo Guidance") render with correct `/study-abroad-
  consultants/{slug}` links, and that one such detail link resolves
  with a real 200.
- Scoped decision, not a defect: making the *entire* Country Listing page
  (its static headings/copy/layout) editable through the Page/PageSection
  CMS system, as section 11 of the brief describes in full, is a much
  larger rebuild of an already-approved, already-reskinned bespoke
  template with real regression risk, and was not attempted this
  milestone — every *section's data* is live and published-only, which
  was the concrete, actionable gap the Milestone 1 audit actually found.
  Documented here rather than silently narrowed.
- Second concrete defect fixed the same way: the Country **Detail** page's
  own pre-existing "Cities" nav tab (`id="cities"` in `ApprovedCountryDetail`)
  always rendered an empty state built from a manually-entered
  `statistics.citiesCount` number — it never queried the real `City` model
  built in Milestone 5. Fixed by having `study-in/[countrySlug]/page.tsx`
  fetch `getCountryCities(countrySlug, {limit: '6'})` server-side and pass
  it down; the section now renders real city cards (name, short
  description, state/province when set) linking to
  `/study-in-{country}/{city}`, plus a "View all cities" link to the
  Milestone 5 listing page, falling back to the original empty state only
  when a country truly has no published cities yet. Added the one missing
  CSS rule this needed (`.city-b .go`) rather than inventing new card
  styling — the `.city`/`.city-img`/`.city-row` classes already existed in
  `visual-reference.css`, unused, confirming this section was designed for
  real data from the start and simply never wired up.
- Verified this fix in a real browser too: created a fictional "Toronto"
  city under Canada via the admin API, confirmed it rendered on
  `/study-in-canada` with the correct description and a working
  `/study-in-canada/toronto` link (real 200), then archived it again.
- Full API/admin/web lint, typecheck and production builds stayed clean
  throughout (no new tests needed — this was a data-wiring fix to an
  existing, already-tested page, not a new capability).

## Milestone 5 summary (done)

- Schema: `State` and `City` models (migration
  `20260729180205_add_location_hierarchy`) — a deliberately 2-level
  hierarchy (Country → State → City, State optional on City) rather than
  a 3-level Region/State/City tree, since the brief's own examples never
  needed a level above State/Province for Phase 1's scope. Both are
  soft-deletable, sluggable, orderable; City carries `isFeatured`,
  `shortDescription`/`overview`, and an optional hero media relation.
- New dedicated `LocationsModule` (not folded into the existing
  `ExpandedService` monolith, matching the precedent set by Media and
  Experiments): public `GET phase1/countries/:slug/states`,
  `GET phase1/countries/:slug/cities` (paginated, `?state=` filter),
  `GET phase1/countries/:slug/cities/:citySlug`; full admin CRUD at
  `/admin/states` and `/admin/cities`, including cross-country state/city
  validation and an "in use" guard blocking state archival while a city
  still references it.
- Country's canonical public URL moved to `/study-in-{countrySlug}`
  (brief's own required scheme); the old `/countries/[slug]` route is now
  a permanent-redirect shim. City pages live nested under it:
  `/study-in-{country}/cities` (listing, reuses the generic
  `PhaseListing`/`PhaseDetail` components from Milestone 2/3's Phase 1
  pages via a new `basePath` override prop) and
  `/study-in-{country}/{citySlug}` (detail). Sitemap now emits both.
- **Real Next.js routing bug found and worked around** (see environment
  notes above): a folder name mixing literal text with a bracket in one
  segment never gets a routes-manifest entry in this Next version. Fixed
  by moving the actual pages to the pure dynamic segment
  `study-in/[countrySlug]` and adding `rewrites()` in `next.config.ts` so
  the public URL is unaffected. Caught by browser-testing the real route,
  not just by lint/build/typecheck, all of which stayed green throughout.
- Admin UI: new "States & cities" section (`LocationsManager.tsx`) with
  a country→state cascading picker for creating cities, status/featured
  toggles, and archive. Verified end-to-end in a real browser: created a
  state and a city through the actual form (not just the API), published
  the city, confirmed it appeared on the public API/site, then archived
  both back out.
- One real defect found only by exercising this new admin UI in a
  browser: the country picker requested `limit=250` against an endpoint
  that caps at 100, silently emptying the dropdown (error swallowed by
  the load's own catch) — fixed in a follow-up commit.
- 12 new e2e tests for the locations API; full 111-test API e2e suite
  green (`--runInBand`). Full API/admin/web lint, typecheck, and
  production builds all clean.
- Explicitly out of scope for this milestone, left for Milestone 6:
  wiring the Country detail page's own pre-existing "Cities" nav tab to
  the new City model (it currently renders its own placeholder), and any
  City-based filtering on the University/Consultant listing pages.

## Milestone 4 summary (done)

- Schema: `Experiment` / `ExperimentVariant` / `ExperimentExposure` /
  `ExperimentConversion` models (migration
  `20260729154211_add_ab_testing_experiments`), one experiment per
  `PageSection`.
- Deterministic, dependency-free assignment (`hashToUnitInterval` +
  `assignVariant` in `experiments.service.ts`): same visitor always gets the
  same variant while the experiment's configuration is unchanged; falls back
  safely to the control/first variant on zero-weight or empty configs.
- Bot-safety: a fixed `bot` anonymous-id sentinel (set by
  `apps/web/src/middleware.ts` via User-Agent match) always resolves to
  control and is never logged as an exposure — crawlers see a stable
  canonical page and impression counts stay meaningful.
- Anonymous visitor id flows middleware → `x-anon-id` request header →
  Server Component (`headers()`) → API (`phasePage`) → `editorial()`, which
  merges the assigned variant's `eyebrow/heading/subheading/cta*` over the
  base section (`??` fallback) and stamps `experimentKey`/
  `experimentVariantKey` onto the returned section.
- CTA-click conversion tracking: `ExperimentCta.tsx` (client component)
  posts to the web app's own `/api/experiments/conversions` BFF route (never
  exposes the real API origin to the browser), which reads the visitor id
  server-side from the (httpOnly) `universta_ab` cookie and forwards it as
  `x-anon-id`.
- Admin: full CRUD + stats UI at `/experiments` (`ExperimentsManager.tsx`) —
  create against any Page's section, add/edit variants with traffic weights
  and content overrides, activate/archive, per-variant exposure/conversion/
  rate table. Mirrors the `MediaLibrary.tsx`/`PageCmsEditor.tsx` admin BFF
  pattern (`experiments-proxy.ts` + nested route handlers).
- 15 new e2e tests (determinism, bot/no-id safety, DRAFT-doesn't-override,
  ACTIVE-overrides-and-is-stable, exposure logging, conversion attribution,
  bot conversions rejected, stats, admin preview, archive removes override).
  Full 99-test API e2e suite green (`--runInBand`).
- Real browser verification end-to-end: created "Home intro heading test"
  targeting the Home page's `intro` section via the admin UI, added Control
  + "Bold Welcome" variants (50/50) with distinct heading/CTA overrides,
  activated it, confirmed the override rendered on the public Home page,
  clicked the CTA and confirmed a `CTA_CLICK` conversion was recorded
  (`5 exposures / 1 conversion / 20.0%` in the stats table), then archived
  the experiment and confirmed the public page reverted to its base content.
  This test experiment was archived (soft-deleted), not left active.
- Two real defects found and fixed only by testing in an actual browser (not
  just curl/API): (1) the web app's own origin-check BFF routes 403 unless
  `NEXT_PUBLIC_WEB_ORIGIN` matches the port in use — same class of issue as
  the admin app's pre-existing `ADMIN_APP_ORIGIN` requirement; (2) a
  long-running `next dev` process does not reliably pick up a newly-added
  `middleware.ts` file, silently serving empty (0-byte) responses on every
  route until restarted. Both are now documented above under environment
  notes rather than being product defects.

## Milestone 3 summary (done)

- Media Library: local-disk upload (JPEG/PNG/WEBP/GIF, 5MB cap, safe random
  filenames, sha256 checksum), searchable/filterable admin grid, inline
  metadata editing, archive blocked while in use (checked against
  PageSection/University/Offering/Scholarship/ConsultantLandingCard/Event/
  SuccessStory/Testimonial). New admin nav item "Media library" replaces
  the old disabled "Media" coming-soon placeholder.
- Redirects: slug renames on universities/scholarships/consultants/jobs/
  events auto-create a 301 Redirect row via the shared adminUpdate() path;
  public lookup endpoint wired into all 5 affected detail pages' 404
  fallback. Country/City routes (Milestone 5) will reuse this same
  mechanism rather than needing a second design.
- Real defect found and fixed via full-chain browser testing (not just the
  API): MediaAsset.fileSizeBytes is a Prisma BigInt with no native JSON
  serialization — every media endpoint 500'd until serialized to a Number.
- 12 new e2e tests this pass (9 media + 3 redirects), full regression green.

## Milestone 2 summary (done)

- `Page.startsAt/endsAt` added (migration `20260729131053_add_page_scheduling_window`).
- `effectivePublicationWhere()` in `expanded.service.ts` is the single
  read-time visibility gate for both pages and sections — no cron.
- New admin endpoints: `POST/PATCH/DELETE pages/:id/sections[...]`,
  `POST pages/:id/sections/reorder`, `POST pages/:id/sections/:id/duplicate`,
  `GET pages/:id/preview`.
- New `PageCmsEditor.tsx` wired into `Phase1Manager.tsx` for `resource==='pages'`.
- Fixed a second allowlist in `phase1-proxy.ts` (the admin app's own BFF) that
  predated nested section paths and 404'd everything until updated — found
  by testing the real UI, not just the API directly.
- 13 new e2e tests, all passing; full regression (44 API unit, 72 API e2e,
  48 admin unit, 7 web unit, 3 clean lints, 3 clean builds) green.
- Real browser verification: added a genuine "What we do" section to the
  live About page through the editor with zero raw JSON, confirmed on the
  public site.

## Next milestone

Milestone 10 — SEO and schema completion: JSON-LD structured data for
Course/Event/JobPosting/FAQPage/Organization, a sitemap completeness audit
against everything now live (Countries, Cities, Universities, Scholarships,
Consultants, Jobs, Events, success stories, testimonials), legacy-redirect
verification, and `noindex` on comparison-combination routes.
