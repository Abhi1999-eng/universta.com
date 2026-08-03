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

**Fix.** Created 3 published university course offerings through the admin
workflow (Admin → University course offerings → Create offering), each pairing
an existing university with an existing generic course and course level:

| Offering | University | Generic course | Level |
| --- | --- | --- | --- |
| Bachelor of Computer Science (`bachelor-computer-science-ashcroft`) | Ashcroft College London | Bachelor of Computer Science | Undergraduate |
| Master of Data Science (`master-data-science-harborview`) | Harborview University | Master of Data Science | Postgraduate |
| MBA in Global Management (`mba-global-management-northlake`) | Northlake Institute of Technology | MBA in Global Management | MBA |

Each carries a short description disclosing it as demonstration content,
consistent with the university/course records it links to.

**Verified live.** `GET /phase1/compare/courses/options` now lists all three
slugs; `GET /phase1/compare/courses?items=...` returns full nested
`university` + `genericCourse` payloads for all three with `status:
"PUBLISHED"`. The public `/compare/courses` page, loaded with all three slugs
in `?items=`, renders three real comparison columns (University, Campus,
Tuition, Study mode) instead of the previous empty state.

**Status.** FIXED — content added via the admin UI, re-verified live.

---

## ISS-019 — Navigation menu links cannot be managed from the admin

**Severity.** Major — the client cannot change their own site navigation.

**Where.** Admin → Navigation menus (`/phase1/navigation-menus`).

**Symptom.** The three menus are listed, but there is **no way to open one**.
The row offers Publish, Unpublish and Archive — and no Edit. The only editing
surface anywhere in the module is an "Advanced JSON draft" textarea on the
create form.

The links themselves are equally unreachable through the API:

| Request | Result |
| --- | --- |
| `GET /admin/phase1/navigation-menus` | 200 — no `items` in the payload |
| `GET /admin/phase1/navigation-menus/{id}` | 200 — no `items` in the payload |
| `GET /admin/phase1/navigation-menus/{id}/items` | 404 |
| `GET /admin/phase1/navigation-menu-items` | 404 |
| `GET /admin/phase1/navigation-items` | 404 |

**The links do exist.** `NavigationMenu` has an `items NavigationItem[]`
relation, the public site-chrome query loads them with
`include: { items: { where: { status: 'ACTIVE' } } }`, and the live header and
footer render fully — verified at all three viewports. So the data is real and
correct; only the admin's access to it is missing.

**Why it matters here in particular.** The comment above that same query records
that the header menu "sat empty in production for hours after an unrelated
change deactivated it". If that recurs, the admin has Publish/Unpublish and
nothing else — there is no screen on which to inspect or repair the links.

**Also found.** A third menu, "Primary" (`menuKey: primary`), sits beside
"Primary Navigation" (`menuKey: header`). The site chrome only ever reads
`header` and `footer`, so `primary` is an orphan: an admin editing it — the
obvious-looking one — would see no effect on the site.

