# Approved UI reference inventory

This inventory covers every approved public HTML reference uploaded across the
UI parity phase. Canonical copies are byte-identical files under
`design/reference/`; they are design inputs only and are never loaded or
executed by production code.

## Reference register

| Original filename | Canonical filename | Intended route | Dynamic parameters | Page type | Title | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `Final countries List.html` | `final-countries-list.html` | `/countries` | Query: `q`, `region`, `page` | Country listing/search | `Study Abroad Destinations — Universta` | Production route under parity review |
| `universta-country.html` | `final-country-detail.html` | `/countries/[slug]` | `slug` | Country detail/editorial | `Study in Canada in 2026 — Universities, Costs, Visa & Scholarships \| Universta` | Production route under parity review |
| `subjects Listing.html` | `subjects-listing.html` | `/subjects` | Query: `q`, `page`, and discovery filters | Subject listing/directory | `Explore Subjects — Fields of Study, Careers & Programs Worldwide \| Universta` | Production route under parity review |
| `subject-details.html` | `subject-detail.html` | `/subjects/[slug]` | `slug` | Subject detail/pathway | `Computer Science — Courses, Universities, Careers & Scholarships \| Universta` | Production route under parity review |
| `Subjects Sub Categories.html` | `subject-specializations.html` | `/subjects/[slug]/specializations` | `slug` | Sub-category listing | `Computer Science Specializations — AI, ML, Data Science & More \| Universta` | Production route under parity review |
| `courses .html` | `courses-listing.html` | `/courses` | Query: search, filters, sort, page | Course listing/discovery | `Study Abroad Courses — Compare Programs Worldwide \| Universta` | Production route under parity review |

No homepage or course-detail reference has been uploaded. `/` and
`/courses/[slug]` remain mapped production routes, but have no approved HTML
baseline in this inventory and are not represented as pixel-parity passes.

## Shared visual system

- Fonts: `Inter` for body/UI and `Plus Jakarta Sans` for headings, display
  text, logo, metrics, and card titles. Production must use the existing local
  font setup or a deterministic equivalent; no runtime Google Fonts dependency
  is introduced for visual tests.
- Shared course/subject palette: blue `#2563EB`, blue-700 `#1D4ED8`,
  blue-800 `#1E40AF`, pale blue `#EEF3FF`/`#DEE8FF`, ink `#0B1220`, slate
  `#334155`, muted `#64748B`, faint `#94A3B8`, canvas `#F7F9FC`, surface
  `#FFFFFF`, line `#E7ECF3`/`#EEF2F8`, amber `#F59E0B`, green `#059669`.
- Course/subject spacing: 8px base rhythm, 12/16/20/24px radii, 1200px
  content width, 64px desktop section padding, 44px mobile section padding,
  16px mobile shell padding, and soft shadows from the approved CSS tokens.
- Country palette: brand `#1657CF`, dark brand `#0F3FA0`, canvas `#FAFBFD`,
  surface `#FFFFFF`, soft `#F1F4F9`, line `#E5EAF2`, warm accent `#D9622B`.
- Breakpoints: course/subject references use `1080px`, `900px`, `560px`, and
  reduced-motion handling; country listing uses `1024px`, `640px`, and reduced
  motion. Desktop/tablet/mobile section order is unchanged unless listed in a
  route entry; responsive rules change columns, padding, stacking, drawers, or
  horizontal sticky navigation.
- Header: sticky translucent backdrop with 72px desktop height, logo,
  primary navigation, sign-in, counselling CTA, and mobile menu toggle.
- Footer: multi-column link grid, brand description, legal/disclaimer bottom
  row, and one-column/two-column mobile stacking according to the reference.

## `Final countries List.html` → `/countries`

Reference composition and section order, unchanged across desktop/tablet/mobile:

1. Sticky header and navigation
2. Destination hero, badge, comparison chips, search, suggestions, quick filters
3. Platform metrics
4. Region heading and region tabs
5. Country result cards and empty/error result states
6. Consultation CTA band
7. A–Z directory navigation and grouped country tiles
8. Secondary counselling CTA
9. Consultant cards
10. Final counselling CTA, trust row, and footer

