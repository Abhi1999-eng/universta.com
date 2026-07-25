# UI parity report

## Scope

The approved references are preserved in `design/reference/`. This phase
adapts the visual hierarchy, section rhythm, navigation, cards, responsive
layout, and safe interactions to production React components. The HTML and its
sample JavaScript are not loaded at runtime.

## Route status

| Route | Reference | Status | Notes |
| --- | --- | --- | --- |
| `/` | No uploaded homepage reference | Existing route retained | Not evaluated against an uploaded reference |
| `/countries` | `final-countries-list.html` | Adapted | Search, URL filters, region controls, directory, empty/error states, and safe CTA are data-backed |
| `/countries/[slug]` | `final-country-detail.html` | Adapted | Sticky navigation, structured profiles, editorial sections, FAQs, consultants, and source-aware CTA are data-backed |
| `/subjects` | `subjects-listing.html` | Adapted | Search, published cards, featured state, published A–Z directory, pagination, and safe omissions |
| `/subjects/[slug]` | `subject-detail.html` | Adapted | Hero, sticky section navigation, published snapshot, specialisations, levels, courses, and safe omissions |
| `/subjects/[slug]/specializations` | `subject-specializations.html` | Implemented/adapted | Published Sub-Subjects only; comparison is intentionally deferred |
| `/courses` | No uploaded course-list reference | Existing route retained | Not evaluated against an uploaded reference |
| `/courses/[slug]` | No uploaded course-detail reference | Existing route retained | Not evaluated against an uploaded reference |

## Shared production components and patterns

The parity implementation reuses the existing `SiteHeader`, `SiteFooter`,
country search/filter controls, sticky detail navigation, catalog cards,
section headings, facts panels, CTA bands, empty states, error states, source
notes, and responsive CSS tokens. Subject cards, subject directories,
specialisation cards, and subject detail snapshots are API-driven additions.

## Interaction and responsive review

- Search and pagination remain URL-backed and preserve allowed query state.
- Country filters preserve browser navigation and reset pagination on change.
- Subject detail and specialisation links are generated from real slugs.
- Subject comparison, save, matching, scholarships, calculators, and other
  unsupported reference actions are not dead interactive controls.
- Layouts use the existing 1440/768/390 responsive breakpoints; mobile grids
  collapse, navigation wraps or scrolls, and no intentional horizontal canvas
  overflow is introduced.
- Semantic headings, labelled search fields, landmarks, visible focus, safe
  links, status text, and reduced-motion CSS are preserved.

## Data safety

The references contain illustrative values such as counts, salary, ranking,
scholarship, and testimonial claims. Those values are not copied into runtime
components. Only published API data, verified country profiles, and safe copy
are rendered. Unsupported sections are omitted and documented in
`UI_REFERENCE_INVENTORY.md`.

## Validation status

Validation completed on the local native-MySQL setup:

- `npm install` completed; the existing audit reported 36 dependency findings
  (1 moderate and 35 high), with no dependency changes made by this phase.
- Prisma format, validate, generate, and migration status passed. The database
  reported one existing migration and an up-to-date schema.
- Unit tests passed: Admin 46, API 28, Web 2.
- Lint passed with existing warning-only findings: API 52, Web 4; no errors.
- Production builds passed for Web, Admin, and API.
- Playwright passed all 28 browser tests, including the new subject parity
  checks, country listing/detail checks, admin auth, catalog workflows, and
  mobile overflow checks.
- `git diff --check` passed.

The in-app browser could not connect to the local development server for an
additional live screenshot review; Playwright provided the rendered route and
responsive validation instead. The approved reference HTML was inspected as
the visual source and remains byte-identical in the repository.

Schema and migration files are unchanged in this phase.
