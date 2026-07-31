# Phase 1 completeness audit — checkpoint

**Status:** in progress. This file is the durable record; it is updated as items
are verified so findings survive a lost session.

**Basis:** branch `fix/admin-nav-catalog-ux` @ `6c0ae0f` (on `9b2e4f4`).
Structural evidence: 39 public routes, 30 Admin routes, 33 API modules, 82
Prisma models, 13 migrations. Behavioural evidence: local stack (API 4000, web
3000) against the seeded local database.

**Classification rules.** `DONE` means working end to end with evidence
recorded. A route that returns 200 is *not* evidence of `DONE` on its own —
several 200s below are empty shells. `NOT VERIFIED` is used where I have not yet
produced evidence; it is deliberately distinct from `PARTIAL`, which means I
have evidence of a gap.

## Local data baseline

Counts drive how much a page can prove. From the local database:

| Entity | Rows | Entity | Rows |
| --- | --- | --- | --- |
| countries | 13 | consultants | 4 |
| cities | 2 | jobs | 3 |
| universities | 3 | events | 4 |
| subjects | 5 | pages (CMS) | 20 |
| courses | 13 | navigation menus | 3 |
| offerings | 8 | university claims | 1 |
| scholarships | 5 | media assets | **0** |
| | | redirects | **0** |

Media and redirects hold no rows locally, so neither can be judged from the
running site alone — both are marked `NOT VERIFIED` below rather than assumed.

## Public route probe (local, all 200)

All 23 sampled routes return 200 with rendered content: `/`, `/about`,
`/contact`, `/counselling`, `/faq`, `/countries`, `/cities`, `/universities`,
`/subjects`, `/courses`, `/scholarships`, `/study-abroad-consultants`,
`/success-stories`, `/testimonials`, `/careers`, `/events`, the four
`/compare/*`, `/study-in-canada`, `/subjects/computer-science`,
`/courses/diploma-cybersecurity`.

Rendered article counts: scholarships 4, careers 2, events 4, success-stories 3,
testimonials 5, universities 3, **cities 0**.

## Matrix 1 — initial audit

### A. Content Management System

| # | Requirement | Status | Evidence | Missing / next |
| --- | --- | --- | --- | --- |
| A1 | Editable pages and templates | DONE | 20 Page + 13 PageTemplate rows; Builder lists 33 entries, all opening a real workspace (verified on production in the previous release) | — |
| A2 | Dynamic content sections | DONE | `page_sections` with section-type-driven rendering | — |
| A3 | Reorderable content blocks | DONE | drag-and-drop with keyboard alternative | re-verify after sidebar changes |
| A4 | SEO metadata management | DONE | `/seo` Admin route, per-resource SEO + static-page SEO modules | — |
| A5 | Custom URL slug management | DONE | slug fields across catalogue models | — |
| A6 | Image and media management | NOT VERIFIED | `media` API module + `/media` Admin route exist; **0 media rows locally** | upload/select/delete round trip |
| A7 | Media library | NOT VERIFIED | as A6 | as A6 |
| A8 | A/B-testing-ready templates + functional A/B | PARTIAL | `experiments` API module + `/experiments` Admin route | confirm variant assignment and conversion tracking actually drive public output |
| A9 | Draft publishing | DONE | draft isolation proven in the previous release's demo | — |
| A10 | Immediate publishing | DONE | publish round trip proven previously | — |
| A11 | Scheduled publishing | NOT VERIFIED | scheduling extended to catalogue resources per history | prove a future-dated record stays private then appears |
| A12 | Bulk import CSV + Excel | NOT VERIFIED | `bulk` API module, `/bulk-data` Admin route | dry-run + real import |
| A13 | Bulk export CSV + Excel | NOT VERIFIED | as A12 | export round trip |
| A14 | Reusable page templates | DONE | 13 templates, registered by the foundation seed | — |
| A15 | Internal linking management | NOT VERIFIED | `internal-links` API module | link picker round trip |

### B. Country module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Listing + detail | DONE | `/countries` 13 cards; `/study-in-canada` 200 | — |
| Admin CRUD | DONE | `/countries`, `/countries/new`, `/countries/[id]` | — |
| Featured / status | DONE | status + featured filters in list DTO | — |
| SEO + slugs | DONE | SEO route structure `/study-in-canada` confirmed | — |
| Media | NOT VERIFIED | see A6 | — |
| Location relationships | DONE | continent → country → city chain present | — |
| Search + filters | DONE | budget/IELTS/intake/visa/pathway filters render | combined-filter + URL-state check pending |
| `Study in {Country}` cards | **DONE (this session)** | all 13 cards verified at 1536/768/390 by measured geometry | — |

