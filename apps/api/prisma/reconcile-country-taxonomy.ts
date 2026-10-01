import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { reconcileCountryTaxonomy } from '../src/countries/country-taxonomy-reconciler';

/**
 * Works every destination's subject and specialization links out from the
 * courses taught there.
 *
 * Everything that existed before this ran was typed in, so the migration
 * marked it EDITORIAL and this leaves all of it alone. What it adds is what
 * the catalogue already said and nobody had recorded; from here on the
 * reconciler keeps the derived half in step on its own.
 *
 * Reports the gap it found rather than just doing it quietly, because the
 * size of that gap is the thing worth knowing.
 */
/** Same shape the seeds use; there is no shared module for it. */
function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required to reconcile country taxonomy');
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
  try {
    const countries = await prisma.country.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    let subjectsAdded = 0;
    let subjectsRemoved = 0;
    let specializationsAdded = 0;
    let specializationsRemoved = 0;
    let touched = 0;

    for (const country of countries) {
      const change = await reconcileCountryTaxonomy(prisma, country.id);
      subjectsAdded += change.subjectsAdded;
      subjectsRemoved += change.subjectsRemoved;
      specializationsAdded += change.specializationsAdded;
      specializationsRemoved += change.specializationsRemoved;
      if (
        change.subjectsAdded ||
        change.subjectsRemoved ||
        change.specializationsAdded ||
        change.specializationsRemoved
      )
        touched += 1;
    }

    console.log(`countries read          : ${countries.length}`);
    console.log(`countries changed       : ${touched}`);
    console.log(`subjects added          : ${subjectsAdded}`);
    console.log(`subjects removed        : ${subjectsRemoved}`);
    console.log(`specializations added   : ${specializationsAdded}`);
    console.log(`specializations removed : ${specializationsRemoved}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
