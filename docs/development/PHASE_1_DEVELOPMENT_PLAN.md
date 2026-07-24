# Phase 1 development plan

The approved Countries Listing reference is `design/reference/final-countries-list.html`. It is the authoritative visual reference for Milestone 4 and must remain unchanged.

| Milestone | Scope and dependencies | Tables/APIs/screens | Tests and acceptance | Prohibited scope |
| --- | --- | --- | --- | --- |
| 1. Backend foundation | Configuration, Prisma service/module, validation, exceptions, request IDs, logging, CORS, Swagger, health and DB health; depends on verified foundation | API `/health`, `/api/v1`; no business tables beyond existing schema | Unit/e2e config, health, DB failure, envelope, request ID tests | Business controllers, auth flows, CRUD |
| 2. Super Admin auth and admin shell | Auth/session/roles and a protected admin shell; depends on Milestone 1 | users/roles/token tables; auth endpoints; admin layout/navigation | Password/token, lockout, permissions, redirect, security tests | Public/student login, student dashboard |
| 3. Continents and Countries backend/admin | Catalog CRUD, publish/soft delete, sources, profiles, stats, tags, media and audit; depends on auth and media | country tables; continents/countries admin APIs and screens | DTO, permission, source, soft-delete, FK, query tests | Countries Listing visual conversion |
| 4. Approved Countries Listing frontend | Convert the approved HTML into API-backed responsive Next.js UI; depends on public contracts and published data | `GET /continents`, metrics, countries, suggestions, directory, consultant cards; Countries Listing screen | 1440/1024/768/390 screenshots, search/filter/a11y/empty/error/SEO tests | Single Country, Courses, comparison, matching |
| 5. Single Country frontend | Detail page from structured country profiles/content; depends on country API | `GET /countries/:slug`; Single Country screen | Source/verification, responsive, SEO, accessibility tests | University detail/app tracking |
| 6. Subjects and Courses | Catalog CRUD and public course discovery/detail; depends on catalog permissions | subject/course tables and APIs; Subjects/Courses screens | Query, mappings, content, source, search and accessibility tests | Student accounts, matching engine |
| 7. Leads, SEO, accessibility, staging readiness | Counselling intake, booking, SEO completeness, performance/security/staging checks | leads/bookings/email/SEO; forms and operational screens | Consent, rate limits, audit, Lighthouse/visual/a11y/production migration rehearsal | Consultant accounts/dashboard, application tracking |

Each milestone requires reviewed API contracts, no unsupported claims, no dead actions, and updated documentation. Migrations follow expand → backfill → switch → contract.