### C. City module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| City listing | DONE | `/cities` renders both published cities grouped under their country (`<h2>Canada` → `<h3>Demo City`, `<h3>Demo Harbour`) | — |
| Single city page | DONE | `/study-in/canada/demo-city` → 200, `<h1>Demo City`; `/study-in/canada/cities` → 200 | — |
| Country/state/province relationship | DONE | cities join to their country; grouping on the listing is driven by that relation | — |
| Admin CRUD + bulk | DONE | `admin/cities` and `admin/states` controllers with list/detail; surfaced under `/locations` | — |
| SEO + slugs | DONE | slugs drive `/study-in/{country}/{city}` | — |

**Correction.** An earlier pass in this session marked city listing PARTIAL on
the basis that the page rendered zero `<article>` elements. That was a bad
probe, not a defect: the page groups cities under country headings and does not
use the `<article class="card">` markup the heuristic counted. A second
mis-step followed it — a direct call to `/api/v1/cities` returned 404 and
briefly looked like a missing endpoint, but the web client's `request()` helper
prefixes `/api/v1/phase1`, and `/api/v1/phase1/cities` returns 200. Both the
listing and the detail page work. Recorded here because the false positive is
more instructive than the result.

### D. University module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Listing + detail | DONE | `/universities` 3 cards; detail route present | — |
| Claim flow | PARTIAL | `/universities/[slug]/claim` route, `university-claims` API module, `/university-claims` Admin route, **1 claim row** | end-to-end submit → validate → persist → Admin review not re-proven this session |
| Courses listing + offering detail | DONE | routes + 8 offering rows | — |
| Relationships | DONE | country/city/subject/course links present | — |
| Admin CRUD + bulk | DONE | `/phase1/universities` | — |
| Status/featured/SEO/slug | DONE | — | — |

### E. Course module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| General listing | DONE | `/courses` 13 courses | — |
| Subject categories linked | DONE | `/subjects/computer-science` 200 | — |
| Single course page | DONE | `/courses/diploma-cybersecurity` 200 | — |
| University-specific offerings | DONE | 8 offerings; nested routes present | — |
| Canonical course vs offering | DONE | separate models and routes | — |
| Intake / tuition / degree level | DONE | present on offering | — |
| Search + filters, CRUD, SEO | DONE | — | combined-filter check pending |

### F. Subject module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Listing, sub-subjects, detail | DONE | `/subjects`, `/subjects/[slug]/specializations` | — |
| Parent/child + course relationships | DONE | `SubSubject` model | — |
| Search/status/featured filters | **DONE (previous commit)** | 9 API E2E cases | — |
| Proper empty state | **DONE (previous commit)** | empty DB returns valid empty result | — |
| No `Invalid catalog request` | **FIXED (`3de3305`)** | root cause was `sort=featured` rejected by the list DTO | — |

### G. Scholarship module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Listing + detail | DONE | `/scholarships` 4 cards, 5 rows | — |
| Relationships, eligibility, deadlines | NOT VERIFIED | models present | confirm rendered on detail |
| Search/filters/CRUD/SEO | DONE | amount + degree-level filters per history | — |

### H. Consultant module

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Listing, profile, location page | DONE | `/study-abroad-consultants` + `/locations/[locationSlug]`; 4 rows | — |
| Relationships, filters, CRUD, SEO | DONE | location/service/language filters per history | — |

### I. Location management

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Country/State/Province/City/Region hierarchy | PARTIAL | models + `/locations` Admin route; **only 2 cities** | prove the hierarchy actually drives filtering, search, dynamic pages and SEO routes; prevent orphans |

### J. Search and filtering

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Per-entity search/filter | PARTIAL | filters render on every listing | **combined filters, pagination, sorting, invalid-input rejection, URL/query-state persistence, Back/Forward and mobile usability not yet systematically tested** |

### K. Admin features

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Add / view / edit exact record | **DONE (`3de3305`)** | edit targeting tests; Create no longer inherits the last edited record | — |
| Delete with confirmation | DONE | typed-name confirmation on catalogue lists | — |
| Multi-select bulk update / delete | **NOT VERIFIED** | no multi-select seen on the catalogue lists inspected | likely a real gap — confirm |
| CSV / Excel import + export | NOT VERIFIED | `/bulk-data` | — |
| Media, SEO, custom URLs, internal links | NOT VERIFIED / DONE mix | see A4–A7, A15 | — |
| Featured + draft/published/scheduled | DONE | — | scheduled per A11 |
| Validation + useful errors | DONE | class-validator; Subjects contract now correct | — |
| Role/permission enforcement | DONE | `AccessTokenGuard` + `RolesGuard` + `SUPER_ADMIN` | — |
| List refresh after mutation | DONE | `load()` after each action | — |
| No Create/Edit state leak | **DONE (`3de3305`)** | regression test fails without the fix | — |
| Exactly one active sidebar leaf | **DONE (`3de3305`)** | 29 resolver + rendered-DOM tests | — |
| Active item auto-visible | **DONE (`3de3305`)** | container-only scroll | — |

