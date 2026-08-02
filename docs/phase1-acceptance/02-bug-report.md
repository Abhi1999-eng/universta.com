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

**Status.** OPEN — data creation not yet performed.

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

---

## ISS-007 — Success stories returned 500 instead of naming the missing field

**Where.** `POST /admin/expanded/success-stories`

**Symptom.** Creating a success story without a journey body answered HTTP 500.
A server error tells an admin nothing about what to correct, and the record
could not be created at all through the intended workflow.

**Root cause.** The journey field was dereferenced before it was validated.

**Fix.** A `JOURNEY_REQUIRED` guard, so the API answers a validation error that
names the field.

**Files changed.** `apps/api/src/expanded/expanded.service.ts`

**PR.** #31 · **Status.** Fixed and deployed.

---

## ISS-008 — A blank Subject slug was rejected despite the field inviting it

**Where.** Admin → Subjects → Create subject

**Symptom.** The Slug field's placeholder reads "Generated from name", but
leaving it blank failed with `VALIDATION_ERROR` — "slug must be longer than or
equal to 1 characters". The advertised default creation path did not work.

**Root cause.** The form held the untouched field as `""` and sent that. The
API types slug as *optional*; an empty string is not the same as an absent key.

**Proven against production.** `POST` with `slug: ""` → 422. `POST` with the
key omitted → 201 with the slug derived from the name.

**Fix.** Blank optional values are dropped from the payload — `JSON.stringify`
removes `undefined` keys, which is what lets the server derive the slug.

**Files changed.** `apps/admin/src/features/catalog/SubjectForm.tsx`

**PR.** #32 · **Status.** Fixed and deployed. Pinned by `subject-slug-payload.test.ts`.

---

## ISS-009 — A Subject could not be created without choosing media

**Where.** Admin → Subjects → Create subject

**Symptom.** Creating a subject without picking an icon, listing or hero image
failed with "iconMediaId must be a UUID". Since all three pickers are optional,
a default creation could not succeed at all.

**Root cause.** Same as ISS-008 — the three unset pickers were sent as `""`
against fields typed as optional UUIDs.

**Fix.** Unset media ids are omitted from the payload so the server stores null.

**Files changed.** `apps/admin/src/features/catalog/SubjectForm.tsx`

**PR.** #32 · **Status.** Fixed and deployed. Pinned by `subject-slug-payload.test.ts`.

---

## ISS-010 — The Subject editor opened blank for every subject without SEO

**Where.** Admin → Subjects → Edit (all five production subjects)

**Symptom.** The editor rendered with empty fields and "Catalog request
failed". The module was effectively uneditable.

**Root cause.** The SEO endpoints answer `{ data: null }` to mean "no SEO
configured yet". The shared `request` helper treated *any* null payload as a
failure and threw. Because the editor loads the record and its SEO with
`Promise.all`, that rejection discarded the record too.

**Fix.** A `requestNullable` helper for endpoints where a null payload is a
legitimate answer; `getSubjectSeo` and `getCourseSeo` use it. A real API error
still throws, so genuine failures are not swallowed.

**Files changed.** `apps/admin/src/features/catalog/catalog-client.ts`

**PR.** #33 · **Status.** Fixed and deployed. Pinned by `seo-nullable.test.ts`.

---

## ISS-011 — Every media picker failed to load its library

**Where.** Admin → Subjects → Edit, and Admin → Courses → Edit

**Symptom.** All three Subject media pickers showed "No media selected" — even
for records that already had an image attached — and opening a picker offered
an empty library.

**Root cause.** `MediaOptionsQueryDto` validates `limit` with `@Max(50)`. Both
editors requested `limit: 100`, so the endpoint answered 400 and neither ever
received a media list. The Subject editor swallowed the rejection with
`.catch(() => undefined)`, which is why it surfaced as "no media" rather than
as an error.

**Proven against production.**

