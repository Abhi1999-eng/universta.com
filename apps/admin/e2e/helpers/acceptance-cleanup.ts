import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../api/src/generated/prisma/client';

/** Test-only cleanup for the records the structured-CRUD acceptance spec
 * creates.
 *
 * This is Playwright infrastructure, not application code: it is never
 * imported by the API or either Next app, and it only ever touches rows whose
 * slug (or quote, for testimonials, which have no slug) carries the
 * unmistakable acceptance-owned marker below. Deterministic demo-seed records
 * do not carry it and are never matched.
 *
 * The admin API's delete is a soft delete, which is correct for real content
 * but leaves the row behind. Repeated local runs then accumulate rows forever,
 * which is what previously inflated the public listings. Cleanup therefore
 * removes the rows outright, in dependency order. */

export const ACCEPTANCE_SLUG_MARKER = 'acceptance-demo-';
export const ACCEPTANCE_TEXT_MARKER = 'Acceptance Demo ';

function client() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for acceptance cleanup');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    // Belt and braces: this deletes rows, so refuse to run anywhere but local.
    throw new Error('Acceptance cleanup refuses to run against a non-local database');
  }
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

export type AcceptanceCounts = Record<string, number>;

/** Counts acceptance-owned rows still present, including soft-deleted ones. */
export async function countAcceptanceRecords(): Promise<AcceptanceCounts> {
  const prisma = client();
  const slug = { contains: ACCEPTANCE_SLUG_MARKER };
  const text = { contains: ACCEPTANCE_TEXT_MARKER };
  try {
    const [
      universities,
      offerings,
      scholarships,
      consultants,
      jobs,
      events,
      successStories,
      testimonials,
    ] = await Promise.all([
      prisma.university.count({ where: { slug } }),
      prisma.universityCourseOffering.count({ where: { slug } }),
      prisma.scholarship.count({ where: { slug } }),
      prisma.consultant.count({ where: { slug } }),
      prisma.job.count({ where: { slug } }),
      prisma.event.count({ where: { slug } }),
      prisma.successStory.count({ where: { slug } }),
      prisma.testimonial.count({ where: { quote: text } }),
    ]);
    return {
      universities,
      offerings,
      scholarships,
      consultants,
      jobs,
      events,
      successStories,
      testimonials,
    };
  } finally {
    await prisma.$disconnect();
  }
}

export function totalAcceptanceRecords(counts: AcceptanceCounts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

/** Removes every acceptance-owned row. Safe to call repeatedly and safe to
 * call when a run failed part-way through, since each delete is scoped by the
 * marker rather than by ids collected during the test. */
export async function purgeAcceptanceRecords(): Promise<AcceptanceCounts> {
  const prisma = client();
  const slug = { contains: ACCEPTANCE_SLUG_MARKER };
  const text = { contains: ACCEPTANCE_TEXT_MARKER };
  try {
    const removed: AcceptanceCounts = {};
    // Children before parents: offerings reference universities.
    removed.offerings = (
      await prisma.universityCourseOffering.deleteMany({ where: { slug } })
    ).count;
    removed.scholarships = (
      await prisma.scholarship.deleteMany({ where: { slug } })
    ).count;
    removed.consultants = (
      await prisma.consultant.deleteMany({ where: { slug } })
    ).count;
    removed.jobs = (await prisma.job.deleteMany({ where: { slug } })).count;
    removed.events = (await prisma.event.deleteMany({ where: { slug } })).count;
    removed.successStories = (
      await prisma.successStory.deleteMany({ where: { slug } })
    ).count;
    removed.testimonials = (
      await prisma.testimonial.deleteMany({ where: { quote: text } })
    ).count;
    removed.universities = (
      await prisma.university.deleteMany({ where: { slug } })
    ).count;
    return removed;
  } finally {
    await prisma.$disconnect();
  }
}