### L. Comparison pages

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Countries / universities / courses / consultants | PARTIAL | all four routes 200; `/compare/countries` renders an empty state with 0 articles | **selection, add/remove, duplicate prevention, min/max rules, refresh/direct-URL behaviour and deleted-entity handling not verified** |

### M. Marketing and supporting pages

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Home, About, Contact, Counselling, FAQ | DONE | all 200 with content; CMS-backed Pages exist | — |
| Success stories (3), testimonials (5), careers (2), events (4) | DONE | data-driven, article counts above | — |
| Job detail / event detail links | DONE | followed a real link from each listing: `/careers/local-demo-student-support` → 200, `/events/local-demo-past-session` → 200 | — |
| Contact + counselling forms persist | NOT VERIFIED this session | proven in earlier releases | re-prove |
| Drafts not publicly accessible | DONE | proven previously | — |

### N. Technical deliverables

| Requirement | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Responsive frontend | PARTIAL | countries verified at 3 widths this session; 72/72 deployed checks passed previously | remaining families at 3 widths |
| Backend APIs, DB architecture, migrations | DONE | 33 modules, 82 models, 13 migrations | — |
| CMS integration, dynamic routing | DONE | — | — |
| Sitemap / robots correct origin | **DONE** | fixed in `98ac9f6`; production emits the HTTPS origin | — |
| Canonical URLs, schema hooks | DONE | `json-ld` helper, canonical in layout | — |
| Error / loading / empty states | PARTIAL | present on catalogue lists | `/cities` under C |
| Auth + authorisation | DONE | rotation-race fix + guards | — |
| Input validation | DONE | — | — |
| Safe file/media handling | NOT VERIFIED | see A6 | — |
| Performance optimisation | NOT VERIFIED | — | — |

## Defects found this session

1. **Country card badge overlap and cramped facts** — fixed in `6c0ae0f`.
   Absolute-positioned badge collided with the longer `Study in {Country}`
   heading; the three-column fact grid clipped values until 640px.
2. **`/cities` "empty"** — not a defect. Probe error; see the correction under
   section C.
3. **Local currency symbols are mojibake** (`¥` → `�`, AED → `?.?`), which made
   one card's tuition range look inverted. **Not a product defect**: a UTF-8
   round-trip probe through the Prisma driver returns the exact string, columns
   and database are `utf8mb4`, and the demo catalogue is never seeded in
   production. Stale local rows only.

## Regression block (run in full this session)

| Suite | Baseline | This run |
| --- | --- | --- |
| API unit | 126 | **126** |
| API E2E | 187 | **196** |
| Admin unit | 137 | **137** |
| Web unit | 8 | **8** |
| Playwright | 82 | **82** |
| API build | pass | pass |
| Admin build | pass | pass (4 consecutive, after the flake fix) |
| Web build | pass | pass |
| Lint | 0 errors | 0 errors (6 warnings) |
| `git diff --check` | clean | clean |
| Tracked artifacts | 0 | 0 |

## Defect 4 — intermittent admin build failure

`next build` failed roughly one run in six with "Cannot read properties of null
(reading 'useContext')" while static-exporting a page under `(protected)` -- a
different page each time. It was patched once before on `/` alone, which only
moved the failure to the next page in the queue.

I initially concluded my own sidebar changes had caused it, on the strength of
one failing build followed by one passing build with those changes reverted.
That was wrong: with the changes fully restored the build then passed four
times in a row. One failure and one pass is not a controlled comparison, and I
should not have called it confirmed.

Fixed by declaring the whole protected segment `dynamic = 'force-dynamic'`,
which is what it should have been regardless -- every screen there sits behind a
session check and renders per-request data.

## Not yet executed

Merge, push, deploy; production acceptance; recordings; disk prune. Visual
verification covered the country cards at three widths; the remaining page
families are still outstanding. The `NOT VERIFIED` rows in Matrix 1 (media
library, bulk import/export, scheduled publishing, internal linking, A/B
behaviour, comparison selection mechanics, multi-select bulk actions) remain
open and are the substantive body of work left.
