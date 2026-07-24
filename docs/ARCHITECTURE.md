# Architecture

Universta is a single Git repository with one application database and one development-only Prisma shadow database.

```text
Browser
  ├── Public Next.js App (apps/web, :3000)
  ├── Admin Next.js App (apps/admin, :3001)
  └── NestJS Modular Monolith (apps/api, :4000)
          ├── Prisma ORM and migrations
          └── MySQL: universta

Prisma migration infrastructure only: universta_shadow
```

The public and admin frontends are separate Next.js App Router applications with TypeScript, Tailwind, and ESLint. The API is one NestJS modular monolith; no microservices or second application database are introduced.

The API foundation uses a global typed runtime configuration module, one global
Prisma service, request-context middleware, a global validation pipe, a global
exception envelope, controlled CORS, and optional Swagger at `/api/docs`.
`/health` remains outside `/api/v1`. Prisma 7's generated client is retained;
the API TypeScript build uses CommonJS so the generated client and Nest runtime
share one module format.

Future extraction boundaries may follow authentication/identity, content/catalog, lead and counselling workflows, communications, and analytics. Those are boundaries for future code organization, not deployed services in Phase 1.