| Request | Result |
| --- | --- |
| `/admin/media-options?limit=100` | `400` — `limit must not be greater than 50` |
| `/admin/media-options?limit=50` | `200` |
| `/admin/media-options` | `200` |

**Fix.** `listEditorialMedia` clamps `limit` to the documented maximum so no
call site can exceed the contract; both editors ask for 50; and the Subject
editor surfaces a media-load failure instead of hiding it.

**Files changed.** `catalog-client.ts`, `SubjectForm.tsx`, `CourseForm.tsx`

**PR.** #34 · **Status.** Fixed and deployed. Pinned by `media-options-limit.test.ts`.

---

## ISS-012 — The console could hang on "Checking your admin session…" forever

**Severity.** Critical — the admin becomes unusable until a hard reload.

**Where.** Any protected admin route.

**Symptom.** Observed against production during this acceptance pass: an editor
URL held the "Checking your admin session…" screen for a full 60 seconds
instead of rendering its form. This is the same failure family as the
previously reported intermittent login bounce.

**Root cause.** Two compounding faults.

1. The auth `fetch` carried no abort signal, so a connection that opened but
   was never answered stayed pending indefinitely.
2. `initializeSession` awaited `refreshSession()` with no catch, and nothing
   re-runs that effect. `ProtectedBoundary` renders the checking screen while
   `status === 'initializing'`, so a step that neither resolved nor rejected
   stranded the console there permanently.

`refreshSession` also shares one module-level promise between all callers, so a
single stalled refresh handed every later caller the same hung promise.

**Fix.** Auth requests are bounded by a 15s timeout so they always settle, and
`initializeSession` always reaches a terminal status. A timeout is not a
verdict on the session — `performRefresh` already treats a non-rejection
failure as "the refresh did not happen" and leaves the session standing.

**Files changed.** `auth-client.ts`, `AuthProvider.tsx`

**PR.** #35 · **Status.** Fixed and deployed. Pinned by `session-init.test.tsx`
and `auth-timeout.test.ts`. The regression guard was verified to fail without
the fix.

---

## ISS-013 — A junk record sits in the production Universities list

**Severity.** Major — it is publicly visible.

**Where.** Admin → Universities; public `/universities`

**Symptom.** A record named `hvhjhj` with the slug `/lk` is present and
**PUBLISHED**, so it appears on the public universities listing among the five
real institutions.

**Assessment.** This is leftover keyboard-mash test input in the client's own
data, not a code defect. It is listed here because it is client-visible and
must be removed before any demonstration.

**Status.** OPEN — flagged for removal. Not deleted unilaterally: it is the
client's production record, and deletion is theirs to authorise.

---

## ISS-014 — "Add Campuse" is not a word

**Severity.** Cosmetic.

**Where.** Admin → Universities → editor, repeatable groups.

**Symptom.** The button reads **"Add Campuse"**. The label is built by
singularising "Campuses" by trimming a trailing "s", which is wrong for a word
whose plural adds "es". "Add Accreditation" beside it is correct.

**Status.** OPEN — cosmetic, batched for a later pass.

---

## ISS-015 — A blocked publish would not say what was missing

**Severity.** Major — the admin is told to fix something without being told what.

**Where.** Admin → Courses → Publish (and the equivalent for Subjects and
Sub-Subjects).

**Symptom.** Publishing a course that is not ready shows *"Complete course
readiness requirements before publishing"* and nothing more. The requirements
are not listed anywhere on the screen, so an admin has no way to discover what
to correct.

**Root cause.** The API is not at fault: it answers 422 with a per-field
breakdown. The admin's BFF proxy filters error details through an allow-list
that named only `COUNTRY_NOT_READY`, so the other three readiness codes were
flattened to `details: null`.

**Proven against production** — publishing an unready course:

| Path | `error.details` |
| --- | --- |
| API directly | `[{"field":"studyModes",…},{"field":"countries",…}]` |
| Admin BFF proxy | `null` |

