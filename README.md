# Universta

Universta is a single-repository Phase 1 foundation with two Next.js applications, one NestJS modular monolith, native MySQL, and Prisma migrations.

This repository currently contains setup scaffolding only. Business APIs, authentication flows, admin CRUD screens, public country/course views, counselling forms, and approved HTML conversion are intentionally deferred.

## Applications

- Public web: `apps/web`, port 3000
- Admin shell: `apps/admin`, port 3001
- API foundation: `apps/api`, port 4000
- Database specification and bootstrap: `database/`
- Setup and operating documentation: `docs/`

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for the exact local workflow.
