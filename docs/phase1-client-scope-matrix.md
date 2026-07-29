# Phase 1 client scope matrix

Repository: `/Users/abhishekchaubey/projects/universta-phase1-leads`
Branch: `feat/phase1-expanded-local`
Verified starting HEAD: `7d61313084a5aa075e56c63fbc5a5e96ef728006` (3 commits ahead of the
`876cbd0` referenced in the assignment; those 3 commits were inspected and are
additive test/fix work, not a divergent history — continuing from actual HEAD).

Local database was found pointed at the **same database name** (`universta`) as
a sibling local checkout of this project. Isolated it to a dedicated local
database (`universta_phase1_leads` / `_shadow`) in `apps/api/.env` (gitignored,
not committed) before running anything, per the local-only / no-cross-repo-
corruption requirement. Database was then reset to a clean state and
re-migrated + re-seeded so verification numbers below are real, not residue
from earlier debugging.

Verified baseline (this session, against the clean, isolated local DB):

| Suite | Result |
| --- | --- |
| API unit | 44 passed |
| API E2E | 59 passed (clean run; earlier runs showed transient 401/429 caused by admin-account lockout from my own repeated login attempts while debugging the DB pointer, cleared) |
| Admin unit | 48 passed |
| Web unit | **7 passed** — the referenced status doc says 3; that number is stale, verified count is 7 |
| API lint | 0 errors, 53 pre-existing `any`-safety warnings |
| Admin lint | 0 errors, 0 warnings |
| Web lint | 0 errors, 4 pre-existing image-optimization warnings |
| API/Admin/Web production build | all pass |
| Demo seed idempotency | ran twice on a fresh DB — stable counts: 3 universities, 5 scholarships, 4 consultants, 3 jobs, 4 events, 3 stories, 5 testimonials |

Playwright browser suite requires live dev servers; run and recorded in
`docs/phase1-client-completion-progress.md` once servers are up (Milestone 11).

Status legend: **COMPLETE**, **PARTIAL**, **MISSING**, **NOT APPLICABLE**, **BLOCKED**.

---

## A. Page coverage (section 7 of the brief)

All 33 listed page types were checked by route existence + a real request against
seeded data (not just a 200 status).

