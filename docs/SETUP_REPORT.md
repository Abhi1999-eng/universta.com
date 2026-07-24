# Universta Phase 1 setup report

## Result

Foundation setup completed in `/Users/abhishekchaubey/projects/universta`.

## Versions and services

- Node.js: 25.9.0
- npm: 11.12.1
- MySQL: 9.7.1, Homebrew `mysql`, running on 127.0.0.1:3306
- These installed local versions were intentionally retained; production
  versions will be chosen later and compatibility must be verified before release.
- Next.js: 16.2.11 in `apps/web` and `apps/admin`
- NestJS: 11.x scaffold, API build verified
- Prisma CLI/client: 7.9.0

## Database and migration evidence

- Databases: `universta`, `universta_shadow`
- Both databases use `utf8mb4` and `utf8mb4_0900_ai_ci`.
- Migration: `20260724121517_init_phase_1`
- Migration status: database schema is up to date.
- Table count: 50 total, consisting of 49 application tables plus `_prisma_migrations`.
- Foreign keys and critical indexes were inspected through `information_schema`.

## Seed evidence

The seed was run twice through `npx prisma db seed`.

| Table | First run | Second run |
| --- | ---: | ---: |
| roles | 1 | 1 |
| users | 1 | 1 |
| user_roles | 1 | 1 |
| continents | 7 | 7 |
| intakes | 3 | 3 |
| course_levels | 7 | 7 |
| study_modes | 4 | 4 |
| feature_flags | 5 | 5 |
| site_settings | 4 | 4 |
| platform_metrics | 3 | 3 |

The seed uses local environment credentials, hashes the local administrator password with scrypt, and creates no countries, courses, visa claims, or marketing facts.

## Validation

- `npm run db:format`: passed
- `npm run db:validate`: passed
- `npm run db:generate`: passed
- `npm run lint`: passed with no errors; the generated Nest scaffold initially reported a non-floating-promise warning, which was corrected.
- `npm run test`: passed, 2 tests.
- `npm run build`: passed for web, admin, and API.
- Runtime checks: passed. API `/health` returned HTTP 200 with `{"status":"ok"}`; web and admin returned HTTP 200; all processes were stopped cleanly and ports 3000/3001/4000 were free.

## Start commands

```bash
npm run dev:web
npm run dev:admin
npm run dev:api
```

Prisma Studio:

```bash
cd apps/api && npx prisma studio
```

## Created or modified foundation files

- Root workspace: `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CODEX_MASTER_PROMPT.md`
- Apps: `apps/web`, `apps/admin`, `apps/api`
- Database: `database/bootstrap.sql`, `database/PHASE_1_SCHEMA.md`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/prisma.config.ts`, and the initial migration
- Documentation: all files under `docs/`
- Scripts: `scripts/scaffold-local.sh`

Actual `.env` files and local secrets are ignored and are not included in this report.

## Warnings and deferred work

- Dependency audit: 6 high findings, 0 critical/moderate/low findings, with
  the same result for production-only dependencies. No safe non-breaking
  remediation was available; `npm audit fix --force` was not used. Details:
  `docs/DEPENDENCY_AUDIT.md`.
- The current database is MySQL 9.7.1 rather than the versioned 8.4 formula
  mentioned in the original setup notes; this is intentional for local setup.
- The related-course self-reference invariant needs application validation; see `docs/DECISIONS.md`.
- Business APIs, authentication, admin CRUD, Countries UI, Single Country UI, Courses UI, counselling forms, and approved HTML conversion remain intentionally deferred.

## Continuation planning status

- Approved source preserved at `/Users/abhishekchaubey/Downloads/Final countries List.html`.
- Canonical design reference: `design/reference/final-countries-list.html`.
  It is byte-for-byte identical to the approved original; the original was not modified.
- Design analysis, component matrix, data mapping, and acceptance criteria are
  complete under `docs/design/`.
- Schema gap assessment: no genuine Phase 1 schema gap was identified for the
  approved Countries Listing; structured mapping is documented in
  `docs/design/COUNTRIES_DATA_MAPPING.md`.
- Planned backend modules and API contracts are documented under
  `docs/development/`; implementation has not started.
- Phase 1 planning is complete. Coding milestones remain not started.
- Deferred controls include student/public authentication, dashboards, saved
  items, comparison, matching, tracking, and consultant accounts/dashboards;
  feature flags and settings are documented for later rollout.
- Baseline commit: `6305926852be4f53349b4b4edb2072742b0183da` — `chore: freeze foundation and phase 1 planning`.
- No blocker requires user input. The unresolved audit findings and future
  production-version compatibility check are tracked warnings, not setup blockers.
