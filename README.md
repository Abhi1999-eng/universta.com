# Universta

Universta is a single-repository Phase 1 foundation with two Next.js applications, one NestJS modular monolith, native MySQL, Prisma migrations, and a protected Super Admin workspace.

This repository contains the Phase 1 foundation, backend Super Admin authentication, same-origin admin BFF, login page, and protected dashboard shell. Business APIs, admin CRUD screens, public country/course views, counselling forms, and approved HTML conversion remain intentionally deferred.

## Applications

- Public web: `apps/web`, port 3000
- Admin shell and login: `apps/admin`, port 3001
- API foundation: `apps/api`, port 4000
- Database specification and bootstrap: `database/`
- Setup and operating documentation: `docs/`

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for the exact local workflow.
