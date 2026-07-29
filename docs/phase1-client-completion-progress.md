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
| 5 | Location hierarchy and destination pages | IN PROGRESS |
| 6 | Country Listing client composition | pending |
| 7 | University Claim | pending |
| 8 | Bulk data management | pending |
| 9 | Featured listings and advanced filters | pending |
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

## Commits this effort (newest first)

- `2f6676c` feat(cms): add local ab testing support
- `7178803` feat(cms): add media library and redirect management
- `dc44146` docs(phase1): checkpoint after milestone 2
- `2366555` feat(cms): complete phase1 page builder and publishing workflows
- `afd58fb` docs(phase1): audit complete client scope

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

Milestone 5 — Location hierarchy and destination pages: Region/State/
Province/City models + migration + admin CRUD, public City Listing + nested
City Detail, Country canonical `/study-in-[countrySlug]` route (redirect
from legacy `/countries/[slug]` reusing the existing `Redirect` mechanism
from Milestone 3), filtering integration.
