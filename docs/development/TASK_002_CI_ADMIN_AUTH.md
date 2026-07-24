# TASK_002 — CI and Super Admin authentication design

## Scope

TASK_002 adds GitHub Actions validation for the monorepo and the backend-only
Super Admin authentication lifecycle. It does not add an admin frontend login
screen, public/student authentication, or any business module.

## Architecture decisions

- Authentication remains inside the existing NestJS modular monolith.
- The existing Prisma schema and initial migration are reused unchanged.
- `@nestjs/jwt` signs and verifies access and refresh JWTs; Node `crypto`
  handles scrypt verification, SHA-256 token hashes, UUIDs, and constant-time
  comparisons.
- Access tokens are short-lived bearer tokens. Refresh tokens are rotating,
  persisted only as hashes, and delivered only through an HttpOnly cookie.
- The existing response envelope, request context, structured logger, global
  validation, exception filter, Swagger setup, and Prisma lifecycle remain the
  cross-cutting foundation.

## Endpoints

- `POST /api/v1/admin/auth/login` — verifies a Super Admin and returns an
  access token while setting the refresh cookie.
- `POST /api/v1/admin/auth/refresh` — verifies, revokes, and replaces the
  presented refresh token and returns a new access token.
- `POST /api/v1/admin/auth/logout` — revokes the presented token when safely
  identifiable and always clears the cookie.
- `GET /api/v1/admin/auth/me` — requires an access bearer token and confirms
  the user is still active in the database.

## Token lifecycle

Access JWTs contain `sub`, `email`, `roles`, `type=access`, and `jti`, with
Universta issuer and admin-API audience claims. Refresh JWTs contain only
`sub`, `jti`, and `type=refresh`, and their complete signed value is hashed
before persistence. Refresh rotation revokes the old record, creates a
replacement record, links `replaced_by_token_id`, and rejects replay.

## Cookie policy

The refresh cookie defaults to `universta_admin_refresh`, is HttpOnly, uses
SameSite=Lax, is Secure in production and non-Secure for localhost development,
is scoped to `/api/v1/admin/auth`, and has a max-age matching the refresh TTL.
Logout clears it with matching attributes. It is never returned in JSON.

## Password verification

The reusable password service accepts the existing seed format:
`scrypt$<salt hex>$<derived key hex>`. It safely rejects malformed values,
derives with the same scrypt parameters, and compares derived keys with
`timingSafeEqual`. It does not rehash or silently modify the seeded user.

## Login lockout rules

Email is trimmed and lowercased. A successful login requires an active,
non-deleted user with an active `SUPER_ADMIN` role and a valid password.
Unknown email, invalid password, inactive/deleted user, and missing role use
the same generic authentication error. Failed attempts are recorded without
the attempted password; an existing user is locked for `AUTH_LOCK_MINUTES`
after `AUTH_MAX_FAILED_ATTEMPTS`. Expired locks are not permanent and a
successful login resets the failure counter and lock state.

## Audit events

Successful login and safely identified logout write `AUTH` audit rows with
safe entity/action values and request metadata. Login failures are recorded in
`login_attempts`. No password, cookie, token, derived key, or secret is stored
in audit rows or logs.

## CI workflow

`.github/workflows/ci.yml` runs on pull requests targeting `main` and pushes to
`main`, cancels superseded runs, uses the current stable v6 checkout/setup-node
actions with Node.js 25, and uses the runner's native MySQL service. It creates
temporary `universta_ci` and `universta_ci_shadow` databases with fixed,
clearly non-production credentials, then runs format, validation, generation,
migration deploy, seed, API unit/E2E tests, lint, all builds, and a clean diff
check. Docker and destructive Prisma commands are not used.

## Test plan

Unit tests cover password success/failure/malformed hashes, token hashing,
configuration validation, access-token guard behavior, role metadata, and
redaction. E2E tests cover login, generic failures, lockout and reset, cookie
handling, refresh rotation/replay, logout idempotence, `/me` authorization,
envelopes, audit/login-attempt persistence, and sensitive-data absence.

## Acceptance criteria

- CI passes on Node.js 25 with native MySQL and CI-only credentials.
- All four endpoints use the standard envelope and required security policy.
- Refresh tokens rotate and replay is rejected.
- `/me` validates current database status, not only token claims.
- No schema, migration, approved HTML, admin frontend, or business module is
  changed.
- Local format, validation, generation, lint, tests, builds, runtime checks,
  and audit review pass or are documented with genuine blockers.

## Prohibited scope

No admin frontend login screen, public/student auth, Countries, Courses, Leads,
CRUD endpoints, schema changes, migrations, Docker files, version changes,
microservices, database resets, or production credentials.
