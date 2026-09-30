/**
 * Folds the demo seed's near-duplicate subjects into the catalogue's own.
 *
 * Two seeds wrote the same fields of study under different slugs --
 * `business-management` beside `business-and-management`,
 * `creative-arts-design` beside `design-and-creative-arts` -- so a database
 * that had run both listed each of them twice on the public subject index,
 * once with six specializations and once with none. The seeds now agree
 * (see demo-seed.ts), which stops it recurring; this repairs the databases
 * that already have both.
 *
 * Everything the loser owns moves to the winner first -- its
 * specializations, its courses, its country links, the leads and student
 * profiles that named it -- and only then is the loser deleted, so nothing
 * is lost and no foreign key is left dangling. Re-running it is a no-op:
 * once a loser is gone there is nothing left to match.
 *
 *   npm run db:merge:duplicate-subjects --workspace apps/api
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { Prisma } from '../src/generated/prisma/client';
import { PrismaClient } from '../src/generated/prisma/client';

/** loser slug -> winner slug. The winner is the one with the real content. */
const SUBJECT_MERGES: Array<[string, string]> = [
  ['business-management', 'business-and-management'],
  ['health-medicine', 'health-and-medicine'],
  ['creative-arts-design', 'design-and-creative-arts'],
];

/**
 * Specializations that survived as duplicates inside a single subject,
 * as `subject slug` -> [loser slug, winner slug]. "Electrical Engineering"
 * and "Electrical and Electronic Engineering" are the same specialization
 * under two names; only one of them ever had courses.
 */
const SPECIALIZATION_MERGES: Array<[string, string, string]> = [
  ['engineering', 'electrical-engineering', 'electrical-and-electronic-engineering'],
  [
    'design-and-creative-arts',
    'graphic-design',
    'graphic-and-communication-design',
  ],
  [
    'design-and-creative-arts',
    'user-experience-design',
    'interaction-and-user-experience-design',
  ],
];

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required to merge subjects');
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

type Db = Prisma.TransactionClient;

/**
 * Moves one specialization's courses and country links onto another and
 * removes the empty one. Both must already belong to the same subject.
 */
async function mergeSpecialization(db: Db, loserId: string, winnerId: string) {
  await db.course.updateMany({
    where: { subSubjectId: loserId },
    data: { subSubjectId: winnerId },
  });

  /* `country_sub_subjects` is unique on (country, specialization), so a
     country that listed both would collide. Take only the links the winner
     does not already have, then drop the rest with the loser. */
  const [loserLinks, winnerLinks] = await Promise.all([
    db.countrySubSubject.findMany({ where: { subSubjectId: loserId } }),
    db.countrySubSubject.findMany({ where: { subSubjectId: winnerId } }),
  ]);
  const alreadyLinked = new Set(winnerLinks.map((row) => row.countryId));
  for (const link of loserLinks) {
    if (alreadyLinked.has(link.countryId)) continue;
    await db.countrySubSubject.update({
      where: { id: link.id },
      data: { subSubjectId: winnerId },
    });
  }
  await db.countrySubSubject.deleteMany({ where: { subSubjectId: loserId } });
  await db.subSubject.delete({ where: { id: loserId } });
}

async function mergeSubject(db: Db, loserSlug: string, winnerSlug: string) {
  const [loser, winner] = await Promise.all([
    db.subject.findUnique({
      where: { slug: loserSlug },
      include: { subSubjects: true },
    }),
    db.subject.findUnique({
      where: { slug: winnerSlug },
      include: { subSubjects: true },
    }),
  ]);
  if (!loser) return `${loserSlug}: nothing to merge`;
  if (!winner) return `${loserSlug}: no ${winnerSlug} to merge into -- skipped`;

  const winnerSpecBySlug = new Map(
    winner.subSubjects.map((row) => [row.slug, row]),
  );
  for (const spec of loser.subSubjects) {
    const twin = winnerSpecBySlug.get(spec.slug);
    if (twin) {
      await mergeSpecialization(db, spec.id, twin.id);
      continue;
    }
    /* No twin, so the specialization itself moves across. A name is unique
       within a subject too, so a clash on either column has to be settled
       before the move -- suffixing the loser's is enough and visible. */
    const clash = winner.subSubjects.find((row) => row.name === spec.name);
    await db.subSubject.update({
      where: { id: spec.id },
      data: {
        subjectId: winner.id,
        ...(clash ? { name: `${spec.name} (${loser.name})` } : {}),
      },
    });
  }

  await db.course.updateMany({
    where: { subjectId: loser.id },
    data: { subjectId: winner.id },
  });

  const [loserLinks, winnerLinks] = await Promise.all([
    db.countrySubject.findMany({ where: { subjectId: loser.id } }),
    db.countrySubject.findMany({ where: { subjectId: winner.id } }),
  ]);
  const alreadyLinked = new Set(winnerLinks.map((row) => row.countryId));
  for (const link of loserLinks) {
    if (alreadyLinked.has(link.countryId)) continue;
    await db.countrySubject.update({
      where: { id: link.id },
      data: { subjectId: winner.id },
    });
  }
  await db.countrySubject.deleteMany({ where: { subjectId: loser.id } });

  await db.lead.updateMany({
    where: { preferredSubjectId: loser.id },
    data: { preferredSubjectId: winner.id },
  });
  await db.studentProfile.updateMany({
    where: { preferredSubjectId: loser.id },
    data: { preferredSubjectId: winner.id },
  });

  await db.subject.delete({ where: { id: loser.id } });
  return `${loserSlug} -> ${winnerSlug}: merged ${loser.subSubjects.length} specialization(s)`;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseConfig()),
  });
  try {
    for (const [loser, winner] of SUBJECT_MERGES) {
      /* One subject at a time, each in its own transaction: a half-merged
         subject is worse than an unmerged one, and the interactive timeout
         has to cover a catalogue's worth of rows. */
      const message = await prisma.$transaction(
        (tx) => mergeSubject(tx, loser, winner),
        { timeout: 120_000 },
      );
      console.log(message);
    }

    for (const [subjectSlug, loserSlug, winnerSlug] of SPECIALIZATION_MERGES) {
      const subject = await prisma.subject.findUnique({
        where: { slug: subjectSlug },
        include: { subSubjects: true },
      });
      if (!subject) {
        console.log(`${subjectSlug}: no such subject -- skipped`);
        continue;
      }
      const loser = subject.subSubjects.find((row) => row.slug === loserSlug);
      const winner = subject.subSubjects.find((row) => row.slug === winnerSlug);
      if (!loser) {
        console.log(`${subjectSlug}/${loserSlug}: nothing to merge`);
        continue;
      }
      if (!winner) {
        console.log(
          `${subjectSlug}/${loserSlug}: no ${winnerSlug} to merge into -- skipped`,
        );
        continue;
      }
      await prisma.$transaction(
        (tx) => mergeSpecialization(tx, loser.id, winner.id),
        { timeout: 120_000 },
      );
      console.log(`${subjectSlug}: ${loserSlug} -> ${winnerSlug}: merged`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
