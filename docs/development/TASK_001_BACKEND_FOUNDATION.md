# TASK_001 — Backend foundation

Planning task only. Do not execute this document as part of the current planning phase.

## Goal

Harden the existing NestJS shell into a production-ready backend foundation without adding business APIs.

## Scope

- Validate configuration at startup: `NODE_ENV`, `PORT`, `DATABASE_URL`, `SHADOW_DATABASE_URL`, CORS origins, and environment-specific required values.
- Keep the `/api/v1` global prefix while exposing the setup health endpoint at `/health`.
- Add a Prisma module/service with one managed client, connection lifecycle, graceful shutdown, and database health query.
- Add a global validation pipe with whitelist/transform/forbid-unknown behavior.
- Add a consistent exception filter/envelope with status, code, message, details, request ID, and timestamp.
- Add request ID middleware/interceptor and structured logging foundation with sensitive-field redaction.
- Configure CORS from the allowlist environment variable.
- Add Swagger/OpenAPI bootstrap for the versioned API, excluding secrets and internal DB details.
- Keep the existing minimal `/health` endpoint and add DB status without exposing credentials.
- Add unit/e2e tests for configuration failures, health success/failure, Prisma lifecycle, validation, exception envelope, request IDs, CORS, and Swagger availability.

## Explicit non-goals

Do not implement auth controllers, user CRUD, countries, courses, leads, admin CRUD, business services, or feature screens in TASK_001. Do not change the database schema or create a migration unless a separate approved task discovers a genuine gap.

## Acceptance criteria

The API starts with valid environment configuration, fails fast with actionable redacted errors when configuration is invalid, responds from `/health`, reports database connectivity without leaking details, emits request IDs, rejects unknown/invalid DTO data, uses a stable error envelope, supports only configured CORS origins, exposes reviewed Swagger docs, shuts down Prisma cleanly, and passes lint/test/build.
