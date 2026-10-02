import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { reconcileCountryCourses } from '../src/countries/country-course-reconciler';

/**
 * Works out which destinations offer each course, from the offerings their
 * universities publish.
 *
 * The reconcilers that follow this one -- the destination's subjects, and
 * its indicative tuition -- both read the mappings this fills, so it runs
 * first. Everything that existed before was typed in, so the migration
 * marked it EDITORIAL and this leaves all of it alone. What it adds is
 * what the catalogue already said through its offerings and nobody had
 * recorded.
 *
 * The write paths keep this in step on their own now. This stays as the
 * thing that catches what a crash, an import, or a direct database edit
 * left behind -- and on unchanged data it reports zero.
 */
/** Same shape the seeds use; there is no shared module for it. */
function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required to reconcile country courses');
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
    const courses = await prisma.course.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    let added = 0;
    let revived = 0;
    let removed = 0;
    let touched = 0;

    for (const course of courses) {
      const change = await reconcileCountryCourses(prisma, course.id);
      added += change.added;
      revived += change.revived;
      removed += change.removed;
      if (change.added || change.revived || change.removed) touched += 1;
    }

    console.log(`courses read      : ${courses.length}`);
    console.log(`courses changed   : ${touched}`);
    console.log(`mappings added    : ${added}`);
    console.log(`mappings revived  : ${revived}`);
    console.log(`mappings removed  : ${removed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