The two requirements actually missing were "At least one active Study Mode is
required" and "At least one verified available published country mapping is
required" — both computed correctly, both discarded in transit.

**Affected codes.** `COURSE_NOT_READY`, `SUBJECT_NOT_READY`,
`SUB_SUBJECT_NOT_READY`. `COUNTRY_NOT_READY` already worked.

**Fix.** `safeDetails` passes details through for any `*_NOT_READY` code rather
than naming them one at a time. These lists are authored by our own services,
carry no record content, and the API already runs `redactSensitiveFields` over
them.

**Files changed.** `apps/admin/src/lib/server/catalog-proxy.ts`

**PR.** #36 · **Status.** Fix written and tested; CI running. Pinned by
`readiness-details.test.ts`, which also checks the allow-list still withholds
details for every other code.

---

## Note — the course publish readiness rule is correct

Recorded because it looks like a defect and is not. A course is publishable
only once **all** of the following hold:

1. it has a name and a slug;
2. its Subject is published;
3. its Sub-Subject, if set, is published;
4. its Course Level is active;
5. it has at least one active Study Mode;
6. it has at least one country mapping that is active, available or limited,
   attached to a published country, and carries both a source reference and a
   verification date.

The gate holds correctly and the refusal reaches the screen (coverage sheet
CR-32). Only the missing per-field breakdown was a defect — that is ISS-015.

---

## ISS-016 — University course offerings holds zero records

**Severity.** Major — it makes three admin controls unusable and leaves a gap
in the catalog.

**Where.** Admin → University course offerings. Surfaces as an empty relation
in Success stories, Testimonials and Scholarships.

**Symptom.** `GET /admin/phase1/offerings` answers `200` with an empty array.
Because there are no offerings, the "University course offering (optional)"
select in the Success story and Testimonial editors offers nothing but its
placeholder, and the Scholarship editor's "Eligible university course
offerings" matrix has no rows to tick.

**Assessment.** This is not a code defect. The control renders correctly and
would populate the moment an offering existed — it was verified against the API
rather than inferred from the empty select, which is why it is recorded as
*not applicable* in the coverage sheet rather than as a failure.

It is a **content gap**, in the same family as ISS-001: an offering is what
connects a university to a course, so without any, a visitor cannot get from a
university to what it actually teaches, and three admin controls can never be
used.

**Status.** OPEN — client-owned data. The module and its import path already
work; it needs records.

---

## Summary

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| ISS-001 | Blocker | Content data | Fixed — seven modules populated |
| ISS-002 | Critical | Web rendering | Fixed, deployed (PR #30) |
| ISS-003 | Major | Web rendering | Fixed, deployed (PR #30) |
| ISS-004 | Major | Content copy | **OPEN** |
| ISS-005 | Major | SEO | Fixed, deployed (PR #30) |
| ISS-006 | Minor | Accessibility | Fixed, deployed (PR #30) |
| ISS-007 | Major | API | Fixed, deployed (PR #31) |
| ISS-008 | Major | Admin — Subjects | Fixed, deployed (PR #32) |
| ISS-009 | Major | Admin — Subjects | Fixed, deployed (PR #32) |
| ISS-010 | Critical | Admin — Subjects | Fixed, deployed (PR #33) |
| ISS-011 | Major | Admin — media | Fixed, deployed (PR #34) |
| ISS-012 | Critical | Admin — auth | Fixed, deployed (PR #35) |
| ISS-013 | Major | Client data | **OPEN** — needs client sign-off to delete |
| ISS-014 | Cosmetic | Admin — Universities | **OPEN** |
| ISS-015 | Major | Admin — proxy | Fixed, deployed (PR #36) |
| ISS-016 | Major | Content data | **OPEN** — client-owned |

Twelve are fixed and deployed. The four that remain open are all decisions
about content rather than code: two are client-owned records (ISS-013,
ISS-016), one is client-owned copy (ISS-004), and one is cosmetic (ISS-014).
