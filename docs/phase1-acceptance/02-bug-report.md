# Phase 1 Bug and Fix Report

Issues found during production acceptance from baseline `508e32a`. Every issue
below was reproduced against the live deployment before any fix was written.

---

## ISS-001 — Seven content modules have no production data

| | |
| --- | --- |
| **Severity** | Blocker (for demo + acceptance) |
| **Module** | Universities, Scholarships, Consultants, Jobs, Events, Success stories, Testimonials |
| **Environment** | Production (`https://54.162.49.131.nip.io`) |

**Description.** Seven of the ten Phase 1 content modules return zero published
rows in production.

**Reproduction.**
```
GET /api/v1/phase1/universities?limit=1   → meta.total = 0
GET /api/v1/phase1/scholarships?limit=1   → meta.total = 0
GET /api/v1/phase1/consultants?limit=1    → meta.total = 0
GET /api/v1/phase1/jobs?limit=1           → meta.total = 0
GET /api/v1/phase1/events?limit=1         → meta.total = 0
GET /api/v1/phase1/success-stories?limit=1→ meta.total = 0
GET /api/v1/phase1/testimonials?limit=1   → meta.total = 0
```
By contrast: countries 13, courses 12, subjects 5.

**Expected.** Enough realistic data for the client to demonstrate every module.

**Actual.** Listing pages render a correct empty state (HTTP 200, no error), but
no detail page, relationship, comparison or filter can be demonstrated for these
seven modules. The homepage statistics pill reads "0 universities".

**Impact.** Blocks the demo-data requirement, and blocks detail-route acceptance
for 7 modules (their `[slug]` routes have no slug to visit).

**Fix.** Created professional demonstration records through the Admin API —
the same path a client uses — rather than the repo's `demo-seed.ts`, which is
deliberately forbidden in production by `assertDemoCatalogSeedAllowed` and is
also the source of ISS-004's wording. Institution, provider and consultancy
names are plausible and professional but deliberately name no real
organisation, and every overview states that it is demonstration content, so
nothing here reads as an unverified claim about a real institution.

**Result (verified on the live public API):**

| Resource | Before | After |
| --- | ---: | ---: |
| universities | 0 | 5 |
| scholarships | 0 | 3 |
| consultants | 0 | 3 |
| jobs | 0 | 2 |
| events | 0 | 2 |
| success-stories | 0 | 3 |
| testimonials | 0 | 3 |

All 10 Phase 1 content modules now hold data (was 3 of 10). Detail routes that
previously had no slug to visit now resolve — e.g.
`/universities/northlake-institute-of-technology` returns 200 with the correct
`<h1>`. `/compare/universities` now offers real selectable records.

**Status.** RESOLVED — verified on production.

---

## ISS-002 — React hydration error #418 on every country detail page

| | |
| --- | --- |
| **Severity** | Critical |
| **Module** | Country detail (`/study-in-{country}`) |
| **Environment** | Production |

**Description.** The country detail page throws React error #418 ("text content
does not match server-rendered HTML") on load, at all three viewports.

**Reproduction.** Load `/study-in-canada` and read the browser console. Observed
in 3 of 3 viewport runs (desktop 1536, tablet 768, mobile 390).

**Root cause.** Dates and numbers were formatted with the *ambient* locale and
time zone, so Node and the browser formatted them independently. The page
renders `verified Jul 26, 2026`; proven divergence for the same instant:
```
2026-07-26T02:00:00Z → "Jul 26, 2026" (UTC, server)
2026-07-26T02:00:00Z → "Jul 25, 2026" (America/Los_Angeles, browser)
```
React discards server HTML on mismatch, costing the SSR benefit and risking
visibly wrong content.

**Fix.** Added `apps/web/src/lib/format.ts` pinning locale *and* time zone;
routed all 4 date sites and 11 number sites through it. Rendering a published
verification date in UTC is also more correct — it is a fact about the record,
not about the reader's location.

**Files changed.** `lib/format.ts` (new), `lib/format.test.ts` (new),
`ApprovedTemplatePages.tsx`, `CountryStructuredSections.tsx`,
`CoursePageView.tsx`, `StatsPill.tsx`, `CourseCatalogTemplate.tsx`,
`ListingCards.tsx`

**PR.** #30 · **Status.** Fix written, CI pending, not yet deployed.

---

## ISS-003 — Raw URL slugs shown as visitor-facing text

| | |
| --- | --- |
| **Severity** | Major |
| **Module** | Country city listing; Counselling form |
| **Environment** | Production |

**Description.** Two surfaces printed URL slugs verbatim.

**Reproduction and evidence.**
```
$ curl -s .../study-in/canada/cities | grep '<title>'
<title>Cities in canada | Universta          ← lowercase

$ curl -s '.../counselling?source=course&course=diploma-cybersecurity&country=canada'
Course · diploma cybersecurity · canada      ← on a conversion page
```
The city listing's `<h1>` was additionally a bare "Cities" with no country
context, despite being reachable from the global `/cities` index and search.

