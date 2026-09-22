import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Empties the database except what a Super Admin needs to sign in.
 *
 * Kept: `_prisma_migrations`, `roles`, every user holding SUPER_ADMIN, their
 * role links and their refresh tokens. Everything else is truncated --
 * catalogue, website builder, lookups, leads, students, audit logs, media
 * records. Afterwards `npm run db:seed` restores the foundation (pages,
 * navigation, continents, lookups, settings, flags) and `db:seed:catalogue`
 * the catalogue, including the feature and English-test taxonomy a migration
 * originally inserted.
 *
 * There is no undo, so by default it only reports what it would do. It acts
 * only with RESET_EXECUTE=1 and RESET_CONFIRM set to the name of the database
 * it is about to empty, and it refuses outright if no Super Admin exists,
 * since emptying `users` would then lock everyone out.
 */

const KEEP = new Set([
  '_prisma_migrations',
  'roles',
  'users',
  'user_roles',
  'refresh_tokens',
]);

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required');
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '').split('?')[0],
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const config = databaseConfig();
  const execute = process.env.RESET_EXECUTE === '1';
  if (execute && process.env.RESET_CONFIRM !== config.database)
    throw new Error(
      `Refusing to empty "${config.database}": set RESET_CONFIRM=${config.database} to confirm.`,
    );

  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config) });
  try {
    const admins = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT u.id FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
       WHERE r.code = 'SUPER_ADMIN' AND u.deleted_at IS NULL`;
    if (!admins.length)
      throw new Error('No Super Admin found; refusing to empty users.');
    const keepIds = admins.map((admin) => admin.id);

    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       ORDER BY table_name`;
    const truncate = tables
      .map((row) => row.name)
      .filter((name) => !KEEP.has(name));
    const others = await prisma.user.count({
      where: { id: { notIn: keepIds } },
    });

    console.log(`Database: ${config.database}`);
    console.log(
      `Keeping ${keepIds.length} Super Admin account(s) and: ${[...KEEP].join(', ')}`,
    );
    console.log(
      `Removing ${others} other user account(s) and truncating ${truncate.length} tables.`,
    );
    if (!execute) {
      console.log(
        'Dry run: nothing changed. Set RESET_EXECUTE=1 and RESET_CONFIRM to act.',
      );
      return;
    }

    /* One connection throughout, because FOREIGN_KEY_CHECKS is per session.
       TRUNCATE commits implicitly, so the transaction only pins the
       connection; it does not make the reset atomic. */
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
        for (const name of truncate)
          await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${name}\``);
        await tx.refreshToken.deleteMany({
          where: { userId: { notIn: keepIds } },
        });
        await tx.userRole.deleteMany({ where: { userId: { notIn: keepIds } } });
        await tx.user.deleteMany({ where: { id: { notIn: keepIds } } });
        await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    console.log(
      'Done. Run `npm run db:seed`, then `npm --workspace apps/api run db:seed:catalogue`.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
