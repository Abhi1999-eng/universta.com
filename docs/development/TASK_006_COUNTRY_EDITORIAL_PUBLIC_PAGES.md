# TASK_006 — Country Editorial Content and Public Country Experience

## Scope and baseline

TASK_006 uses the Phase 1 schema already present on `main`. It adds editorial
management and the public Countries listing and country-detail experiences
without changing Prisma models or adding a migration. The supplied country
detail references were compared before implementation:

- `universta-country-canada.html` SHA-256:
  `5074ab7d8556bd042081185993bdd754400015b27ad06f08fe18760e81b5aab2`
- `universta-country-canada (1).html` SHA-256:
  `5074ab7d8556bd042081185993bdd754400015b27ad06f08fe18760e81b5aab2`
- Result: byte-for-byte identical.
- Canonical preserved copy: `design/reference/final-country-detail.html`.
- Approved listing reference remains `design/reference/final-countries-list.html`
  and is not modified.

`docs/design/COUNTRIES_COMPONENT_MATRIX.md` was requested by the task but is
not present in the repository. Component ownership is therefore derived from
the two approved HTML references, the existing listing analysis/mapping docs,
and the current app conventions. This omission is recorded as a documentation
gap, not treated as a schema or implementation blocker.

## Included

- Super Admin CRUD for country content sections, FAQs, country SEO metadata,
  existing-media selection, and country-linked consultant landing cards.
- Explicit DTO validation, bounded text/JSON fields, optimistic timestamps,
  soft deletion, and audit events for editorial mutations.
- Public API aggregation for published country pages with safe media and
  verification-aware profile data.
- Next.js `/countries` and `/countries/[slug]` pages using API data, server
  metadata, canonical URLs, JSON-LD, accessible filtering/search, and
  responsive composition based on the approved references.
- Unit, API, admin, browser, build, lint, security, and visual-smoke checks.

## Excluded

Media upload/storage, Subjects/Courses CRUD, universities, Leads/CRM, student
accounts, saved/compare/application tracking, consultant accounts or booking
automation, generic CMS/page builders, Docker, microservices, schema changes,
migrations, `prisma db push`, and TASK_007 work.

## Model ownership and publication rules

| Concern | Existing model | Owner/API boundary |
| --- | --- | --- |
| Section content | `CountryContentSection` | Admin editorial endpoints; public only when parent country is published and section is active |
| FAQs | `CountryFaq` | Admin FAQ endpoints; public only when active and not deleted |
| SEO | `SeoMetadata` with `ownerType=COUNTRY` | Admin country SEO endpoint; public metadata is selected by country id |
| Existing media | `MediaAsset` | Selection-only; active, non-deleted image assets are exposed as safe summaries |
| Consultant landing cards | `ConsultantLandingCard` | Admin country-linked card endpoints; public only when published and not deleted |

Country publication remains controlled by the existing country publish action.
Editorial records never make a draft/deleted country public. Public responses
exclude storage keys, bucket names, checksums, upload metadata, audit data,
unverified profile facts, raw SEO management fields, and arbitrary HTML.

## Section contract

The editor supports the approved country-detail section keys:

`hero`, `why-study`, `cost-of-study`, `work-opportunities`,
`language-requirements`, `intakes`, `life-and-culture`, `application-steps`,
`faqs`, `consultant-cta`, and `trust-disclaimer`.

The section type is allowlisted as `RICH_TEXT`, `FACT_GRID`, `CARD_GRID`,
`STEPS`, `CTA`, or `MEDIA`. `bodyJson` is a typed object, not an HTML blob:

- `RICH_TEXT`: `{ paragraphs: string[] }`, maximum 12 paragraphs and 2,000
  characters per paragraph.
- `FACT_GRID`: `{ items: [{ label: string, value: string }] }`, maximum 12
  items, each label/value bounded to 255 characters.