**Root cause.** `countrySlug.replaceAll('-', ' ')` and
`detail.replace(/-/g, ' ')` used as display text. The country-scoped city API
already returns `meta.country.name` ("Canada"); it was simply not used.

**Fix.** Use the stored display name where available; added a shared
`labelFromSlug` title-case fallback so the rule lives in one place. It is only
ever a fallback — a stored name always wins, since casing like "PhD" or
"University of Toronto" cannot be recovered from a slug.

**Files changed.** `lib/slug-label.ts` (new), `lib/slug-label.test.ts` (new),
`lib/locations.ts`, `study-in/[countrySlug]/cities/page.tsx`,
`CounsellingForm.tsx`, plus 2 e2e specs that had encoded the buggy strings.

**PR.** #30 · **Status.** Fix written, CI pending, not yet deployed.

---

## ISS-004 — "Fictional" appears in public meta descriptions

| | |
| --- | --- |
| **Severity** | Major (client-facing) |
| **Module** | Country detail, Course detail |
| **Environment** | Production |

**Description.** Public meta descriptions — the text search engines show —
describe the content as fictional.

**Evidence.**
```
/study-in-canada             → "Explore fictional study options, costs, intakes and courses …"
/courses/diploma-cybersecurity→ "Fictional Diploma in Cybersecurity record for local course d…"
```

**Expected.** Professional descriptions suitable for a client demonstration.

**Impact.** Directly contradicts the demo-data requirement; visible to search
engines and to anyone the client demonstrates the platform to.

**Status.** OPEN — remediation is part of the demo-data work (ISS-001).

---

## ISS-005 — Missing canonical URL on subject specializations

| | |
| --- | --- |
| **Severity** | Major (SEO) |
| **Module** | Subject specializations |
| **Environment** | Production |

**Description.** `/subjects/{slug}/specializations` emits no
`<link rel="canonical">`. Every other audited route emits one.

**Reproduction.** Observed `canonical: null` at all three viewports in the
route sweep; every sibling route returned a canonical.

**Fix.** `generateMetadata` now declares
`alternates.canonical = /subjects/{slug}/specializations`, matching every
other public route (including on the not-found branch).

**Files changed.** `subjects/[slug]/specializations/page.tsx`

**PR.** #30 · **Status.** Fix written, CI pending, not yet deployed.

---

## ISS-006 — Adjacent heading fragments render without a separating space

| | |
| --- | --- |
| **Severity** | Minor (accessibility / SEO) |
| **Module** | Course listing, Subject specializations |
| **Environment** | Production |

**Description.** Two `<h1>`s concatenate without whitespace in their text
content, which is what screen readers announce and what search engines index.

**Evidence.**
```
/courses                                   → "Find the Perfect Courseto Study Abroad"
/subjects/computer-science/specializations → "Explore Computer ScienceSpecializations"
```
Visually these wrap onto separate lines, so the defect is invisible on screen
but present in the accessibility tree.

**Root cause.** JSX strips the whitespace surrounding a `<br />`, so the
element supplies the visual line break but no text separator.

**Fix.** An explicit `{' '}` before each `<br />`, in all three headings
(the two observed plus a duplicate of the courses hero in a second template).

**Files changed.** `AcademicTemplatePages.tsx`, `CourseCatalogTemplate.tsx`,
`ApprovedTemplatePages.tsx`

**PR.** #30 · **Status.** Fix written, CI pending, not yet deployed.

---

## Summary

| ID | Severity | Status |
| --- | --- | --- |
| ISS-001 | Blocker | RESOLVED (production data created) |
| ISS-002 | Critical | RESOLVED — deployed `63f7f3c`, verified live |
| ISS-003 | Major | RESOLVED — deployed `63f7f3c`, verified live |
| ISS-004 | Major | OPEN |
| ISS-005 | Major | RESOLVED — deployed `63f7f3c`, verified live |
| ISS-006 | Minor | RESOLVED — deployed `63f7f3c`, verified live |
| ISS-007 | Major | OPEN — found while creating demo data |

---

## ISS-007 — Creating a success story without `journey` returns HTTP 500

| | |
| --- | --- |
| **Severity** | Major |
| **Module** | Admin → Success stories |
| **Environment** | Production |

**Description.** `POST /api/v1/admin/phase1/success-stories` without a
`journey` value returns `500 INTERNAL_ERROR` instead of a `422` naming the
missing field.

**Reproduction.** Observed three times while creating demonstration content:
```
POST /admin/phase1/success-stories {title, slug, status}
→ 500 {"code":"INTERNAL_ERROR","message":"Internal server error"}
```
By contrast, every sibling resource returns a precise 422:
`TITLE_REQUIRED`, `QUOTE_REQUIRED`, `EVENT_START_REQUIRED`.

**Root cause.** `SuccessStory.journey` is `String @db.LongText` — NOT NULL with
no default — but `expanded.service.ts` has no required-field guard for it, so
the Prisma write throws and surfaces as a generic 500.

**Impact.** An admin who leaves the story body empty gets an opaque "Internal
server error" with no indication of which field is wrong.

**Status.** OPEN.
