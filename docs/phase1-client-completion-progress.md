# Phase 1 client completion — progress checkpoint

Recovery pointer: read this file first if context was compacted. It reflects
the actual repository state as of the last commit listed below, not intent.

Repository: `/Users/abhishekchaubey/projects/universta-phase1-leads`
Branch: `feat/phase1-expanded-local`

## Milestone status

| # | Milestone | Status |
| - | --- | --- |
| 1 | Scope audit and safe plan | DONE |
| 2 | CMS foundation completion | IN PROGRESS |
| 3 | Media, links and URL management | pending |
| 4 | A/B testing foundation | pending |
| 5 | Location hierarchy and destination pages | pending |
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

## Commits this effort (newest first)

- (pending — Milestone 1 commit lands after this file is saved)

## Next milestone

Milestone 2 — CMS foundation completion: build the missing Page/PageSection
admin editor (structured blocks, reorder, SEO, slug, draft/scheduled/published
lifecycle with read-time enforcement), since nothing in the admin currently
lets a human edit Home/About/FAQ content without touching `demo-seed.ts`.