Component inventory: country card, flag/placeholder, region tab, search
combobox, suggestion panel, filter chip, metrics tile, A–Z group, consultant
card, CTA band, trust/footer blocks. Interactions: URL-backed search and
region state, keyboard suggestions, A–Z anchors, responsive controls, and safe
counselling links. Breakpoints are `1024px` and `640px`.

Reference actions such as comparison, sign-in, and unsupported consultant
platform features are either mapped to existing safe routes or omitted. Sample
country facts, rankings, counts, testimonials, and consultant claims require
published API/profile data; otherwise the approved empty state is used.

Section disposition: listing/search/filter/directory layout is
`MATCHED WITH DYNAMIC DATA`; unsupported factual blocks are `OMITTED BECAUSE
FACTUAL CLAIM IS UNVERIFIED`; no sample values are production fixtures.

## `universta-country.html` → `/countries/[slug]`

Reference composition and section order:

1. Sticky header and breadcrumb
2. Country hero and quick facts
3. Sticky jump navigation
4. Why study here, universities, subjects, intakes, documents, cost,
   scholarships, visa, events, cities, living, careers, FAQs, how-to, blogs
5. Consultation and consultant bands
6. Footer/trust row

Component inventory: breadcrumb, hero, fact cards, sticky section navigation,
alternating editorial blocks, checklist/timeline/table variants, FAQs,
consultant cards, CTA bands, and footer. Tablet/mobile use a stacked hero,
horizontal sticky navigation, one-column content, and full-width CTAs.

Production source is the published country profile, structured profile fields,
editorial sections, FAQs, consultants, `sourceReference`, and `verifiedAt`.
Visa guarantees, rankings, salary claims, scholarship amounts, events,
testimonials, and other unverified reference facts are
`OMITTED BECAUSE FACTUAL CLAIM IS UNVERIFIED`.

## `subjects Listing.html` → `/subjects`

Reference composition and section order:

1. Sticky header/breadcrumb and centred subject hero
2. Popular subjects
3. Subject categories
4. A–Z subject directory
5. Degree levels
6. Careers
7. Featured subjects
8. Study destinations by subject
9. Top universities by subject
10. Popular courses
11. Scholarships by subject
12. Career outcomes and employers
13. Why study this subject
14. Resources, stories, FAQs, and explore links
15. Final eligibility/counselling CTA and footer

Component inventory: hero pill, search combobox/suggestions, CTA buttons,
four-stat row, subject cards, category cards, A–Z groups, degree/career cards,
featured cards, destination/university/course/scholarship cards, employer and
why cards, resource/story cards, FAQ disclosure, sidebar, CTA, footer.

Search, A–Z anchors, cards, FAQs, and counselling links are interactive. The
production source is published subject/course/sub-subject data and verified
catalog metadata. Categories, career outcomes, rankings, scholarships,
employer claims, stories, and FAQs without a safe Phase 1 model are
`OMITTED BECAUSE NO SAFE DATA MODEL` or
`OMITTED BECAUSE FACTUAL CLAIM IS UNVERIFIED`; the layout remains polished and
does not expose engineering omission notices.

## `subject-details.html` → `/subjects/[slug]`

Reference composition and section order:

1. Breadcrumb and dark-gradient subject hero
2. Parent pill, metrics, hero CTAs
3. Sticky table of contents
4. At-a-glance, about, why, skills, curriculum, specializations, careers,
   industries, countries, universities, courses, scholarships, admissions,
   cost, dashboard, future scope, stories, matching, related subjects,
   resources, consultants, FAQs, and explore
5. Final subject CTA, mobile action treatment, and footer

Component inventory: hero metrics, CTA buttons, sticky TOC, prose/summary
blocks, KPI grid, icon cards, skill chips, curriculum cards, specialization
cards, career/industry cards, country/university/course cards, admission
grids, cost cards, dashboard, match panel, related/resources/consultant cards,
FAQs, and footer.

