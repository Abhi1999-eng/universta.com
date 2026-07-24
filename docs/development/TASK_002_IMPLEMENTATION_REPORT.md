# TASK_002 — CI and Super Admin authentication implementation report

## Scope completed

Implemented GitHub Actions CI and backend-only Super Admin authentication.
The admin frontend login screen, public/student authentication, Countries,
Courses, Leads, CRUD APIs, schema changes, migrations, Docker, and version
changes remain deferred.

## CI workflow

`.github/workflows/ci.yml` runs on pull requests targeting `main` and pushes to
`main`. It uses concurrency cancellation, `actions/checkout@v6`,
`actions/setup-node@v6`, Node.js 25, `npm ci`, and the runner's native MySQL
service. Because the committed lockfile was originally generated on macOS, the
Linux runner extracts the matching existing `lightningcss-linux-x64-gnu` build
binary into ignored `node_modules` without changing manifests or the lockfile.
The `foundation-ci` job creates temporary `universta_ci` and
`universta_ci_shadow` databases with fixed non-production credentials and runs:

1. Prisma format check, validate, and generate.
2. Migration deploy and foundation seed.
3. API unit and E2E tests.
4. Workspace lint and web/admin/API builds.
5. `git diff --check` and a clean generated/build diff assertion.

The workflow does not use Docker, `prisma migrate dev`, `prisma migrate reset`,
`prisma db push`, or forced audit remediation. The final GitHub Actions result
is recorded in the task handoff after the branch workflow completes.

## Files changed

- `.github/workflows/ci.yml`
- `apps/api/src/auth/`: module, controller, service, DTO, password service,
  access-token guard, roles guard/decorator, and auth types/tests.
- `apps/api/src/common/common.module.ts` and redaction coverage.
- `apps/api/src/config/`, `bootstrap.ts`, and `app.module.ts` configuration and
  lifecycle wiring.
- `apps/api/.env.example`, root/API dependency manifests and lockfile.
- `docs/development/TASK_002_CI_ADMIN_AUTH.md`, this report, and focused setup,
  architecture, README, and dependency-audit updates.
- `apps/api/test/auth.e2e-spec.ts`.

`apps/api/prisma/schema.prisma`, the existing migration, and
`design/reference/final-countries-list.html` are unchanged.

## Dependencies added

- `@nestjs/jwt`
- `cookie-parser`
- `@types/cookie-parser` (development)

No bcrypt or Passport dependency was added. Node's built-in `crypto` remains
responsible for scrypt, token hashing, UUIDs, and constant-time comparisons.

## Environment variables

Required secrets are `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; each must be
at least 32 characters and they must differ. Typed configuration also supports
`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `AUTH_REFRESH_COOKIE_NAME`,
`AUTH_MAX_FAILED_ATTEMPTS`, and `AUTH_LOCK_MINUTES`, with documented local
defaults. Secrets are not printed, logged, returned in errors, or committed.

## Password and token policy

The reusable password service verifies the existing
`scrypt$<salt hex>$<derived key hex>` seed format and rejects malformed hashes
safely without rehashing the seeded administrator. Access JWTs contain only
`sub`, `email`, `roles`, `type=access`, and `jti`, with issuer and audience
validation. Refresh JWTs contain `sub`, `jti`, and `type=refresh`; only a hash of
the complete token is persisted. Rotation creates a replacement record,
links `replaced_by_token_id`, revokes the prior record, and rejects replay.

Refresh cookies are HttpOnly, SameSite=Lax, scoped to
`/api/v1/admin/auth`, Secure in staging/production, non-Secure in local
development/test, and aligned to the refresh expiry. The refresh token never
appears in JSON.

## Lockout, authorization, and audit behavior

Email is trimmed and lowercased. Login requires an active, non-deleted user
with an active `SUPER_ADMIN` role and a valid password. Unknown email, invalid
password, missing role, inactive user, and deleted user share one generic
authentication error. Failed attempts are recorded without passwords; the
configured threshold creates a temporary lock, and successful login resets
failure state and records the safe IP, login attempt, and `LOGIN` audit event.
Logout is idempotent, revokes a safely identified token, clears the cookie, and
records `LOGOUT`. The access guard, `CurrentUser`, `Roles`, `RolesGuard`, and
`AuthenticatedAdmin` foundations are reusable for future admin endpoints.

## Endpoints

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/refresh`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/auth/me`

All responses use the existing request-ID response envelope. Swagger documents
all four endpoints with non-secret examples and bearer/cookie behavior.

## Verification

Local checks passed:

- `npm install`
- `npm run db:format -- --check`
- `npm run db:validate`
- `npm run db:generate`
- Root/API unit tests: 17 passed.
- API E2E tests: 17 passed.
- `npm run lint`
- `npm run build` for web, admin, and API.
- `git diff --check`.
- Prisma schema and approved HTML unchanged; no migration added.

Runtime verification passed against the local seeded Super Admin without
printing credentials or tokens: health 200, login 200, `/me` 200, refresh 200,
old refresh replay 401, logout 200, post-logout refresh 401, invalid `/me` 401,
request ID present, refresh cookie rotated/cleared, raw refresh value absent
from JSON, and Swagger auth paths present.

## Audit result

`npm audit` and `npm audit --omit=dev` both report the existing 7 findings:
6 high and 1 moderate, with no critical findings. They are existing Prisma,
Next/PostCSS/sharp, and transitive tooling paths. The new auth dependencies do
not introduce a finding. `npm audit fix --force` was not run.

## Limitations and deferred work

No admin frontend login screen, public/student authentication, business API,
admin CRUD, schema migration, Docker setup, or TASK_003 work is included.