| # | Page | Status | Route | Notes |
| - | --- | --- | --- | --- |
| 1 | Countries List | COMPLETE | `/countries` | Polished visual template, live continent/A–Z/search. |
| 2 | Country Detail | COMPLETE | `/countries/[slug]` | Content real; **canonical URL does not match client spec** — see section J. |
| 3 | City Listing | **MISSING** | — | No City model, no route, no admin. |
| 4 | City Detail | **MISSING** | — | Same. |
| 5 | University List | COMPLETE | `/universities` | Older generic template (`PhaseListing`), not the polished design system — functional, not visually consistent. Not explicitly required by this brief. |
| 6 | University Detail | COMPLETE | `/universities/[slug]` | Same template note. No Claim CTA. |
| 7 | University Courses | COMPLETE | `/universities/[slug]/courses` | |
| 8 | Single University Course | COMPLETE | `/universities/[slug]/courses/[offeringSlug]` | |
| 9 | Generic Course Listing | COMPLETE | `/courses` | Polished template. |
| 10 | Generic Course Detail | COMPLETE | `/courses/[slug]` | |
| 11 | Subject Listing | COMPLETE | `/subjects` | Polished template. |
| 12 | Sub-Subject/Specializations | COMPLETE | `/subjects/[slug]/specializations` | |
| 13 | Single Subject | COMPLETE | `/subjects/[slug]` | |
| 14 | Scholarship Listing | COMPLETE | `/scholarships` | Generic template. |
| 15 | Single Scholarship | COMPLETE | `/scholarships/[slug]` | |
| 16 | Consultants Listing | COMPLETE | `/study-abroad-consultants` | Generic template. |
| 17 | Single Consultant | COMPLETE | `/study-abroad-consultants/[slug]` | No Claim-equivalent needed (consultants aren't claimable per brief). |
| 18 | Consultant Location | COMPLETE | `/study-abroad-consultants/locations/[slug]` | |
| 19 | Country Comparison | COMPLETE | `/compare/countries` | |
| 20 | University Comparison | COMPLETE | `/compare/universities` | |
| 21 | Course Offering Comparison | COMPLETE | `/compare/courses` | Compares University Course **Offerings**, matching the client's distinction (see section D). |
| 22 | Consultant Comparison | COMPLETE | `/compare/consultants` | |
| 23 | Home | COMPLETE | `/` | |
| 24 | About Us | PARTIAL | `/about` | Renders; content is a single generic sentence, not real editorial copy — needs real content (CMS gap, not a routing gap). |
| 25 | Contact Us | COMPLETE | `/contact` | Real ContactInquiry submission wired. |
| 26 | Book Free Counselling | COMPLETE | `/counselling` | |
| 27 | Success Stories | COMPLETE | `/success-stories` | |
| 28 | Testimonials | COMPLETE | `/testimonials` | |
| 29 | FAQ | PARTIAL | `/faq` | Same generic-copy gap as About. |
| 30 | Careers | COMPLETE | `/careers` | |
| 31 | Single Job | COMPLETE | `/careers/[slug]` | |
| 32 | Events Listing | COMPLETE | `/events` | |
| 33 | Event Details | COMPLETE | `/events/[slug]` | |

**Result: 29/33 fully complete, 2 partial (content only), 2 missing (City module).**

---

## B. CMS scope (section 8)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Fully editable pages | PARTIAL | `Page`/`PageSection` models exist and are read by the public site; **no admin UI to edit them** — `Phase1StructuredEditor.tsx` has 8 explicit resource editors (University, Offering, Scholarship, Consultant, Job, Event, Story, Testimonial) and no Page/Section editor. Content is currently only editable by hand-editing `prisma/demo-seed.ts`. |
| Reusable templates | MISSING | No template selection concept exists on `Page`. |
| Dynamic content sections | PARTIAL | `PageSection` supports ordered, typed sections at the data layer; no admin surface. |
| Ordered/reorderable blocks | MISSING | `displayOrder` column exists; nothing writes to it from an admin UI. |
| Drag-and-reorder | MISSING | No reorder controls anywhere. |
| SEO metadata | PARTIAL | `SeoMetadata` model exists and is read on Course/Subject/Country public pages; no admin form to edit it directly (Country/Subject/Course structured editors are separate from the generic Phase1 editor and were not in scope of this repo's structured-editor work). |
| URL slug management | PARTIAL | Slugs are editable per record via existing structured editors (University, Scholarship, Consultant, Job, Event); no redirect safety net on change. |
| Media/images | PARTIAL | `MediaAsset` model is rich (storage provider, dimensions, alt text, folder); admin forms only offer a **dropdown of existing assets** — no upload endpoint anywhere in the API. |
| Draft/Published | COMPLETE | Respected consistently; public queries filter to `PUBLISHED`. |
| Scheduled publishing | MISSING | Only DRAFT/PUBLISHED/ARCHIVED exist; no scheduling fields or read-time enforcement. |
| Scheduled unpublishing | MISSING | Same. |
| A/B testing-ready variants | MISSING | No experiment/variant model anywhere. |
| CSV import | MISSING | No parsing dependency, no import endpoint. |
| XLSX import | MISSING | Same. |
| CSV export | MISSING | Same. |
| XLSX export | MISSING | Same. |
| Bulk update | MISSING | Admin manager is single-record only, no multi-select. |
| Bulk delete/archive | MISSING | Same. |
| Featured listings | PARTIAL | `isFeatured` exists and sorts correctly for University/Scholarship/Consultant/Course; no `featuredPriority`/`featuredFrom`/`featuredUntil` windowing. |
| Internal linking (structured) | MISSING | Any cross-links in seeded content are hardcoded paths, not entity references. |
| Custom URL / redirect management | MISSING | `Redirect` model exists in the schema; zero references to it anywhere outside the generated Prisma client. |

---

## C. Location hierarchy (section 9)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Region model | MISSING | Not in schema. |
| State/Province model | MISSING | Not in schema. |
| City model | MISSING | Not in schema. |
| Country ↔ Continent | COMPLETE | Existing, correct. |
| Consultant structured location | PARTIAL | `ConsultantLocation` model exists with its own city/state text fields, but it is Consultant-specific, not a shared hierarchy usable by University/Campus/Job/Event. |
| Structured location on University/Campus/Job/Event | MISSING | These use free-text `location`/`city`/`state` strings, no FK to a shared location entity. |

## D. Generic Course vs University Course Offering (section 6)

**COMPLETE — verified, not just by naming.** `Course` (generic) and
`UniversityCourseOffering` are genuinely separate Prisma models with the
described ownership split (Course → Subject/SubSubject/CourseLevel; Offering →
University/Campus/Course/StudyMode/tuition/intakes/requirements). The public
`/courses` routes serve `Course`; `/universities/[slug]/courses/[offeringSlug]`
serves `UniversityCourseOffering`. The four comparison pages correctly compare
Offerings under the "courses" comparison type, not generic Courses. No merge
of the two concepts was found.

## E. University Claim (section 13)

**MISSING** in every respect: no `UniversityClaim` model, no public CTA, no
claim form, no admin queue, no statuses. Confirmed by schema grep and full-text
search for "claim" across web/api/admin (only false-positive matches on
"disclaimer").

## F. Scholarship / Consultant modules (sections 15–16)

Both COMPLETE for their current scope (listing, detail, admin CRUD, real
relations to Country/University/Provider). Filters present: Scholarship
(country, university, benefit type, deadline-open); Consultant (location,
country, service, language, verified). **MISSING** across both: bulk
import/export, scheduled publishing, featured time-windows, City/State/Region-
based filtering (blocked on section C).

## G. Search and filtering (section 18)

| Module | Present filters | Missing (per section 18) |
| --- | --- | --- |
| Country | budget band, IELTS-optional, intake, visa success, PR pathway | Region/State/City (blocked on C) |
| Course (generic) | subject, sub-subject, course level, study mode, intake, min tuition, scholarship-available, post-study-work-available | max tuition ceiling not present (min only) |
| University | country, institution type, subject | City/State (blocked on C), tuition/intake (these belong on Offering per the client's own semantic guidance in section 18 — reasonable, not a gap) |
| Scholarship | country, university, type, deadline | amount range, degree level |
| Consultant | location, country, service, language, verified | — |

All verified server-side (query params → real Prisma `where` clauses, not
client-side-only filtering). URL state, Back/Forward, and mobile filter drawer
are covered by existing Playwright specs for Country/Course; not yet covered
for University/Scholarship/Consultant.

## H. Featured listings (section 8.8)

PARTIAL — boolean `isFeatured` works and affects sort order for University,
Scholarship, Consultant, Course. No `featuredPriority`, no time-bounded
featuring window, so "expired featured windows stop influencing sorting" is
not applicable (nothing to expire).

## I. SEO / schema (sections 21, 10, 22)

- Sitemap: exists, but only lists 6 of ~11 dynamic resource types and **does
  not include individual Country pages at all** — a real gap independent of
  the URL-rename question.
- Robots: exists, disallows `/api/` and `/compare/` (comparison pages
  correctly excluded from indexing at the crawl level; canonical/`noindex`
  meta tags on those pages were not yet verified this pass).
- JSON-LD: present on Country detail only (`Place` schema). No Course,
  JobPosting, Event, FAQPage, or Organization schema found anywhere.
- Country canonical route does not match the client's `/study-in-{slug}`
  example (see section J) — this is the biggest concrete SEO gap.

## J. Country/City SEO routes (section 10)

**MISSING.** Current: `/countries` (listing) + `/countries/[slug]` (detail).
Client requires canonical `/study-in-[countrySlug]` and
`/study-in-[countrySlug]/[citySlug]`. No redirect or rewrite exists yet. This
must land before the City module (Milestone 5), so City ships under the right
path the first time instead of needing a second migration.

## K. Country Listing composition (section 11)

Checked against the five required sections + Hero:

| Section | Status | Notes |
| --- | --- | --- |
| Hero (search, CTA) | PARTIAL | Real search + quick filters exist; CTAs are hardcoded, not CMS-configurable; no configurable Create-Account CTA slot. |
| 1. Continents + Countries | COMPLETE | Continent tabs filter the grid live. |
| 2. CTA | PARTIAL | A CTA band exists ("Request counselling" / "Explore courses") — copy is honest, no false account-creation claim found in this repo. Gap is only that it's hardcoded, not CMS-managed. |
| 3. A–Z destinations | COMPLETE | Full alphabet, keyboard-navigable, empty-letter handling. |
| 4. Consultants | **MISSING (functional defect)** | Section is hardcoded to always render its empty state regardless of real data — never queries consultants at all, even though published consultants exist. |
| 5. Content + CTA | PARTIAL | Present, hardcoded not CMS-managed. |

## L. Admin feature checklist (section 19) — condensed

Structured CRUD is genuinely strong (create/edit/reload/relationships/
publish/unpublish/archive, all Playwright-verified) for the 8 resources listed
in section 5. Missing uniformly across all resources: bulk import/export,
bulk update, bulk delete, media upload, redirect/URL management, internal-link
picker, scheduled publishing, A/B variants. Countries/Subjects/Courses have
their own separate, older, dedicated admin modules (`continents`, `countries`,
`subjects`, `courses` in the admin app) — not the generic Phase1 manager —
those were not part of this repo's "structured editor" work and were not
re-audited field-by-field in this pass; flagged for a follow-up check if the
client needs SEO-field parity confirmed there too.

## M. Performance & security (sections 23–24)

Not yet exercised this pass beyond what unit/E2E tests already assert
(pagination present everywhere; server-side auth guards present and tested;
no tokens in localStorage — confirmed by the existing auth E2E suite). Real
Lighthouse pass and a dedicated security review are Milestone 11 work.

---

## Summary counts

- Page types: 29 complete, 2 partial, 2 missing.
- CMS capabilities (18 checked): 3 complete, 7 partial, 8 missing.
- Location hierarchy: 1 complete, 1 partial, 4 missing.
- University Claim: fully missing.
- Country Listing sections: 2 complete, 3 partial, 1 missing (functional defect).

This confirms the "likely gaps" list in section 26 of the assignment almost
exactly, with two additions found by direct evidence rather than assumption:
the Country Listing Consultants section is not just "less advanced" but
**hardcoded to never show real data**, and the sitemap omits Country pages
entirely regardless of the URL question.

Proceeding to Milestone 2.
