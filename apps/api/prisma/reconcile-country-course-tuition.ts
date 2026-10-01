import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  liveOfferingsWhere,
  summariseOfferings,
} from '../src/countries/country-course-tuition';

/**
 * Hands the country-level tuition figures over to the offerings behind them.
 *
 * Every row that existed before this ran was typed in, and the migration
 * marked all of them overrides so nothing was touched by surprise. This
 * walks them: where a destination's universities actually price the course,
 * the row becomes derived and takes their range; where nothing priced it,
 * the row stays an override and keeps whatever an editor wrote, because a
 * figure from somewhere is better than no figure.
 *
 * Reports the three outcomes rather than a total, because the interesting
 * number is how many mappings had nobody behind them.
 */
function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required to reconcile country tuition');
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
    const mappings = await prisma.countryCourse.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        countryId: true,
        courseId: true,
        indicativeTuitionMin: true,
      },
    });

    let derived = 0;
    let unpriced = 0;
    let mixedCurrency = 0;

    for (const mapping of mappings) {
      const offerings = await prisma.universityCourseOffering.findMany({
        where: liveOfferingsWhere(mapping.countryId, mapping.courseId),
        select: { tuitionMin: true, tuitionMax: true, currencyCode: true },
      });
      const summary = summariseOfferings(offerings);
      if (!summary.offerings) {
        unpriced += 1;
        continue;
      }
      if (!summary.min && !summary.max) {
        mixedCurrency += 1;
        continue;
      }
      await prisma.countryCourse.update({
        where: { id: mapping.id },
        data: {
          tuitionIsOverride: false,
          indicativeTuitionMin: summary.min,
          indicativeTuitionMax: summary.max,
          ...(summary.currencyCode
            ? { currencyCode: summary.currencyCode }
            : {}),
        },
      });
      derived += 1;
    }

    console.log(`country-course mappings read : ${mappings.length}`);
    console.log(`now derived from offerings   : ${derived}`);
    console.log(`left as an editor's figure   : ${unpriced}`);
    console.log(`  (no priced offering behind them)`);
    console.log(`skipped, mixed currencies    : ${mixedCurrency}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