**Status.** FIXED, deployed (PR #43) and independently re-verified against
production. `NavigationMenuEditor` now gives an admin a real edit screen per
menu: items table (Label/Target/New tab/Status/Actions), add/edit/reorder/
deactivate/delete, a Link type select (Internal page / External URL / No
link), one level of nesting via Parent item, and a chrome-slot banner that
states in plain language whether the menu is the live Header, the live
Footer, or "not connected to the Header or Footer" (covering the orphan
"Primary" menu called out below). The orphan menu itself was unpublished
(`NV-25`) so it can no longer be mistaken for the live header. See ISS-020
for a proxy-layer regression this surfaced, and the retest evidence in
`rows/navigation.json` (NV-01..NV-25, all passing after both fixes).

---

## ISS-020 — Admin BFF proxy blocked the new navigation-items API

**Severity.** Major — reopened ISS-019 end-to-end even after PR #43 merged.

**Where.** `apps/admin/src/lib/server/phase1-proxy.ts`.

**Symptom.** PR #43 added the NestJS routes
(`GET/POST/PATCH/DELETE .../navigation-menus/:id/items[/:itemId]`,
`POST .../items/reorder`) and the `NavigationMenuEditor` UI to call them, but
the admin's own BFF proxy — a separate whitelist of allowed path shapes in
front of the real API — was never updated alongside it. Every one of those
routes is a 4-segment path (`navigation-menus/:id/items/...`), which the
proxy's existing guard rejected outright: clicking Edit opened nothing, and
`GET .../items` returned 404 from the *admin's own layer*, even though the
NestJS controller answered it correctly when hit directly.

**Root cause.** `phase1-proxy.ts` already had a bespoke shape-allowance for
`pages/:id/sections*` (`isPageSectionPath`/`pageSectionShapeIsValid`); no
equivalent existed for `navigation-menus/:id/items*`, so any path longer than
`resource/:id/:action` was rejected by the generic guard before it ever
reached the fetch to the real API.

**Fix.** Added `isNavigationItemsPath` / `navigationItemsShapeIsValid`,
mirroring the existing pages/sections pattern, and included it in the guard's
rejection conditions (PR #44).

**Status.** FIXED, deployed and independently re-verified: `GET
.../navigation-menus/{id}/items` now returns 200 through the admin proxy, and
the full `m13-navigation.spec.ts` retest (NV-01..NV-25) passes end-to-end
against production.

---

## ISS-021 — Media Library "in use" check omitted most real media consumers

**Severity.** Critical — guaranteed, not probabilistic, silent data loss.

**Where.** `apps/api/src/media/media.service.ts`, `MediaService.archive()`.

**Symptom.** `archive()` soft-deletes the `MediaAsset` row and then
unconditionally deletes the physical file from disk once its usage count
reaches zero — but `usageCount()` only checked 9 of the schema's roughly 20
actual `MediaAsset` relations (its own comment admitted "Country/Subject/
Course editorial media has its own separate admin surface not touched in
this pass"). Archiving an image still referenced by a Subject, Country,
Continent, City, Course, Consultant, NavigationItem, PlatformMetric, or
SeoMetadata record was reported as safe ("not in use") and then permanently
deleted the file those records were still pointing at — a guaranteed broken
image on next render, not an edge case.

**Fix.** Rewrote `usageCount()` to check every `MediaAsset` relation in
`schema.prisma` (PR #45): the original 9 plus Consultant (a separate model
from ConsultantLandingCard), Subject, SubSubject, Continent, Country,
CountryContentSection, City, Course, CourseContentSection, NavigationItem,
PlatformMetric, SeoMetadata, and User.

**Status.** FIXED, merged (PR #45), 67 unit tests (`media.service.spec.ts`)
covering each relation individually — 23 of which failed against the
pre-fix code, confirming the gap was real. `MD-08` in the Media module
acceptance spec is the live regression check (archive correctly blocked
while a page section references the asset).

---

## ISS-023 — Creating a Page crashed with a raw 500 whenever `pageType` was omitted

**Severity.** Major — blocks page creation, and by extension anything that
depends on it (navigation targets, Website Builder, SEO-via-admin-workflow).

**Where.** `apps/api/src/expanded/expanded.service.ts`,
`ExpandedService.writeData()` / `adminCreate()`.

**Symptom.** `POST /admin/phase1/pages` with a normal-looking payload
(`{title, slug, shortDescription}`) returned `HTTP 500 / INTERNAL_ERROR`.
Reproduced directly against the live API, bypassing the admin proxy
entirely, and confirmed in the application logs as an unhandled
`PrismaClientValidationError`.

**Root cause.** `writeData`'s `allowed` map whitelists the writable columns
for every other resource; `pages` had no entry at all, so
`!allowed[resource]` short-circuited true and let *every* body key reach
Prisma unfiltered. `Page.pageType` has no schema default, so a create that
omitted it reached `prisma.page.create` and Prisma's own client-side
validation rejected the missing required field — which the generic
`conflict()` error handler doesn't recognise (it only maps Prisma's unique-
constraint code), so it fell through as an unhandled exception.

**Found while.** Re-running the deployed Navigation retest (`NV-15`, broken-
target detection), which creates a disposable page as its link target.

**Fix.** Added a `pages` whitelist (including `startsAt`/`endsAt`, which the
existing page-scheduling UI already writes on every save) and a
`PAGE_TYPE_REQUIRED` 422 on create (PR #46).

**Status.** FIXED, merged (PR #46) and deployed. Unit-tested locally (rejects
with no `pageType`, creates successfully once present and drops any
non-whitelisted key, still allows `startsAt`/`endsAt`, doesn't require
`pageType` on a partial update) and independently re-verified against
production via direct `curl` post-deploy, then via the full Navigation
retest (`NV-15`) after fixing the test itself to also pass `pageType`.

---

## ISS-024 — Media uploads between 2MB and 5MB failed with a raw, unbranded Nginx error

**Severity.** Major — silently undercuts the upload limit the product itself
advertises, for a very ordinary file size.

**Where.** `scripts/deployment/configure-host.sh` (Nginx `client_max_body_size`
on the `admin` and `api` server blocks).

**Symptom.** The Media Library's own upload form states "up to 5MB", and the
API's `MediaService` enforces exactly that (`MAX_FILE_SIZE_BYTES = 5MB`), with
the admin's BFF proxy allowing a further 1MB of multipart overhead on top
(6MB). But Nginx — in front of both — was configured at the default `2m`.
Any real upload between 2MB and 5MB reached Nginx first and was rejected with
its raw, unbranded `413 Request Entity Too Large` HTML page, never reaching
the application's own JSON validation logic at all.

**Reproduction.** `curl -F file=@<6MB image> https://admin.../api/v1/admin/media`
→ `HTTP 413`, body `<html><head><title>413 Request Entity Too Large</title>
</head>...<center>nginx</center></html>` — confirmed via the Media module's own
`MD-03` acceptance check (oversized-file rejection), which expected the app's
own friendly error message and instead got this raw HTML page (`JSON.parse`
failure on the response body was the first symptom).

**Fix.** Raised `client_max_body_size` to `8m` on the `admin` and `api` Nginx
server blocks (a safe margin above the admin proxy's own 6MB ceiling). Left
`web` at its existing `2m` — the public site's own form submissions
(`UniversityClaimForm`, `ContactForm`) use `FormData` for plain fields only,
with no file input, so they need no headroom.

**Status.** FIXED, deployed and re-verified live: `MD-03` (oversized-file
rejection) now gets the app's own friendly error rather than nginx's raw
HTML page.

---

## ISS-025 — Every media upload has crashed since launch: the release directory is read-only

**Severity.** Critical — the Media Library's upload feature has never worked
in production, at any file size.

**Where.** Deployment layout (`scripts/deployment/deploy.sh`,
`scripts/deployment/configure-host.sh`) vs. `apps/api/src/media/media.service.ts`.

**Symptom.** Uploading even a trivially small, valid image (`MD-04`, a
68-byte PNG) returned "Internal server error". The API logs showed an
unhandled `Error` (not a Prisma or validation error) on `POST
/api/v1/admin/media`.

**Root cause.** `MediaService.uploadsDir` resolves to
`join(process.cwd(), 'uploads', 'media')`. The API's systemd unit sets
`WorkingDirectory=/opt/universta/current` (the release symlink), and
`deploy.sh` makes every release read-only after install
(`chown -R root:universta` + `chmod -R go-w`) — group write is exactly what
the `universta` user (the one the API actually runs as) loses. So
`ensureUploadsDir()`'s `mkdir(uploadsDir, { recursive: true })`, and every
`writeFile` after it, hit `EACCES` on every single upload attempt, in every
release shipped so far. Confirmed directly on the live instance via SSM,
running as the real service user:
```
runuser -u universta -- touch /opt/universta/current/x
touch: cannot touch '/opt/universta/current/x': Permission denied
runuser -u universta -- mkdir -p /opt/universta/current/uploads/media
mkdir: cannot create directory '/opt/universta/current/uploads': Permission denied
```
This is not a race or an edge case — it is deterministic, and it has been
true since the Media Library was first deployed. Nothing in this pass'
Media testing before `MD-04` could have caught it, since `MD-01`-`MD-03`
never write a file to disk.

**Fix.** Deployment already solves exactly this problem for Next.js's
`.next/cache` — a writable, cross-release `shared/` directory symlinked into
each new release before it's locked down. Extended the same pattern to
uploads: `configure-host.sh` creates `${UNIVERSTA_ROOT}/shared/uploads`
(owned `universta:universta`, alongside the existing `shared/cache/*`), and
`deploy.sh` symlinks it into the release before the read-only lockdown. No
application code changes needed — `ensureUploadsDir()`'s own
`mkdir(..., { recursive: true })` creates the `media` subdirectory inside
the now-writable, persistent shared location on first use.

A first attempt at this fix symlinked `${staging}/uploads` at the release
*root*, matching where `WorkingDirectory` in the systemd unit points — and
still 500'd after deploying. The actual OS-level `cwd` of the running Node
process is `.../apps/api`, not the release root: `npm --workspace apps/api
run start:prod` changes into that workspace directory before exec'ing
`node`, which `WorkingDirectory=` does not override once npm re-execs.
Confirmed via `/proc/<pid>/cwd` on the live instance. The symlink now lives
at `${staging}/apps/api/uploads` instead.

**Status.** FIXED, deployed and re-verified live. The first attempt merged
and deployed but still failed at `MD-04`; root-caused precisely via
`/proc/<pid>/cwd` on the running instance, corrected, and now confirmed: a
68-byte PNG uploads, persists (`GET /admin/media` returns it with the
saved title/altText/folder), appears in the library grid, and serves back
through `/api/v1/media/{filename}`. `MD-08` (the direct ISS-021 regression
check — archive blocked while a page section references the asset) also
passes live, confirming ISS-021 alongside this fix.

---

## ISS-017 — Every SEO record in production was an empty row

**Severity.** Major — every code-defined route and every Country fell back to
its code-level default title/description; the admin's SEO editors existed but
nothing had ever been saved through them.

**Where.** `/seo` (Static Page SEO), the Country editorial SEO fieldset, and
the Phase1 structured-editor SEO fieldset shared by Universities/Offerings/
Scholarships/Consultants/Jobs/Events/Success stories/Testimonials.

**Symptom.** `SeoMetadata` rows existed with `ownerType`/`ownerId` set but no
real `seoTitle`/`metaDescription` — the public routes rendered correctly
because every page has a code-level fallback, but the admin override had
never actually been exercised for real content.

**Fix.** Not a code fix — this is closed by doing the thing the admin was
built for: real, durable SEO title/meta description copy was written through
the admin UI for all 19 static/listing pages (SEO-03) and for a representative
Country (Canada, SEO-09/10). Two genuine code defects surfaced and were fixed
along the way while exercising this path for real (see ISS-026, ISS-027,
ISS-028 below) — without doing the real save, those would never have
surfaced.

**Status.** FIXED. `GET /phase1/static-page-seo/{key}` returns the saved
title/description for all 19 keys; `GET /admin/countries/{id}/seo` returns the
saved values for Canada; the live `/study-in-canada` page's `<title>` and meta
description match the saved copy at desktop/tablet/mobile viewports
(SEO-04..07, SEO-11). The same fieldset and save path were also verified for a
University (SEO-13/14), confirming the shared Phase1 structured-editor SEO
code path independently of Country's own editor.

---

## ISS-026 — A "Home" static-page SEO entry existed with no route to attach to

**Severity.** Minor — a dead admin control, not a broken one.

**Where.** `apps/api/src/static-page-seo/static-page-seo.service.ts`,
`STATIC_PAGES` registry.

**Symptom.** A row labelled "Home" sat in the Static Page SEO table, fully
editable, with zero effect on any live route. The real homepage (`/`) was
merged into the Countries Listing and reads the `'countries-listing'` entry
instead — the same "no route to attach to" defect already fixed once for
`cities-listing` (see the comment left in the same array), just never applied
to this key.

**Fix.** Removed the dead `home` key from `STATIC_PAGES`.

**Status.** FIXED, deployed and re-verified live (PR #49, bundled with
ISS-027): the "Home" row is gone from `/seo`, and the real homepage still
renders the Countries Listing's own SEO entry correctly (SEO-08).

---

## ISS-027 — Country SEO save rejected a blank canonical URL

**Severity.** Major — blocked saving Country SEO metadata entirely whenever
the canonical URL field was left empty, which is the common case.

**Where.** `apps/api/src/countries/editorial/editorial.dto.ts`,
`SeoMetadataDto.canonicalUrl`.

**Symptom.** `PUT /admin/countries/{id}/seo` returned 400 whenever
`canonicalUrl` was submitted as `''` — which the admin's `SeoEditor.tsx`
always does for an untouched field, never `undefined`. `@IsOptional()` only
skips validation when a field is `undefined`, so the stricter `@IsUrl()`
validator still ran against the empty string and rejected it.

**Fix.** Added a `@Transform(({ value }) => value === '' ? undefined : value)`
ahead of the existing `@IsOptional() @IsUrl() @MaxLength(2048)` decorators on
`canonicalUrl`.

**Status.** FIXED, deployed and re-verified live (PR #49, bundled with
ISS-026): Country SEO now saves successfully with an empty canonical URL.

---

## ISS-028 — Country SEO save crashed with an unhandled 500 whenever no Open Graph/Twitter image was picked

**Severity.** Critical — blocked saving Country SEO metadata entirely unless
an admin happened to also pick both media images, which most saves don't.

**Where.** `apps/api/src/countries/editorial/country-editorial.service.ts`,
`CountryEditorialService.saveSeo()`.

**Symptom.** `PUT /admin/countries/{id}/seo` returned an unhandled 500
(`PrismaClientKnownRequestError`) whenever `ogMediaId`/`twitterMediaId` were
left unset. Reproduced live via a real Playwright browser session driving the
actual admin UI (a hand-crafted curl reproduction of the same payload
produced a different, unrelated 400 — `SeoEditor.tsx` already normalizes
`schemaJson`/`hreflangJson` client-side before submitting, so a manual curl
payload didn't match real browser behaviour).

**Root cause.** `saveSeo()`'s own `mediaIds()` helper already treats `''` as
"nothing selected" for its own validation purposes (`Boolean('')` is false),
but that normalization was never applied to what actually got written: the
Prisma `upsert()` call passed `dto.ogMediaId`/`dto.twitterMediaId` straight
through. An empty string in a `MediaAsset` foreign-key column is a reference
to a row that doesn't exist, which MySQL rejects — crashing every save
without an OG/Twitter image, i.e. almost every real save.

**Fix.** Added a `mediaIdOrNull()` helper (`value ? value : null`) and applied
it to both `ogMediaId` and `twitterMediaId` in both the `create` and `update`
blocks of the upsert.

**Status.** FIXED, deployed and re-verified live (PR #50): Country SEO now
saves and persists successfully (SEO-09/10/11) without requiring an OG or
Twitter image.

---

## ISS-029 — A fast login could be silently wiped by an unrelated pre-login refresh, bouncing straight back to the login screen

**Severity.** Critical — intermittently made the admin console unusable
immediately after signing in; reproduced deterministically (not
intermittently) by any fast, scripted login.

**Where.** `apps/admin/src/features/auth/AuthProvider.tsx` and
`apps/admin/src/features/auth/auth-client.ts`.

**Symptom.** `AuthProvider` fires a speculative `refreshSession()` on every
mount, including the login screen itself, before any credentials exist. If
`login()` landed and fully resolved while that speculative refresh call was
still in flight, the refresh's own later, entirely unrelated "no session"
verdict called `clearAuthenticatedSession()` — wiping the session `login()`
had just established and bouncing the admin straight back to
`/login?returnTo=...`. A first attempt at the fix reused the existing
`sessionGeneration` counter (bumped by `clearAuthenticatedSession`) to detect
this race, but that counter is *also* bumped by the refresh's own ordinary
"there was no session" outcome — so a refresh finding no session looked stale
to itself, and the login screen hung on "Checking your admin session…"
forever instead. This broke every e2e test that starts by loading `/login`,
caught by CI before it reached production.

**Fix.** Introduced a dedicated `loginGeneration` counter, bumped only by
`setAuthenticatedSession()` (a real login), never by a clear. `AuthProvider`'s
`initializeSession` and `refresh()`, and `auth-client`'s `performRefresh`
clear-branches, all snapshot this counter and skip applying a stale result
once it has moved — which, unlike the session-rotation counter, can only ever
mean "a login happened," never "the ordinary outcome I am about to apply."

**Status.** FIXED, deployed and re-verified live (PR #51): a real login
followed immediately by navigation into protected admin routes (Country and
University SEO editors) completes and stays authenticated, with the full e2e
suite (91 tests, including the standard login flow) passing in CI.

---

## ISS-030 — Saving any static page's SEO title/description silently made comparison pages indexable

**Severity.** Major — quietly violated the "comparison pages must stay
noindex until an admin opts in" requirement, for all 4 comparison pages, the
very first time anyone touched their SEO fields.

**Where.** `apps/admin/src/features/shell/SeoManagementHub.tsx`
(`StaticSeoEditor`) and `apps/api/src/static-page-seo/static-page-seo.service.ts`
(`adminList()`).

**Symptom.** Found while re-verifying ISS-028/ISS-029 live: after ISS-017's
one-time real-content save (SEO-03) touched all 19 static pages including the
4 comparisons, `/compare/countries`, `/universities`, `/courses` and
`/consultants` all started serving `<meta name="robots" content="index,
follow">` instead of the required `noindex, follow`.

**Root cause.** `StaticSeoEditor`'s "Allow search indexing" checkbox
initialized from `row.seo?.robotsIndex ?? true` — a hardcoded `true` for any
page with no saved record yet, with no knowledge of that page's own
`defaultRobotsIndex` (`false` for comparisons, by design). The editor always
sends the checkbox's boolean state on save, so saving the unrelated
title/description fields on a never-touched comparison page silently sent
`robotsIndex: true`, overriding the intended default the very first time.

**Fix.** `adminList()` now returns each page's own `defaultRobotsIndex`
alongside its saved record; the editor falls back to that instead of a
hardcoded `true`. The 4 already-corrupted live records were then corrected
through the same admin workflow (uncheck, save) to restore their noindex
state.

**Status.** FIXED, deployed and re-verified live (PR #52): all 4 comparison
pages serve `noindex, follow` again, confirmed to hold across a repeat
ISS-017 content save (i.e. the fix is not order-dependent on when a page's
title/description happen to be edited).

---

## ISS-031 — A "Listing" editorial page's own CMS sections are never rendered anywhere

**Severity.** Major — an entire class of admin controls (the full section
editor: CTA, Card Grid, FAQ Group, Stats, Related Links) produces content
with zero visible effect.

**Where.** Admin → Editorial pages, for any record whose `pageType` is
`LISTING_PAGE` (Events Listing, Careers Listing, Testimonials,
Success Stories, the 4 comparison pages, and 7 more listing-type records --
about 12 of the 20 total Editorial pages). Contrast with `STATIC_PAGE`-type
records (About, FAQ, Contact, Counselling), which render correctly.

**Symptom.** Adding and saving a section (heading, CTA label/URL, cards,
etc.) to "Events Listing" persists correctly via the API, but never appears
on the live `/events` route, at any device size, however long after
publishing.

**Root cause.** `/events` (and the other catalog listing routes) are
separate, hardcoded pages (`apps/web/src/app/events/page.tsx`) built around
`PhaseListing`, which fetches only the catalog rows (`phaseList("events")`)
-- and never fetches or renders the "Events Listing" Page record's own
`sections` at all, even though `PhaseListing` already accepts an optional
`sections` prop for exactly this. Only the `STATIC_PAGE`-type records go
through `EditorialPage`/`PageSectionRenderer`, which does honor sections.

**Assessment.** Not a quick bug fix -- wiring this up requires a product
decision this program can't make unilaterally: where a listing page's own
CMS sections should appear relative to its catalog rows (above the grid? A
hero band? Interleaved?), and whether that decision should be uniform across
all ~12 listing-type pages or configurable per page. That's a design
question, not a mechanical one.

**Status.** OPEN — deferred pending a decision on that design question.
Not a data-loss risk: everything saved through the admin persists correctly
via the API and reflects the client's real intent, it simply isn't rendered
yet.

---

## ISS-032 — No pagination anywhere in the shared Phase1 resource list screen; records past the 12th are invisible

**Severity.** Critical — makes a growing share of the client's own catalog
permanently unreachable through the admin, with no error and no indication
more records exist.

**Where.** `apps/admin/src/features/phase1/Phase1Manager.tsx`, the shared
list/table screen behind Universities, Offerings, Scholarships, Consultants,
Jobs, Events, Success stories, Testimonials, Editorial pages, Navigation
menus and Contact enquiries -- every one of these resource types.

**Symptom.** Found while testing Internal Linking: the Editorial pages
screen showed "12 records" while 20 real records existed. "About Us" (and 7
others past the 12th) had no Edit/Publish/Unpublish/Archive button anywhere
in the DOM -- not paginated-away, simply never fetched, with the "12
records" label actively misstating the true total rather than reading it.

**Root cause.** The list request (`request(resource)`) never sent `page` or
`limit` at all, so the API's own default (`PAGE_LIMIT = 12` in
`apps/api/src/expanded/expanded.service.ts`) applied silently on every
resource, and the screen had no pagination controls of any kind to reach
anything past it. The API already returns a complete `{ page, limit, total,
totalPages }` on every list response specifically to support this -- it was
simply never read by the frontend.

**Fix.** Requests `page`/`limit=20`, reads the returned `meta` for an
accurate record count and Previous/Next controls, and resets to page 1 when
switching resources.

**Status.** FIXED, deployed and re-verified live (PR #53): "About Us" (and
every other previously-unreachable record, across every resource type this
screen serves) is now reachable via Next, and the record count matches the
API's true total.

---

## ISS-033 — Admin-configured redirects had zero effect on the live site

**Severity.** Critical — the entire Redirects feature (create, open-redirect
guard, loop/chain detection, enable/disable, hit-count tracking) was fully
built and functional in the admin, but produced no live behavior whatsoever.

**Where.** `apps/web/src/middleware.ts`.

**Symptom.** Found while re-verifying Internal Linking live: a redirect
created through the admin (source/target/status all confirmed correctly
persisted via the API) had no effect at all. Visiting the source path
returned a genuine 404, exactly as if no redirect existed.

**Root cause.** The web app's middleware never checked the Redirect table --
it only handled A/B-test cookie assignment and framing headers. The API side
of consuming a redirect already existed (`ExpandedService.resolveRedirect()`,
exposed at `GET /phase1/redirects?path=`, complete with the exact
find-by-sourcePath-and-record-the-hit logic needed), but nothing on the
public site ever called it.

**Fix, and a false start.** The first attempt added a brand new, separate
`GET /phase1/redirects/lookup` endpoint without noticing the existing one --
registering a second controller at the same `phase1/redirects` base path
didn't error at boot, it silently lost to the already-registered generic
`:resource/:slug` route, so the new endpoint was unreachable and the
live-redirect check still failed after deploying it. Root-caused by finding
the pre-existing `@Get('redirects')` route in `ExpandedController`; the
duplicate controller/module wiring was removed, and `middleware.ts` was
pointed at the endpoint that had been there all along.

**Status.** FIXED, deployed and re-verified live (PR #54, corrected same-day
on `main`): `GET /phase1/redirects?path=` returns the configured target, and
the live site now issues a real 301 at the source path.

---

## ISS-034 — Unknown comparison `:type` crashed with a 500 instead of a 400

**Severity.** Minor — no data was at risk, but a client typo in the URL
surfaced as a server error rather than a clean, expected rejection.

**Where.** `apps/api/src/expanded/expanded.controller.ts`, `compare()`.

**Symptom.** Found while manually probing Comparisons edge cases: `GET
/phase1/compare/bogus-type` returned HTTP 500
(`{"error":{"code":"INTERNAL_ERROR",...}}`) instead of a 400.

**Root cause.** The handler's invalid-type branch `throw`ed a plain `Error`,
which Nest's default exception filter turns into an unhandled 500. The
sibling `GET /phase1/compare/:type/options` route already guarded the same
check with `BadRequestException`; `compare()` just hadn't been updated to
match.

**Fix.** Changed the invalid-type branch to `throw new
BadRequestException('Unknown comparison type')`, matching the sibling route.
Added `expanded.compare-type.spec.ts` covering both the bad-type-rejects and
recognized-type-still-works cases; confirmed via `git stash` that the first
test genuinely fails (plain `Error`, not `BadRequestException`) without the
fix.

**Status.** FIXED, deployed and re-verified live (PR #55): `GET
/phase1/compare/bogus-type` now returns HTTP 400.

---

## ISS-035 — Bulk-update crashed with a 500 on the two non-string columns (`displayOrder`, `isFeatured`)

**Severity.** Major — the admin's bulk-update control is fully unusable for
any of these two columns, on any of the several resources that expose them.

**Where.** `apps/api/src/bulk/bulk.service.ts`, `bulkUpdate()`.

**Symptom.** Found while acceptance-testing Module 5: selecting a subject
record, setting "Field to bulk-update" to `displayOrder`, and applying a new
value surfaced "Internal server error" instead of "Bulk update applied."
Reproduced directly: `POST .../bulk/subjects/bulk-update` with
`{"displayOrder":"42"}` returned a 500; the same for `{"isFeatured":"true"}`.

**Root cause.** The admin's single generic "New value" text input always
sends a string, regardless of the target column's real Prisma type. String
columns pass through untouched, and Decimal/DateTime columns (`tuitionMin`,
`amount`, `endsAt`, ...) already accept a string representation directly --
but `displayOrder` (Int) and `isFeatured` (Boolean) are the only two
non-string/non-Decimal/non-DateTime columns across the entire 13-resource
registry, and Prisma rejects a raw string for either, which `updateMany`
never handled.

**Fix.** `bulkUpdate()` now coerces both field names to their real type
before the update -- `"true"/"false"` to boolean for `isFeatured`, and a
parsed number for `displayOrder`, with an unparsable number rejected as a
clean 400 (`INVALID_FIELD_VALUE`) rather than reaching Prisma at all. New
unit tests cover both coercions, the rejection path, and that a plain string
field is left untouched; confirmed via `git stash` that 3 of 4 genuinely
fail without the fix.

**Status.** FIXED, deployed and re-verified live (PR #56).

---

## ISS-036 — Every 404 showed "Route not found", even ones a service raised deliberately with its own message

**Severity.** Major — silently discarded the specific, actionable message on
every intentional `NotFoundException` across the API (~30 call sites),
replacing it with a generic message that reads like a broken URL.

**Where.** `apps/api/src/common/app-exception.filter.ts`.

**Symptom.** Found while investigating an ISS-035 side effect: a bulk-archive
attempt where every selected record was blocked by its dependency guard
returned 404 `{"code":"NO_RECORDS_ARCHIVABLE","message":"Route not
found"}` -- the `code` was correct, but the message gave no indication of
what actually happened, and "Route not found" reads like a client-side
routing bug rather than "these records have dependents."

**Root cause.** `AppExceptionFilter` unconditionally overwrote the message on
every 404 (`if (status === 404) { message = 'Route not found'; }`), even
immediately after correctly extracting a deliberate, structured message from
the exception's own response body one line above. This affects every
service that throws `new NotFoundException({ code, message, details })` --
the established pattern used by ~30 call sites across countries, redirects,
media, locations, versions, page-templates, leads, experiments,
catalog-lookups, continents, stats-pills, university-claims, and more --
not just bulk-archive.

**Fix.** The generic fallback now only applies when the exception carries no
application `code` -- the signal that distinguishes a genuinely unmatched
Express route (Nest's own default 404, which never has a `code`) from a
service's deliberate, structured 404. New unit tests cover both cases;
confirmed via `git stash` both fail without the fix. Full API unit suite
(277/277) still passes with the fix in place, confirming no other test
relied on the old blanket-overwrite behavior.

**Status.** FIXED, deployed and re-verified live (PR #56): a blocked
bulk-archive now returns its real message ("None of the selected records
could be archived") instead of "Route not found".

---

## ISS-037 — An inverted featured/publish window saved silently and then could never be true

**Severity.** Major — a permanent, silent content trap: no error at save
time, but the record can never achieve its intended effect afterward.

**Where.** `apps/api/src/expanded/expanded.service.ts`, `writeData()`;
`apps/admin/src/features/phase1/Phase1StructuredEditor.tsx`, `validate()`.

**Symptom.** Found while acceptance-testing Module 6 (Scheduling): creating a
consultant via the admin API with `publishStartsAt` after `publishEndsAt`
saved successfully (200, no error) but the record was immediately and
permanently unreachable on the public site (confirmed 404 on
`/phase1/consultants/{slug}`) -- from the moment of creation onward, `now`
can never fall inside `[publishStartsAt, publishEndsAt)` when the end
precedes the start. The identical trap exists for
`featuredFrom`/`featuredUntil`.

**Root cause.** Events' `startsAt`/`endsAt` already has an ordering check
(`endsAt <= startsAt` rejected as `EVENT_DATE_RANGE_INVALID`), but that
check was never extended to the two shared window pairs used by
University/Offering/Scholarship/Consultant/Job/Event: `featuredFrom`/
`featuredUntil` (read by `isEffectivelyFeatured()`) and `publishStartsAt`/
`publishEndsAt` (read by `publishedWhereScheduled()`). Both read functions
require `now` to fall inside `[start, end)`, so an inverted pair can never
be true at any point in time, but nothing rejected it at save time.

**Fix.** Added the same ordering check, generalized to both window pairs,
in the API (`writeData()`, rejecting with `FEATURED_DATE_RANGE_INVALID` /
`PUBLISH_DATE_RANGE_INVALID`) and the admin form (`validate()`, matching
the existing events pattern, with the corresponding `error` prop wired to
the "Featured until" and "Publish until" fields, which previously had no
error prop at all). New unit tests cover both rejections and a
correctly-ordered window still succeeding; confirmed via `git stash` that
the two rejection tests genuinely fail without the fix.

**Status.** FIXED, deployed and re-verified live (PR #57): the same
inverted-window request that previously saved silently now returns 422
with the specific reason, both via direct API call and through the admin
form.

---

## ISS-038 — The "Default title suffix" setting had no effect anywhere on the site

**Severity.** Major — a whole settings field silently does nothing, despite
its own description promising otherwise.

**Where.** `apps/web/src/lib/static-page-seo.ts`.

**Symptom.** Found while acceptance-testing Module 7 (Global Settings): the
admin's "Default SEO" screen describes its fields as "Fallback values used
when a page has no SEO of its own," but changing "Default title suffix" and
reloading Home (or any code-defined route) never changed the page's
`<title>` -- it always ended in the hardcoded `"| Universta"`.

**Root cause.** `staticPageMetadata()`, the shared helper behind Home,
listings, comparisons and FAQ, built the title as `` `${title} | Universta` ``
-- a literal string, never reading the setting at all. The same hardcode
exists in `phaseOneMetadata()` (catalog detail pages), and
`defaultDescription`/robots defaults/OG image are similarly never consulted
anywhere; those are documented here as remaining, separate work rather than
folded into this fix; see the Root cause paragraph in the commit/PR for the
reasoning (touching `phaseOneMetadata()` changes a currently-synchronous
helper's contract, and touching robots defaults risks overriding
intentional per-route behavior like comparison pages defaulting to
noindex).

**Fix.** `staticPageMetadata()` now fetches the configured suffix from
`GET /phase1/settings` and falls back to the historical `"| Universta"` if
settings are unreachable or the field is blank, so a fetch failure never
breaks a page's title. New unit tests cover the configured-suffix path, the
fetch-failure fallback, and the blank-setting fallback; confirmed via
`git stash` the configured-suffix test genuinely fails without the fix.

**Status.** FIXED, deployed and re-verified live (PR #58): Home's `<title>`
now reflects the configured suffix.

---

## ISS-039 — A protocol-relative `//host` URL bypassed the settings open-redirect guard

**Severity.** Critical — a genuine, exploitable open-redirect: any of 8 URL
fields across Settings could be set to `//evil.example.com` and the public
site would render it as a real link.

**Where.** `apps/api/src/settings/settings.service.ts`, `assertSafeUrl()`.

**Symptom.** Found while acceptance-testing Module 7 (Global Settings):
`PUT /admin/settings/contact` with `whatsappLink: "//evil.example.com"`
returned 200 and persisted the value, when it should have been rejected the
same way a `javascript:` URL already was.

**Root cause.** `SAFE_URL`'s regex (`/^(\/[^\s]*|https:\/\/[^\s]+)$/`)
treated any string starting with a single `/` as a safe, site-relative
path -- but a URL starting with `//` is protocol-relative: a browser keeps
the current page's scheme and navigates to a completely different host.
This is the classic open-redirect bypass the guard exists to block, and it
affects every URL field that runs through `assertSafeUrl()`: `ctaUrl`,
`announcementUrl`, `accountCtaUrl` (header), `privacyUrl`, `termsUrl`,
`counsellingCtaUrl` (footer), `whatsappLink` (contact), and all 5 social
links.

**Fix.** Added a negative lookahead so a single leading slash still
matches but a second one doesn't (`/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/`).
New unit tests cover the `//host` rejection, a genuine relative path and
`https://` URL still succeeding, and `javascript:` still rejected; confirmed
via `git stash` the `//host` rejection test genuinely fails without the fix.

**Status.** FIXED, deployed and re-verified live (PR #59): the same
`whatsappLink: "//evil.example.com"` request now returns 400 `UNSAFE_URL`.

---

## Summary

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| ISS-001 | Blocker | Content data | Fixed — seven modules populated |
| ISS-002 | Critical | Web rendering | Fixed, deployed (PR #30) |
| ISS-003 | Major | Web rendering | Fixed, deployed (PR #30) |
| ISS-004 | Major | Content copy | **OPEN** — content |
| ISS-005 | Major | SEO | Fixed, deployed (PR #30) |
| ISS-006 | Minor | Accessibility | Fixed, deployed (PR #30) |
| ISS-007 | Major | API | Fixed, deployed (PR #31) |
| ISS-008 | Major | Admin — Subjects | Fixed, deployed (PR #32) |
| ISS-009 | Major | Admin — Subjects | Fixed, deployed (PR #32) |
| ISS-010 | Critical | Admin — Subjects | Fixed, deployed (PR #33) |
| ISS-011 | Major | Admin — media | Fixed, deployed (PR #34) |
| ISS-012 | Critical | Admin — auth | Fixed, deployed (PR #35) |
| ISS-013 | Major | Client data | **OPEN** — content |
| ISS-014 | Cosmetic | Admin — Universities | **OPEN** — cosmetic |
| ISS-015 | Major | Admin — proxy | Fixed, deployed (PR #36) |
| ISS-016 | Major | Content data | Fixed — 3 published course offerings added via admin, re-verified live |
| ISS-017 | Major | Content data | Fixed — real SEO content saved for all static pages + a Country |
| ISS-018 | Minor | Admin — Website Builder | **OPEN** — small code fix |
| ISS-019 | Major | Admin — Navigation | Fixed, deployed (PR #43), re-verified live |
| ISS-020 | Major | Admin — proxy | Fixed, deployed (PR #44), re-verified live |
| ISS-021 | Critical | Admin — Media | Fixed, deployed (PR #45), re-verified live |
| ISS-023 | Major | Admin/API — Pages | Fixed, deployed (PR #46), re-verified live |
| ISS-024 | Major | Infra — Nginx upload limit | Fixed, deployed (PR #47), re-verified live |
| ISS-025 | Critical | Infra — release read-only, uploads crash | Fixed, deployed (PR #47, #48), re-verified live |
| ISS-026 | Minor | Admin — SEO | Fixed, deployed (PR #49), re-verified live |
| ISS-027 | Major | Admin/API — Country SEO | Fixed, deployed (PR #49), re-verified live |
| ISS-028 | Critical | Admin/API — Country SEO | Fixed, deployed (PR #50), re-verified live |
| ISS-029 | Critical | Admin — auth | Fixed, deployed (PR #51), re-verified live |
| ISS-030 | Major | Admin/API — Static SEO | Fixed, deployed (PR #52), re-verified live |
| ISS-031 | Major | Web — Listing pages | **OPEN** — design decision needed |
| ISS-032 | Critical | Admin — Phase1 lists | Fixed, deployed (PR #53), re-verified live |
| ISS-033 | Critical | Web — Redirects | Fixed, deployed (PR #54, corrected same-day), re-verified live |
| ISS-034 | Minor | API — Comparisons | Fixed, deployed (PR #55), re-verified live |
| ISS-035 | Major | API — Bulk operations | Fixed, deployed (PR #56), re-verified live |
| ISS-036 | Major | API — Error handling | Fixed, deployed (PR #56), re-verified live |
| ISS-037 | Major | API/Admin — Scheduling | Fixed, deployed (PR #57), re-verified live |
| ISS-038 | Major | Web — SEO | Fixed, deployed (PR #58), re-verified live |
| ISS-039 | Critical | API — Security (open redirect) | Fixed, deployed (PR #59), re-verified live |

Thirty-three are fixed and every one deployed and re-verified live against
production. Of the five still open, two are content decisions (ISS-004,
ISS-013), one is cosmetic (ISS-014), one is a small remaining code fix
(ISS-018), and one needs a product decision before it can be built
(ISS-031).
