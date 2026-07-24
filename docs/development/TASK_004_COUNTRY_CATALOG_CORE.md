# TASK_004 — Continents and Countries Catalog Core

## Scope

TASK_004 adds the catalog core inside the existing NestJS modular monolith:
public continent/country read APIs, protected Super Admin CRUD for continents
and core country records, publish/unpublish workflow, soft deletion, audit
events, same-origin Admin BFF routes, and protected Admin management screens.

The implementation uses the existing Prisma models without changing the schema
or adding a migration. Core country fields are limited to the fields already
owned by `Country`: continent, name, slug, ISO codes, page heading, short
description, featured flag, display order, status, published time, media
reference, timestamps, actor fields, and soft-delete state.

## Explicitly deferred country subdomains

The following remain outside TASK_004 and have no CRUD endpoints or form
controls: costs, work rights, language requirements, intakes, statistics,
FAQs, content sections, aliases UI, tags UI, course mappings, consultant cards,
media uploads, SEO, Courses, Leads, CMS, student features, the public Countries
Listing UI, and the Single Country frontend.

No sample HTML data is copied into the application, and the approved
`design/reference/final-countries-list.html` remains a visual reference only.

## Model ownership

- `Continent` owns region identity, ordering, status, optional descriptions and
  soft deletion; `Country` references it through the existing `continentId` FK.
- `Country` owns the core country listing record and its existing publish and
  soft-delete fields.
- `AuditLog` stores append-only mutation history with actor, request, module,
  entity, safe changed-field values, and request metadata.
- Existing `MediaAsset` relations are read-only references in DTOs; uploads are
  deferred.

## API contract

Public endpoints:

- `GET /api/v1/continents`
- `GET /api/v1/countries`
- `GET /api/v1/countries/suggestions`
- `GET /api/v1/countries/directory`
- `GET /api/v1/countries/:slug`

Public results include only published/active, non-deleted records and return
safe structured DTOs in the standard response envelope. Public list and
directory pagination is bounded and deterministically ordered. Unsupported
profile filters are not implemented.

Admin endpoints:

- `GET|POST /api/v1/admin/continents`
- `GET|PATCH|DELETE /api/v1/admin/continents/:id`
- `GET|POST /api/v1/admin/countries`
- `GET|PATCH|DELETE /api/v1/admin/countries/:id`
- `POST /api/v1/admin/countries/:id/publish`
- `POST /api/v1/admin/countries/:id/unpublish`

Every admin endpoint uses `AccessTokenGuard`, `RolesGuard`, and the
`SUPER_ADMIN` role. DTOs never accept actor, deletion, publication, audit, or
nested profile fields from the client.

## Validation and query policy

Text is trimmed at safe outer boundaries, slugs are lowercase hyphenated
values, ISO codes are normalized uppercase, booleans and display order are
typed, and status values are controlled application values. Omitted continent
slugs are generated from the name on create only; an existing slug changes
only when explicitly supplied. Schema uniqueness conflicts become stable 409
codes instead of raw Prisma errors.

Search, status, featured, continent, page, and limit are validated with
bounded pagination. Sort values are allowlisted and mapped to fixed Prisma
order objects; raw client sort strings never reach Prisma.

## Status, publishing, and soft deletion

New countries are drafts. Publishing requires a non-deleted country, a
non-deleted continent, valid unique slug, name, required available ISO fields,
page heading, and short description. Readiness failures return 422 with safe
field-level details. Publish sets `PUBLISHED` and `publishedAt`; unpublish
returns the record to `DRAFT` and removes it from public reads immediately.

Deletes are soft deletes using the existing `deletedAt` and status fields.
Deleted records are excluded from normal admin and all public queries. A
continent with any non-deleted country returns `CONTINENT_IN_USE` and is not
deleted. No business record is hard-deleted or cascaded by this task.

## Concurrency and audit

Country updates accept the editor's displayed `updatedAt` as
`expectedUpdatedAt`. The service compares it before mutation and returns 409
`COUNTRY_STALE_VERSION` when another change won the race. The response returns
the refreshed record after success. Continent updates use the same timestamp
guard when supplied.

Mutations write `CONTINENT_CREATED`, `CONTINENT_UPDATED`,
`CONTINENT_DELETED`, `COUNTRY_CREATED`, `COUNTRY_UPDATED`, `COUNTRY_PUBLISHED`,
`COUNTRY_UNPUBLISHED`, and `COUNTRY_DELETED` audit actions. Audit values are
limited to safe changed fields; tokens, cookies, authorization headers,
passwords, and complete sensitive bodies are never stored.

## Admin BFF architecture

The browser calls only same-origin Next.js Route Handlers. The server-only BFF
has exact catalog path/method allowlists, forwards only bearer authorization,
request ID, safe query parameters, and JSON bodies, and uses `no-store`, a
five-second timeout, safe 502 errors, and response request-ID propagation. It
does not become a generic reverse proxy and does not forward arbitrary cookies,
host/connection headers, actor IDs, or secret values.

## Admin routes and UX

Protected routes are `/continents`, `/countries`, `/countries/new`, and
`/countries/[id]`. Countries becomes a real navigation link; unimplemented
modules remain disabled buttons. Continents and Countries screens include
accessible headings, search/filter/pagination, loading/empty/error/retry
states, safe core fields, and deliberate confirmation dialogs. Country forms
support validation, slug suggestion/manual override, unsaved-change warnings,
stale-version conflicts, publish readiness errors, publish/unpublish, and
soft-delete flows without browser alerts or invented metrics.

## Testing strategy

API unit tests cover DTO/query normalization, service policy, allowlisted
sorting, readiness, conflict handling, soft deletion, audit payloads, and safe
error envelopes. API E2E tests cover public filtering/detail visibility,
Super Admin authorization, CRUD, publish lifecycle, stale writes, in-use
continent deletion, audit rows, request IDs, and raw-error redaction.

Admin unit tests cover BFF allowlists and safe failures, typed client data
loading, list states, forms, validation, dialogs, navigation, and responsive
actions. Real Chromium Playwright tests use unique local records and seeded
Super Admin environment variables without logging credentials; they exercise
create/edit/publish/unpublish/delete, public visibility, reload, and mobile
actions, then soft-delete their records.

## Acceptance criteria

- Existing schema and migrations are unchanged; no Docker or version changes.
- Public APIs expose only safe published/non-deleted catalog data.
- Admin mutations require an active Super Admin and write audit rows.
- Publish/unpublish, soft deletion, conflict codes, request IDs, and envelopes
  behave consistently.
- Admin BFF routes remain exact and same-origin.
- Admin screens are accessible, responsive, truthful, and contain no deferred
  profile controls or fake metrics.
- Unit, API E2E, Admin unit, and browser E2E tests, lint, builds, runtime
  checks, audit, and scope checks pass.
- One commit is pushed and a non-merged PR targeting `main` is opened.

## Prohibited scope

Do not modify the approved HTML, public Countries Listing frontend, Single
Country frontend, Prisma schema, migrations, or database blueprint. Do not add
Courses, Leads, CMS, media uploads, SEO, student features, Docker,
microservices, a generic proxy, convenience columns, fixed sample records,
hard-delete behavior, `prisma db push`, migration resets, forced audit fixes,
or TASK_005.
