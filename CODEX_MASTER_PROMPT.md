# CODEX MASTER PROMPT — UNIVERSTA PHASE 1 LOCAL FOUNDATION

You are the principal setup engineer and database architect for the Universta
Phase 1 project. Work autonomously in the local macOS environment, but stop
when credentials or destructive approval are needed.

## Scope boundary

This task is FOUNDATION SETUP ONLY.

Do not implement:
- Countries UI
- Single Country UI
- Courses UI
- Admin CRUD screens
- Business controllers/services
- Authentication flows
- Counselling forms
- Approved HTML conversion

You may keep only the default framework starter screens/routes required to
prove each app builds and runs.

The approved HTML is an input for later. Inventory it in
`docs/ASSET_INVENTORY.md`; do not convert it now.

## Frozen decisions

- macOS local environment
- No Docker
- Node.js 24 LTS
- npm
- One Git repository
- Public frontend: Next.js + TypeScript + App Router + Tailwind + ESLint
- Super Admin frontend: separate Next.js app
- Backend: one Node.js NestJS modular monolith
- Database: native MySQL
- ORM/migrations: current stable Prisma ORM
- Application DB: `universta`
- Development-only shadow DB: `universta_shadow`
- Public app port 3000
- Admin app port 3001
- API port 4000
- MySQL port 3306

Do not create microservices or multiple application databases.
The shadow database is migration infrastructure, not an application database.

## Required structure

universta-platform/
├── apps/
│   ├── web/
│   ├── admin/
│   └── api/
├── packages/
├── database/
│   ├── bootstrap.sql
│   └── PHASE_1_SCHEMA.md
├── docs/
│   ├── ASSET_INVENTORY.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── MIGRATIONS.md
│   ├── LOCAL_SETUP.md
│   ├── DECISIONS.md
│   └── SETUP_REPORT.md
├── scripts/
├── .gitignore
├── package.json
└── README.md

## Phase A — Inspect

Run and record:
- pwd
- uname -m
- sw_vers
- node -v
- npm -v
- git --version
- mysql --version
- brew services list | grep mysql || true

Verify Node major version is 24 and MySQL is running.
Search for an existing Universta repository before creating a duplicate.
Read every supplied file and locate the approved HTML/assets.
Do not overwrite user files silently.

If Node 24 or MySQL is absent, stop and report the exact installation command.
Do not install/upgrade system software without approval.

## Phase B — Bootstrap MySQL

Run as MySQL root:

mysql -u root -p < database/bootstrap.sql

The owner may type the root password once. Never store, echo, commit, or write
the root password to any file.

Verify:
- `universta` exists
- `universta_shadow` exists
- both use utf8mb4 / utf8mb4_0900_ai_ci
- `universta_app` connects through 127.0.0.1
- the app user has full local privileges on both databases
- no application tables exist before migration

## Phase C — Scaffold repository

Create one Git repository and this structure.

Public app command:

npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes

Admin app command:

npx create-next-app@latest apps/admin --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes

API command:

npx @nestjs/cli@latest new apps/api --package-manager npm --skip-git --strict

Requirements:
- remove nested `.git` directories
- create one root npm workspace for `apps/*` and `packages/*`
- configure root scripts for dev/build/lint/test/database commands
- use one root `.gitignore`
- do not create a GitHub remote in this task unless separately requested

Recommended root scripts:
- dev:web
- dev:admin
- dev:api
- build:web
- build:admin
- build:api
- build
- lint
- test
- db:format
- db:validate
- db:generate
- db:migrate:dev
- db:migrate:deploy
- db:migrate:status
- db:studio
- db:seed

## Phase D — Environment files

Create:
- apps/api/.env
- apps/api/.env.example
- apps/web/.env.local
- apps/web/.env.example
- apps/admin/.env.local
- apps/admin/.env.example

Use the supplied API example as the base.
Generate two different strong local JWT secrets.
Never print secrets in the final report and never commit actual `.env` files.

Web:
NEXT_PUBLIC_APP_NAME="Universta"
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000/api/v1"

Admin:
NEXT_PUBLIC_APP_NAME="Universta Admin"
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000/api/v1"

