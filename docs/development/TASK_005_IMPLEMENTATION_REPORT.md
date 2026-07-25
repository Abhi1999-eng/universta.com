# TASK_005 — Structured Country Profile Data Implementation Report

## Delivered

Implemented structured country profile data inside the existing NestJS modular
monolith and protected Next.js Admin app. The implementation covers:

- Cost profiles with currency, tuition/living-cost bands, periods, source and
  verification metadata.
- Work and visa profiles with part-time work, post-study work, pathway strength,
  visa bands, processing and proof-of-funds fields.
- Language requirements for IELTS, PTE, TOEFL and Duolingo, including waiver
  handling and source-backed public disclosure.
- Country intake replacement against the existing active intake master table,
  with duplicate rejection and optimistic concurrency.
- Country statistics with explicit zero preservation, source mode and verified
  public summaries.
- Public list, suggestions, directory and detail profile summaries, filters and
  source-backed redaction.
- Super Admin-only profile APIs, same-origin Admin BFF allowlists, structured
  country editor sections, safe audit events and test coverage.

## API surface

Protected routes are:

```text
GET                 /api/v1/admin/countries/:countryId/profiles
GET|PUT|DELETE      /api/v1/admin/countries/:countryId/profiles/cost
GET|PUT|DELETE      /api/v1/admin/countries/:countryId/profiles/work
GET|PUT|DELETE      /api/v1/admin/countries/:countryId/profiles/language
GET|PUT             /api/v1/admin/countries/:countryId/profiles/intakes
GET|PUT|DELETE      /api/v1/admin/countries/:countryId/profiles/statistics
GET                 /api/v1/admin/intakes
```

Public filters use exact controlled values and combine with existing filters
using AND semantics: `budgetBand`, `ieltsOptional`, `intake`,
`visaSuccessBand`, `pathwayStrength`, and `hasTopRankedUniversities`.

## Safety and data policy

Decimal inputs are strings, exponent notation and invalid precision are
rejected, source references require HTTP/HTTPS, and verification timestamps
cannot be future-dated. Existing rows require `expectedUpdatedAt` for updates
and deletes. Profile audit events record only safe scalar metadata and do not
include tokens, credentials or long raw content.

Public optional claims require both `sourceReference` and `verifiedAt`. Missing
or unverified profile rows are null/omitted, while verified zero statistics are
preserved. The seed adds fictional local Canada data with an example source URL
for development and test behavior only.

## Validation completed

- Prisma format check: passed.
- Prisma schema validation: passed.
- Prisma client generation: passed; no generated diff.
- API unit tests: 21 passed.
- Admin unit tests: 44 passed.
- API E2E tests: 29 passed against native MySQL.
- Admin Chromium browser tests: 6 passed, including cost profile save.
- Web, Admin and API production builds: passed.
- API and Admin lint: passed.
- Seed execution: passed.

## Scope confirmation

`apps/api/prisma/schema.prisma` and migration files are unchanged. No `prisma
db push`, `prisma migrate dev`, reset, Docker file, microservice, real `.env`,
credential, token, public Countries UI, Single Country UI, content/FAQ/SEO/media
workflow, aliases/tags UI, Courses, Leads, consultant card, student feature, or
TASK_006 code was added. Approved Countries HTML/assets remain unchanged.
