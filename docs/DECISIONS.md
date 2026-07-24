# Decisions

- The current machine's Node.js 25.9.0 is used, per the user's explicit override of the original Node 24 recommendation. The package engine is `>=24` so Node 25 remains supported without changing installed software.
- The current machine's MySQL 9.7.1 Homebrew service is retained. Production versions will be selected during deployment planning and must be compatibility-verified first.
- npm workspaces are used for `apps/*` and `packages/*`.
- The project remains directly in the opened root; no `universta-platform` directory was created.
- The public and admin frontends remain separate Next.js applications. The API remains one NestJS modular monolith.
- MySQL is native Homebrew `mysql`; Docker is not used.
- `universta` is the only application database. `universta_shadow` is migration infrastructure only.
- The Prisma client is generated at `apps/api/src/generated/prisma`.
- Status values remain strings and are intended for application validation; MySQL ENUM was not used.
- The redirect source column remains `VARCHAR(1000)`, but its unique index uses a 750-character prefix because MySQL's UTF-8 index maximum rejects a full 1000-character unique key.
- The requested related-course check constraint was documented but omitted from SQL because MySQL rejected it when the columns also participate in foreign-key referential actions. The course relation uses `RESTRICT` and the invariant is deferred to application validation.
- No business API, authentication flow, admin CRUD, country/course UI, counselling form, or approved HTML conversion was implemented.

## Phase 1 scope freeze

Included: Super Admin authentication, continents, countries, Countries Listing, Single Country, subjects, course levels, study modes, courses, counselling leads, SEO, media, and managed consultant landing cards.

Deferred: public/student login, student dashboard, saved countries, saved universities, country comparison, university comparison, matching algorithm, application tracking, consultant accounts, and consultant dashboard.

The client-approved Countries Listing HTML is preserved at `design/reference/final-countries-list.html` and is the authoritative visual reference for the future implementation.
