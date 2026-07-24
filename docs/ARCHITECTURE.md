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

Future extraction boundaries may follow authentication/identity, content/catalog, lead and counselling workflows, communications, and analytics. Those are boundaries for future code organization, not deployed services in Phase 1.
