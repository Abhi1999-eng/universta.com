# TASK_001 — Backend foundation implementation report

## Scope completed

Implemented the backend foundation only. The API now has typed startup
configuration, runtime validation, `/api/v1` routing with `/health` excluded,
controlled CORS, a global Prisma service, database health checks, graceful
shutdown hooks, validation, exception envelopes, request IDs, structured
request logging, sensitive-field redaction, and configurable Swagger.

No authentication, business API, admin CRUD, country/course/lead feature, or
frontend implementation was added.

## Files changed

- `apps/api/src/config/`: runtime environment validation, typed configuration,
  and configuration module.
- `apps/api/src/prisma/`: global Prisma module/service and lifecycle test.
- `apps/api/src/common/`: request context, request middleware, logging,
  redaction, validation pipe, response types, and exception filter.
- `apps/api/src/health/`: database health service.
- `apps/api/src/app.module.ts`, `app.controller.ts`, `main.ts`, and
  `bootstrap.ts`: application wiring and startup.
- `apps/api/src/*.spec.ts` and `apps/api/test/`: unit and E2E foundation tests.
- `apps/api/tsconfig.json`: CommonJS module output for compatibility with the
  existing Prisma 7 generated client.
- `apps/api/.env.example`, `docs/ARCHITECTURE.md`, and `docs/LOCAL_SETUP.md`.

Prisma schema, migrations, `database/PHASE_1_SCHEMA.md`, and the approved HTML
were unchanged.

## Dependencies

Added direct API dependencies:

- `@nestjs/config` 4.0.4
- `@nestjs/swagger` 11.4.5
- `class-transformer` 0.5.1
- `class-validator` 0.15.1

The Swagger package is pinned to 11.4.5 because the newer 11.4.6 package pins
an audited vulnerable `js-yaml` version. No forced audit fix was used.

## Runtime environment

Required: `NODE_ENV`, `DATABASE_URL`, and `CORS_ORIGINS`. `PORT` defaults to
4000 in development/test and is validated as 1–65535. `SWAGGER_ENABLED` is
enabled by default only in development. `SHADOW_DATABASE_URL` is deliberately
not read by Nest runtime configuration; it remains available to Prisma local
migration tooling.

Configuration failures name only the invalid variable and never include its
value.

## Prisma lifecycle and health

`PrismaModule` is global and provides one `PrismaService` per Nest process.
The service uses the existing Prisma 7 generated client and MariaDB adapter,
connects in `onModuleInit`, disconnects in `onModuleDestroy`, and runs a
minimal `SELECT 1` health query. Nest shutdown hooks are enabled. Raw Prisma
errors are logged only as safe health failure context and are not returned.

## Validation and error envelope

The global `ValidationPipe` uses whitelist, forbid-non-whitelisted fields,
transformation, and explicit DTO conversion rather than unrestricted implicit
conversion. Validation errors use `VALIDATION_ERROR` with structured property,
constraint, and message details.

All handled errors use:

```json
{
  "data": null,
  "meta": null,
  "error": { "code": "ERROR_CODE", "message": "Safe message", "details": null },
  "requestId": "request-id",
  "timestamp": "ISO-8601 timestamp"
}
```

Unknown errors become `INTERNAL_ERROR`; 404, 401, 403, 409, 429, and 503 map to
stable codes. No stack traces, SQL, Prisma internals, credentials, or
environment values are sent over HTTP.

## Request IDs and logging

`x-request-id` is accepted only for values matching the documented 100-character
safe format. Empty, malformed, control-character, or oversized values are
replaced with a UUID. The ID is returned in the response header, included in
error envelopes, stored in `AsyncLocalStorage` request context, and emitted in
request logs.

Request logs are JSON records containing timestamp, level, requestId, method,
path, statusCode, and durationMs. Bodies are not logged. Authorization,
cookies, passwords, password hashes, access/refresh/reset tokens, database
URLs, JWT secrets, and API keys are redacted.

## CORS

`CORS_ORIGINS` is parsed by trimming, removing empty entries, normalizing URLs,
and deduplicating. Wildcards and path-bearing origins are rejected. Requests
from `http://localhost:3000` and `http://localhost:3001` are allowed by the
local example; unknown browser origins receive no CORS allow-origin header.
Requests without an Origin header remain permitted for health checks and
server-to-server tools. Credentials are enabled without wildcard origins.

## Health and Swagger

- `GET /health` returns HTTP 200 with `{ status: "ok", database: "up", timestamp }`.
- Database failure returns HTTP 503 with `{ status: "degraded", database: "down", timestamp }`.
- Both health responses include `x-request-id`.
- Swagger UI: `/api/docs` when enabled.
- OpenAPI JSON: `/api/docs-json` when enabled.
- Metadata: Universta API, version 1.0, Phase 1 API description, future bearer
  authentication definition.

## Tests and commands

- Unit tests: 4 suites, 12 tests passed.
- E2E tests: 1 suite, 8 tests passed.
- `npm run lint`: passed.
- `npm run db:validate`: passed.
- `npm run db:generate`: passed.
- `npm run build`: passed for web, admin, and API.
- Runtime curl checks passed for health, Swagger UI, Swagger JSON, and an
  unknown versioned route.

## Limitations and deferred work

This task does not implement auth, JWTs, user/role CRUD, country/course/lead
APIs, admin screens, frontend conversion, queues, microservices, or schema
changes. Swagger is intentionally disabled outside development unless
explicitly enabled. The existing audit findings remain tracked in
`docs/DEPENDENCY_AUDIT.md` and require a controlled future dependency review.
