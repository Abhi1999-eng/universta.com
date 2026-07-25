# TASK_005 — Structured Country Profile Data

## Scope

TASK_005 adds the structured country-profile data foundation for the existing
catalog core. It covers country cost, work and visa, language requirements,
intakes, and statistics; public API summaries and filters; protected Super
Admin editing; same-origin Admin BFF forwarding; audit events; validation and
automated test coverage.

This task does not build the public Countries Listing or Single Country UI and
does not implement content sections, FAQs, SEO editors, media uploads or
library, aliases/tags UI, Courses, Leads, consultant cards, or student
functionality. Those content and presentation concerns remain deferred to
TASK_006 or later planned work. No Docker, microservices, second application
database, or schema push is introduced.

## Authoritative sources

- `docs/development/TASK_004_COUNTRY_CATALOG_CORE.md`
- `docs/development/TASK_004_IMPLEMENTATION_REPORT.md`
- `docs/development/API_CONTRACTS.md`
- `docs/development/BACKEND_MODULES.md`
- `docs/design/COUNTRIES_LISTING_ANALYSIS.md`
- `docs/design/COUNTRIES_DATA_MAPPING.md`
- `docs/design/COUNTRIES_LISTING_ACCEPTANCE.md`
- `docs/DATABASE.md`
- `apps/api/prisma/schema.prisma`

The existing Phase 1 Prisma schema already contains the one-to-one country
profile relations, country intake rows, and intake master table required by
this task. The schema and migration history are not changed by TASK_005.

## Controlled values

The API owns one shared set of constants for these values:

- Cost periods: `PER_YEAR`, `PER_MONTH`, `PER_TERM`, `ONE_TIME`.
- Budget bands: `BUDGET_FRIENDLY`, `MID_RANGE`, `PREMIUM`.
- Immigration pathway strength: `NOT_PUBLISHED`, `LIMITED`, `MODERATE`,
  `STRONG`.
- Visa success bands: `NOT_PUBLISHED`, `LOW`, `MEDIUM`, `HIGH`.
- Language requirement state: `REQUIRED`, `OPTIONAL`, `NOT_REQUIRED`, `VARIES`.
- Intake availability: `AVAILABLE`, `LIMITED`, `NOT_AVAILABLE`,
  `NOT_PUBLISHED`.
- Statistics source mode: `MANUAL`, `OFFICIAL`, `IMPORTED`.

Public filters use exact controlled values. `intake` matches an active intake
whose country availability is `AVAILABLE` or `LIMITED`; unpublished and
unavailable rows do not match. `ieltsOptional=true` matches only an existing,
verified language profile with an explicit `OPTIONAL` or `NOT_REQUIRED` IELTS
state, or a verified language waiver. A missing profile, missing source,
missing verification timestamp, or null score does not make a country match.

## Validation and public-safety rules

All profile writes are Super Admin-only and use DTO whitelist validation. Decimal
inputs are strings, reject exponent notation and non-finite values, and are
validated against the precision of the existing Prisma schema before being
converted to Prisma Decimal values. Monetary values are non-negative and use
two decimal places; hours, percentages, months, language scores, and counts
use the limits and precision represented by their schema columns. Related
minimum/maximum values must be ordered.

Source references accept only HTTP or HTTPS URLs. A `verifiedAt` value cannot
be in the future. Optional visa percentages and non-default visa/pathway
claims require both a source reference and verification timestamp. Scores are
only accepted for applicable language requirement states. Intake replacement
payloads reject duplicate intake IDs, require active intake masters, and use
optimistic concurrency against the latest country-intake `updatedAt`.

Public responses expose only published, non-deleted countries. Optional facts
are omitted or returned as `null` unless their source-backed verification rules
are satisfied. Explicit verified zero statistics remain zero; a missing or
unverified statistics row remains `null`. Top-ranked filters distinguish a
verified zero from a missing profile.

## API and BFF surface

The API preserves the TASK_004 catalog endpoints and adds profile summaries to
public list, suggestions, directory, and detail responses. Public list-style
queries add `budgetBand`, `ieltsOptional`, `intake`, `visaSuccessBand`,
`pathwayStrength`, and `hasTopRankedUniversities`, combined with the existing
filters using AND semantics.

Protected profile operations are exposed under the exact country-scoped paths:

- `GET /api/v1/admin/countries/:countryId/profiles`
- `GET|PUT|DELETE /api/v1/admin/countries/:countryId/profiles/cost`
- `GET|PUT|DELETE /api/v1/admin/countries/:countryId/profiles/work`
- `GET|PUT|DELETE /api/v1/admin/countries/:countryId/profiles/language`
- `GET|PUT /api/v1/admin/countries/:countryId/profiles/intakes`
- `GET|PUT|DELETE /api/v1/admin/countries/:countryId/profiles/statistics`
- `GET /api/v1/admin/intakes`

Mutation routes require an access token and the `SUPER_ADMIN` role. Updates
use `expectedUpdatedAt` when an existing record is being changed or deleted;
stale writes return a conflict without partially applying changes. Every
successful mutation writes a safe audit event and excludes raw long text,
tokens, secrets, and credentials from audit values.

The Admin app calls these API operations only through explicit same-origin BFF
route handlers. The BFF forwards the browser request ID, bearer access token,
validated query/body data, and safe error responses without exposing the API
base URL or refresh cookie to browser code.

## Admin scope

The protected country editor gains focused sections for cost, work/visa,
language, intakes, and statistics. It loads available intake masters and the
combined profile payload, validates user input before submission, surfaces
conflicts and API errors, and does not add content, FAQ, SEO, media, Courses,
Leads, consultant, or public-catalog screens.

## Testing and acceptance

Coverage includes unit tests for validation, public redaction/filter semantics,
optimistic concurrency, and audit event safety; API tests for authorization,
CRUD/upsert/delete behavior, missing-country handling, and intake replacement;
Admin BFF tests for route allowlisting and forwarding; and browser coverage for
the protected profile editor. CI must pass lint, typecheck, unit tests, API
E2E tests where the local database is available, Admin tests, and production
build validation.

Acceptance requires the existing Prisma schema and migrations to remain
unchanged, no real `.env` or credential files to be tracked, no Docker files,
no TASK_006 code, and a clean working tree after verification. The approved
Countries HTML and assets remain untouched.

## Deferred work

TASK_006 may build content sections, FAQs, SEO editing, media workflows, and
the public country listing/profile presentation after this structured data
foundation is reviewed. TASK_005 does not begin that work.
