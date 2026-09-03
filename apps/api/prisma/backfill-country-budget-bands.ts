/**
 * One-time, idempotent canonicalisation of CountryCostProfile.budgetBand.
 *
 * The column is a plain VARCHAR with no database-level vocabulary. Every
 * application-layer contract -- the API DTO (`BUDGET_BANDS` in
 * profile.constants.ts), this repository's own demo seed, and both public
 * filter implementations -- uses BUDGET_FRIENDLY / MID_RANGE / PREMIUM. A
 * separate seeding script wrote LOW / MEDIUM / HIGH straight through Prisma,
 * bypassing that validator, so the deployed rows disagree with every filter
 * that reads them and the public Budget filter matches nothing at all.
 *
 * Ordering is preserved: LOW is the cheapest band and maps to BUDGET_FRIENDLY,
 * HIGH is the most expensive and maps to PREMIUM. Rows that are already
 * canonical are untouched, and a NULL band stays NULL -- "no band recorded" is
 * a real state and is not the same as "budget friendly".
 *
 * Re-running is a no-op: the second pass finds no legacy values left.
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

const MAPPING = [
  ['LOW', 'BUDGET_FRIENDLY'],
  ['MEDIUM', 'MID_RANGE'],
  ['HIGH', 'PREMIUM'],
] as const;

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required for the budget band backfill');
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseConfig()),
  });

  const before = await prisma.countryCostProfile.groupBy({
    by: ['budgetBand'],
    _count: { _all: true },
  });
  console.log('budgetBand before:', JSON.stringify(before));

  for (const [legacy, canonical] of MAPPING) {
    const { count } = await prisma.countryCostProfile.updateMany({
      where: { budgetBand: legacy },
      data: { budgetBand: canonical },
    });
    console.log(`${legacy} -> ${canonical}: ${count} row(s)`);
  }

  const after = await prisma.countryCostProfile.groupBy({
    by: ['budgetBand'],
    _count: { _all: true },
  });
  console.log('budgetBand after:', JSON.stringify(after));

  const legacyLeft = after.filter((row) =>
    MAPPING.some(([legacy]) => legacy === row.budgetBand),
  );
  if (legacyLeft.length)
    throw new Error(
      `Legacy budget bands remain: ${JSON.stringify(legacyLeft)}`,
    );

  await prisma.$disconnect();
}

void main();
