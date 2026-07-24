# Migrations

Prisma Migrate is the only mechanism for application schema changes.

## Local development

```bash
npm run db:format
npm run db:validate
npm run db:migrate:status
npm run db:migrate:dev -- --name meaningful_migration_name
npm run db:generate
```

The initial migration is `20260724121517_init_phase_1`.

## Staging and production

```bash
npm run db:migrate:deploy
```

Do not make manual production schema edits. Review migration SQL and require approval for destructive migrations. Use expand → backfill → switch → contract for changes that need compatibility across releases.

Backups must be taken before production migrations. Rollback uses a forward corrective migration; do not edit `_prisma_migrations` or rely on destructive resets.

The initial migration contains reviewed custom SQL for the two MySQL full-text indexes requested by the blueprint. The requested related-course self-reference check is not emitted because MySQL rejects check constraints over columns participating in referential actions; application validation must enforce that invariant until a compatible database design is chosen.