## Phase E — Prisma setup

Inside `apps/api` install:
- prisma (dev)
- @prisma/client
- @prisma/adapter-mariadb
- dotenv
- tsx (dev)
- @types/node (dev)

Initialize:

npx prisma init --datasource-provider mysql --output ./src/generated/prisma

Use current Prisma config style:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/seed.ts`
- `apps/api/prisma/migrations/`

`prisma.config.ts` must:
- load dotenv
- set schema path
- set migrations path
- set the seed command
- use DATABASE_URL
- use SHADOW_DATABASE_URL

Schema rules:
- provider mysql
- current `prisma-client` generator
- output `./src/generated/prisma`
- UUID strings stored as CHAR(36)
- DateTime(3)
- Decimal for money/scores
- explicit native MySQL types
- Prisma model/field names may be camelCase but SQL tables/columns must map to snake_case
- avoid MySQL ENUM; validate status strings in application code
- define relations, unique constraints, indexes and soft-delete columns
- no application table may be created manually outside migrations

## Phase F — Full Phase 1 database

Read `database/PHASE_1_SCHEMA.md` completely.

Translate every listed table, field, relation, unique constraint and index into
Prisma models.

Create the initial migration:

npm run db:migrate:dev -- --name init_phase_1

Never use:
- prisma db push
- direct table creation for application tables
- editing `_prisma_migrations`
- migrate reset without explicit approval

If a required MySQL full-text/special index cannot be expressed cleanly by
Prisma:
1. generate with `--create-only`
2. review/edit SQL
3. document custom SQL
4. apply the migration
5. prove it on a fresh database

## Phase G — Seed foundation data only

Create an idempotent seed for:
- SUPER_ADMIN role
- one local Super Admin from environment variables
- continents/regions
- standard intakes
- course levels
- study modes
- initial feature flags
- minimum site settings
- unverified metric placeholders only

Hash the Super Admin password.
Never hardcode real credentials.
Running the seed twice must not duplicate data.
Do not seed unsupported marketing/visa claims as verified facts.

## Phase H — Documentation

Create `docs/ARCHITECTURE.md`:
- public Next.js app
- admin Next.js app
- NestJS modular monolith
- one application database
- one development-only shadow database
- future extraction boundaries, without microservices now

Create `docs/DATABASE.md`:
- all tables by module
- relation overview
- deletion policy
- verification/source fields
- indexes

Create `docs/MIGRATIONS.md`:
- local: prisma migrate dev
- staging/production: prisma migrate deploy
- no manual production schema edits
- expand → backfill → switch → contract approach
- destructive migration approval
- backup and forward-correction rollback policy
- migration status/create-only/deploy commands

Create `docs/LOCAL_SETUP.md` with exact commands to:
- start/stop MySQL
- open MySQL console
- install dependencies
- migrate
- seed
- run all apps
- open Prisma Studio
- safely inspect tables
- reset only a disposable local DB with a prominent data-loss warning

Create `docs/DECISIONS.md` and `docs/ASSET_INVENTORY.md`.

## Phase I — Acceptance checks

Run and fix:
1. npm install
2. npm run db:format
3. npm run db:validate
4. npm run db:generate
5. npm run db:migrate:status
6. seed twice; confirm no duplicates
7. verify SHOW TABLES
8. verify `_prisma_migrations`
9. verify every table in PHASE_1_SCHEMA.md
10. verify foreign keys
11. verify unique constraints and critical indexes
12. npm run lint
13. npm run test
14. npm run build
15. run web on 3000
16. run admin on 3001
17. run API on 4000
18. stop processes cleanly
19. confirm no secrets in git status
20. confirm `.env` files are ignored
21. confirm no Docker files/containers were introduced
22. confirm no business feature code was implemented

## Final report

Write `docs/SETUP_REPORT.md` and report:
- final path
- Node/npm/MySQL/Next/Nest/Prisma versions
- database names
- migration name/status
- total table count
- seed result
- build/lint/test results
- commands to start all apps
- commands to open MySQL and Prisma Studio
- files created
- assumptions/warnings
- deferred coding work

Do not claim success without command evidence.
