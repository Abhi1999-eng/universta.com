import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  COUNTRY_DERIVED_MIGRATION,
  needsCountryDerivedMigrationRecovery,
} from '../src/prisma/country-derived-migration-recovery';

const recoveryRequiredExitCode = 10;

type MigrationRow = {
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required for migration recovery');

  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    // This recovery script runs before the API starts. Match the API adapter
    // configuration so MySQL caching_sha2_password can complete its loopback
    // RSA key exchange rather than timing out the deployment.
    allowPublicKeyRetrieval: true,
  };
}

async function tableColumns(prisma: PrismaClient, table: string) {
  const rows = await prisma.$queryRaw<Array<{ COLUMN_NAME: string }>>`
    SELECT COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `;
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function tableExists(prisma: PrismaClient, table: string) {
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `;
  return rows.length > 0;
}

async function indexExists(prisma: PrismaClient, table: string, index: string) {
  const rows = await prisma.$queryRaw<Array<{ INDEX_NAME: string }>>`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND INDEX_NAME = ${index}
  `;
  return rows.length > 0;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseConfig()),
  });

  try {
    if (!(await tableExists(prisma, '_prisma_migrations'))) return;

    const rows = await prisma.$queryRaw<MigrationRow[]>`
      SELECT finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name = ${COUNTRY_DERIVED_MIGRATION}
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const [
      countryColumns,
      universityColumns,
      qsRankingIndexExists,
      popularUniversitiesExists,
      popularCoursesExists,
    ] = await Promise.all([
      tableColumns(prisma, 'countries'),
      tableColumns(prisma, 'universities'),
      indexExists(
        prisma,
        'universities',
        'universities_country_id_qs_ranking_idx',
      ),
      tableExists(prisma, 'country_popular_universities'),
      tableExists(prisma, 'country_popular_courses'),
    ]);
    const migration = rows[0]
      ? {
          finishedAt: rows[0].finished_at,
          rolledBackAt: rows[0].rolled_back_at,
        }
      : undefined;
    if (
      needsCountryDerivedMigrationRecovery({
        migration,
        countryColumns,
        universityColumns,
        qsRankingIndexExists,
        popularUniversitiesExists,
        popularCoursesExists,
      })
    ) {
      process.exitCode = recoveryRequiredExitCode;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migration-recovery] ${message}`);
  process.exitCode = 1;
});