Dynamic production content comes from a published subject, sub-subjects,
course levels, featured courses, SEO metadata, and safe links. Save, compare,
matching, salary, ranking, scholarship, testimonial, and dashboard claims are
`OMITTED BECAUSE FACTUAL CLAIM IS UNVERIFIED` or rendered as an approved safe
disabled/counselling action where the composition requires one.

## `Subjects Sub Categories.html` → `/subjects/[slug]/specializations`

Reference composition and section order:

1. Breadcrumb, hero, parent pill, search, stats, and CTAs
2. Popular specializations
3. Categories
4. All specializations
5. Careers, universities, courses, scholarships, best countries
6. Skills, industry trends, stories, resources, FAQs, and explore links
7. Final matching/counselling CTA, comparison tray/modal composition, footer

Component inventory: specialization cards/bands, category blocks/tags,
career/university/course/scholarship/country cards, skills/trends/story cards,
FAQ, sidebar, CTA/footer, and comparison tray/modal. Published Sub-Subjects
and course links are dynamic. Comparison remains a safe disabled or omitted
control because comparison is outside the approved Phase 1 scope. Demand,
salary, growth, university, scholarship, and testimonial values are
`OMITTED BECAUSE FACTUAL CLAIM IS UNVERIFIED`.

## `courses .html` → `/courses`

Reference title and metadata describe a course discovery marketplace. Desktop,
tablet, and mobile section order is:

1. Sticky header, breadcrumb, centred hero, stats badge, search suggestions,
   quick-filter chips, and three CTAs
2. Six-metric stats row
3. SEO introduction and key-takeaways panel
4. Popular subject course cards
5. Featured course discovery with sticky filter sidebar, results bar, sort,
   course cards, compare controls, and mobile filter drawer
6. Degree-level cards
7. Destination cards
8. Career cards
9. Subject-category cards
10. Duration and tuition two-column cards
11. Scholarship and career-outcome two-column cards
12. Why Universta benefits
13. Study-abroad tools
14. Events
15. Resources
16. Expandable course-selection SEO content
17. FAQ accordion
18. University/destination/consultant link columns
19. Final gradient CTA
20. Multi-column footer, compare tray, scrim, and toast

Component inventory: hero pill, search combobox, suggestions, chips, stat
tiles, subject/course/destination/degree/career/category/tuition/tool/event/
resource cards, sticky filter groups, range filter, sort select, result cards,
compare checkbox/tray, FAQ accordion, mobile drawer, CTA, footer, and toast.

The reference uses `1080px`, `900px`, `560px`, and reduced-motion breakpoints.
Search supports focus, filtering, suggestions, empty state, click selection,
and safe error handling. Filters support grouped checkboxes/radio/range inputs,
clear-all, sort, mobile drawer, keyboard access, URL-backed state, pagination,
and compare tray states. Save, compare, scholarship, salary, ranking, PR,
employability, and event claims are only rendered from published, verified API
records. Unsupported controls must be safe disabled/counselling actions and
must not be dead links.

## Dynamic fixture and implementation policy

- Canada, Computer Science, reference sample subjects/sub-subjects/courses, and
  sample counts are visual fixtures only. Production routes must render any
  published entity and must not leak first-record data into a second entity.
- Visual fixtures use an explicit `VISUAL_FIXTURE_MODE=true` guard in an
  isolated local/E2E environment. Production mode rejects or ignores the flag;
  no schema, migration, real credential, or production sample-data change is
  permitted.
- Every reference section is tracked as `MATCHED`, `MATCHED WITH DYNAMIC DATA`,
  `MATCHED WITH SAFE DISABLED ACTION`, or one of the documented `OMITTED`
  reasons. Generic developer-facing omission notices are not valid public UI.
- Reference HTML is never imported, iframe-loaded, `dangerouslySetHTML`'d, or
  executed by production code.