- `CARD_GRID`: `{ items: [{ title: string, description: string, mediaId?: string }] }`,
  maximum 12 cards.
- `STEPS`: `{ items: [{ title: string, description: string }] }`, maximum 10
  steps.
- `CTA`: `{ supportingText?: string }`, bounded to 1,000 characters.
- `MEDIA`: `{ caption?: string }`, bounded to 500 characters.

Unknown top-level keys, invalid item shapes, excessive array lengths, and
unbounded text are rejected. Media ids in section bodies are validated against
the existing-media policy before persistence.

## API contracts

Admin endpoints are protected by `AccessTokenGuard` and `SUPER_ADMIN`:

- `GET /api/v1/admin/countries/:countryId/editorial`
- `GET|POST /api/v1/admin/countries/:countryId/content-sections`
- `PATCH|DELETE /api/v1/admin/countries/:countryId/content-sections/:id`
- `GET|POST /api/v1/admin/countries/:countryId/faqs`
- `PATCH|DELETE /api/v1/admin/countries/:countryId/faqs/:id`
- `GET|PUT|DELETE /api/v1/admin/countries/:countryId/seo`
- `GET|POST /api/v1/admin/countries/:countryId/consultant-cards`
- `PATCH|DELETE /api/v1/admin/countries/:countryId/consultant-cards/:id`
- `GET /api/v1/admin/media-options`

The public aggregate is `GET /api/v1/countries/:slug/page`. It returns the
published country summary, safe verified profile detail, active public
sections, FAQs, SEO presentation fields, safe media, consultant cards, and
null/empty values when optional editorial data is absent. All responses use
the existing standard envelope.

## Mutation safety

All create/update/delete mutations take `expectedUpdatedAt` where a record
already exists. A mismatched timestamp returns a conflict and never overwrites
the newer record. Country ids, ownership fields, status transitions, actor
ids, and audit fields are server-controlled. Text and URLs are trimmed and
bounded; URLs accept only HTTP(S) where a URL is permitted. Audit values are
scalar allowlisted summaries only.

## Media and consultant policy

TASK_006 does not upload or delete media. A selected media id must reference an
active, non-deleted `IMAGE` in `MediaAsset`; public output contains only id,
public URL, title, alt text, dimensions, and caption. Consultant cards are
landing-card content only. They do not create consultant users, accounts,
matching, booking, or CRM behavior. Public card CTAs must be configured
routes/URLs and never a dead `#` placeholder.

## Public page mapping and missing data

The listing uses the existing country list, suggestion, directory, continent,
profile-summary, verification, and feature-flag APIs. Country names, flags,
metrics, consultant cards, counts, costs, intakes, and claims are never copied
from the reference HTML. The detail page renders the country heading, overview,
verified profile facts, editorial sections, FAQs, consultant cards, and trust/
source notes from API data. Missing optional data produces an intentional
empty state or hides the section; it never invents a fallback claim.

The enabled counselling CTA routes to the approved counselling destination or
the page's consultation anchor. Deferred account, save, compare, tracking,
and matching actions remain hidden or are replaced by counselling links.

## Accessibility and verification plan

Pages use semantic headings, labelled controls, keyboard-operable search
suggestions, listbox/option semantics, Escape dismissal, visible focus,
announced result counts, meaningful image alt text, reduced-motion support,
responsive breakpoints from the approved listing analysis, and no clickable
non-interactive elements. Verification covers API contracts and policies,
admin editor/BFF behavior, public browser flows at desktop/tablet/mobile
viewports, no-token browser storage, lint, unit tests, builds, and clean-tree
security/scope gates.

## Acceptance and prohibited scope

Acceptance requires the approved page compositions to remain recognizable while
all runtime data is API-backed, public claims are verification-aware, CTAs are
real actions, and the repository contains no schema/migration/Docker/TASK_007
changes. This task must stop after its feature branch is pushed, CI is green,
and a PR targeting `main` is opened; the PR must not be merged here.
