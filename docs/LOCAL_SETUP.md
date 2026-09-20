# Local setup

Run these commands from `/Users/abhishekchaubey/projects/universta`.

## Retained local versions

This setup intentionally retains the versions already installed on the machine:
Node.js 25.9.0 and MySQL 9.7.1. The root package engine allows Node.js 24 or
newer. Production versions will be selected later; production compatibility
must be verified against the selected deployment versions before release.

## MySQL

The machine currently uses the Homebrew `mysql` formula:

```bash
brew services start mysql
brew services stop mysql
mysqladmin ping -h 127.0.0.1 --silent
```

If a machine has the versioned formula installed, the equivalent commands are:

```bash
brew services start mysql@8.4
brew services stop mysql@8.4
```

Open the root console:

```bash
mysql -u root -p
```

Bootstrap the two databases and local application user once:

```bash
mysql -u root -p < database/bootstrap.sql
```

Open the application database:

```bash
mysql -u universta_app -p -h 127.0.0.1 universta
```

## Install and migrate

```bash
npm install
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate:status
npm run db:migrate:dev -- --name meaningful_migration_name
npm run db:seed
```

## Run the apps

```bash
npm run dev:web
npm run dev:admin
npm run dev:api
```

The public app is at `http://localhost:3000`, the admin login/shell at `http://localhost:3001`, the API health endpoint at `http://localhost:4000/health`, and the versioned API prefix is `/api/v1`.

### Admin BFF configuration

Copy the server-only admin values from `apps/admin/.env.example` into a local
environment when needed:

```bash
API_BASE_URL=http://127.0.0.1:4000
ADMIN_APP_ORIGIN=http://localhost:3001
```

`API_BASE_URL` is intentionally not a `NEXT_PUBLIC_` variable. The browser
calls only the same-origin admin BFF routes for login, refresh, logout, and
`/me`; the refresh cookie remains HttpOnly and the access token is memory-only.

### API runtime configuration

The API requires `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGINS`,
`JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. JWT secrets must be distinct and
at least 32 characters long; generate local-only values and never commit
`apps/api/.env`. `PORT` defaults to `4000` only in development/test and must
otherwise be an integer from 1 to 65535. `SWAGGER_ENABLED` defaults to enabled
in development and disabled in other environments. Runtime startup does not
require `SHADOW_DATABASE_URL`.

Auth defaults are `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`,
`AUTH_REFRESH_COOKIE_NAME=universta_admin_refresh`,
`AUTH_MAX_FAILED_ATTEMPTS=5`, and `AUTH_LOCK_MINUTES=15`. The backend-only
Super Admin endpoints are `/api/v1/admin/auth/login`, `/refresh`, `/logout`,
and `/me`. Login returns only the access token in JSON; the rotating refresh
token is an HttpOnly cookie. Use the seeded Super Admin credentials from the
local environment for runtime checks, and do not paste credentials or tokens
into documentation.

`SHADOW_DATABASE_URL` remains in the local environment and Prisma migration
configuration because it is required by local Prisma migration tooling, not by
the running NestJS API.

Swagger is available at `http://localhost:4000/api/docs` when enabled, with the
OpenAPI JSON document at `http://localhost:4000/api/docs-json`.

Run API unit and catalog E2E tests with:

```bash
npm --workspace apps/api run test
npm --workspace apps/api run test:e2e
```

The catalog E2E suite requires the local seeded Super Admin environment and
uses isolated, soft-deleted records:

```bash
set -a
. apps/api/.env
set +a
npm --workspace apps/api run test:e2e -- --runInBand
```

Run the admin unit tests, then the real Chromium browser acceptance suite:

```bash
npm --workspace apps/admin run test
scripts/run-e2e.sh
```

`scripts/run-e2e.sh` takes the same arguments as `playwright test`, so
`scripts/run-e2e.sh study-abroad.spec.ts` runs one file and
`scripts/run-e2e.sh --list` shows what would run.

Use the script rather than exporting the environment by hand. Sourcing
`apps/api/.env` wholesale — which is the obvious way to reach the seeded admin
credentials — also exports `NODE_ENV=development`, and Playwright's own
`next build` for the admin and web apps then fails prerendering
`/_global-error` with "Cannot read properties of null (reading 'useContext')".
That reads like broken application code and is only a broken shell. The script
lifts out the three values it needs and leaves the rest alone. It also keeps
the Playwright browser binaries in step with `@playwright/test`; a cache from
an older version fails every test at launch, which reads like the whole suite
regressing.

The browser test variables are local-only and are never sent to the browser
bundle or committed. Playwright starts the API on port 4000, the admin app on
port 3001 and the web app on port 3000 through readiness checks. When one of
those ports is already taken, set `E2E_WEB_BASE_URL`, `E2E_ADMIN_BASE_URL` or
`E2E_API_BASE_URL`; the specs, the servers and the API's allowed origins all
follow from those, so a moved port does not turn into a 403 on the assessment
POST.

Run the backend locally for an auth check:

```bash
npm run dev:api
curl -i http://localhost:4000/health
```

The catalog core is available at `/api/v1/continents` and the core country
read endpoints under `/api/v1/countries`. TASK_007 adds published public reads
under `/api/v1/subjects`, `/api/v1/course-levels`, `/api/v1/study-modes`, and
`/api/v1/courses`; the public web screens are `/subjects` and `/courses`.
Super Admin catalog screens are available at `http://localhost:3001/continents`,
`/countries`, `/subjects`, `/courses`, and `/catalog-masters` after login.
Course Comparison, Leads, CMS, and other future business modules remain
deferred. TASK_005 adds structured profile API routes under
`/api/v1/admin/countries/:countryId/profiles` and the protected country editor
sections for cost, work/visa, language, intakes, and statistics. TASK_003
provides the admin login, same-origin authentication BFF, and protected shell.

The seed command creates deterministic fictional local profile data for Canada,
including active intake mappings. These values are for development/testing and
are source-marked so public redaction and verification behavior can be tested;
they are not production country facts.

Open Prisma Studio:

```bash
cd apps/api
npx prisma studio
```

Check migration status:

```bash
cd apps/api
npx prisma migrate status
```

Create a future local migration:

```bash
cd apps/api
npx prisma migrate dev --name meaningful_migration_name
```

Deploy reviewed migrations:

```bash
cd apps/api
npx prisma migrate deploy
```

## Safe inspection and reset warning

Use `SHOW TABLES`, `DESCRIBE table_name`, and read-only `SELECT` statements to inspect data. `prisma migrate reset` destroys the local database and reseeds it; never run it without explicit approval and only against a disposable local database. It was not used for this setup.
