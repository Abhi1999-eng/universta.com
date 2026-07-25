# TASK_004 — Continents and Countries Catalog Core Implementation Report

## Scope completed

Implemented the catalog core inside the existing NestJS modular monolith:
public continent and country read APIs, protected Super Admin CRUD for
continents and core country records, publish/unpublish workflow, soft deletion,
optimistic concurrency checks, safe audit events, same-origin Admin BFF routes,
protected Admin catalog screens, unit tests, API E2E tests, and Chromium browser
E2E coverage.

Detailed country profile subdomains remain deferred. This task does not add
costs, work rights, language requirements, intakes, statistics, FAQs, content
sections, aliases UI, tags UI, course mappings, consultant cards, media
uploads, SEO, Courses, Leads, CMS, student features, public Countries UI, or
Single Country frontend UI.

## Files changed

- `apps/api/src/continents/` and `apps/api/src/countries/`: DTOs, controllers,
  services, modules, safe response mapping, publish policy, and audit writes.
- `apps/api/src/catalog/`: catalog constants, pagination/status helpers, and
  safe audit utilities.
- `apps/api/src/app.module.ts`, `apps/api/src/auth/auth.module.ts`, and
  `apps/api/src/auth/roles.guard.ts`: module wiring and guard ordering support.
- `apps/api/test/catalog.e2e-spec.ts` and catalog unit coverage.
- `apps/admin/src/app/api/v1/admin/`: exact same-origin catalog BFF handlers.
- `apps/admin/src/features/catalog/`: typed client, BFF proxy, dialogs,
  continent/country list screens, country form, validation, and actions.
- `apps/admin/src/app/(protected)/continents/` and
  `apps/admin/src/app/(protected)/countries/`: protected App Router pages.
- `apps/admin/e2e/admin-catalog.spec.ts` and catalog unit coverage.
- `docs/development/TASK_004_COUNTRY_CATALOG_CORE.md`, this report, and the
  architecture, API contract, setup, README, dependency, and CI descriptions.

## API and authorization

Public reads are limited to active, published, non-deleted records and use the
existing response envelope with request IDs. Public country routes provide the
bounded list, suggestions, directory, and slug detail contracts. Unsupported
detailed profile filters are not accepted or persisted.

Admin catalog routes require `AccessTokenGuard`, `RolesGuard`, and the active
`SUPER_ADMIN` role. DTOs accept only safe core fields; actor IDs, audit fields,
publication state, deletion state, nested profile data, and arbitrary sort or
filter expressions cannot be supplied by the browser.

The Admin app calls only exact same-origin catalog BFF handlers. The BFF
allowlists resource/method combinations, forwards only the bearer token,
request ID, safe query values, and JSON body, uses `no-store` and a bounded
timeout, and maps upstream failures to safe envelopes.

## Validation and lifecycle policy

Names and descriptions are trimmed, slugs are normalized or generated on
create, ISO codes are uppercase and length-validated, pagination is bounded,
and sort values are allowlisted. Uniqueness and foreign-key conflicts return
stable 409 codes rather than raw Prisma details.

Countries start as `DRAFT`. Publishing requires a non-deleted active continent
and the required core fields; failures return 422 with safe field details.
Unpublishing immediately removes public visibility. Deletes set the existing
soft-delete/status fields. A continent with any non-deleted country is not
deleted and returns `CONTINENT_IN_USE`.

Mutation responses accept `expectedUpdatedAt` where applicable and return a
stable stale-version conflict if another editor has changed the row. Audit
events include actor, request, entity, and safe changed-field values only;
tokens, cookies, authorization headers, passwords, and complete sensitive
bodies are excluded.

## Admin UX

Protected routes are `/continents`, `/countries`, `/countries/new`, and
`/countries/[id]`. Screens include semantic headings, bounded search/filter
controls, loading/empty/error/retry states, responsive tables, accessible
dialogs, confirmation text for destructive actions, slug suggestion/manual
override, validation summaries, unsaved-change protection, stale-write
handling, and publish readiness errors. Planned modules remain visibly disabled
and no fake catalog metrics are shown.

## Tests and verification

The existing repository CI commands discover the new API, Admin, and browser
tests without weakening prior gates. Local verification for this task is:

```bash
npm run lint
npm run test
npm run build
npm --workspace apps/api run test:e2e -- --runInBand
set -a; . apps/api/.env; set +a
E2E_ADMIN_EMAIL="$SEED_ADMIN_EMAIL" E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" npm --workspace apps/admin run test:e2e
```

The catalog fixtures use unique per-run ISO values and soft-delete their local
records during cleanup, so reruns do not rely on hard deletion or fixed sample
codes. Final command results are recorded in the task handoff after the full
validation pass.

## Schema and prohibited-scope confirmation

No Prisma schema or migration changed. No `prisma db push`, migration reset,
Docker file, microservice, real environment file, credential, token, or sample
HTML dataset was added. The approved
`design/reference/final-countries-list.html` remains unchanged. TASK_005 is not
started.

## Audit and limitations

The dependency graph was not expanded for TASK_004. Existing audit findings
remain documented in `docs/DEPENDENCY_AUDIT.md`; no forced audit remediation is
applied. The public catalog frontend and detailed country content are
deliberately deferred to later approved work.
