import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../api/src/generated/prisma/client';
import {
  acceptanceContinentName,
  acceptanceCountryName,
  acceptanceEmailSuffix,
  acceptanceRunId,
  acceptanceSlugPrefix,
  acceptanceTextPrefix,
} from './acceptance-run';

/** Test-only cleanup for the records an acceptance run creates.
 *
 * This is Playwright infrastructure, not application code: it is never
 * imported by the API or either Next app, and `no-production-import.test.ts`
 * fails if that ever changes.
 *
 * Two properties make it safe to point at a database:
 *
 *  1. **Run ownership.** Every predicate anchors on a marker containing this
 *     run's own id -- `startsWith` a run-scoped prefix, or `endsWith` a
 *     run-scoped email suffix. It never searches for a substring inside a
 *     value. A record from a different run, and a real record that merely
 *     contains similar text, are both left alone. This matters beyond
 *     tidiness: `contains: 'example.invalid'` would delete a genuine enquiry
 *     from someone whose address happened to include that string.
 *  2. **A local-only hard guard.** `assertLocalDatabase` refuses any
 *     non-loopback DATABASE_URL, so even a correct predicate cannot run
 *     against a hosted database.
 *
 * Nothing here is scoped by ids collected during the test, so cleanup works
 * identically after a run that crashed half-way through.
 *
 * The admin API's delete is a soft delete, which is correct for real content
 * but leaves the row behind. Repeated runs would then accumulate rows forever,
 * which is what previously inflated the public listings. Cleanup therefore
 * removes owned rows outright, in dependency order. */

/** The private-use ISO 3166 range (QA-QZ), which impersonates no real country.
 *
 * `iso2Code` used to be DB-unique across every row ever written, so a soft
 * delete burned a code permanently. With only 26 available, repeated runs
 * exhausted the range and the spec then failed with "every QA-QZ ISO code is
 * already taken locally" -- which read like a product bug and was not one.
 * Uniqueness is now scoped to live rows, so archived fixtures no longer consume
 * the range; this reclaim stays because leaving them behind still grows the
 * table without bound.
 *
 * This is the one predicate that cannot carry a run id, because the column is
 * two characters wide. It is therefore additionally constrained to rows that
 * are already soft-deleted, so a country an admin is genuinely working on is
 * never touched. */
const PRIVATE_USE_ISO2 = /^Q[A-Z]$/;

/** Rejects any database that is not on this machine.
 *
 * Exported so the guard itself is testable: it is the last line of defence if
 * a cleanup helper is ever run with the wrong environment loaded. */
export function assertLocalDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is required for acceptance cleanup');
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      'Acceptance cleanup refuses to run against a non-local database',
    );
  }
  return url;
}

function client() {
  const url = assertLocalDatabase(process.env.DATABASE_URL);
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
}

/** The predicates identifying rows owned by `runId`. Built in one place so the
 * count and the purge can never drift apart. */
export function acceptanceOwnership(runId: string = acceptanceRunId()) {
  return {
    runId,
    slug: { startsWith: acceptanceSlugPrefix(runId) },
    text: { startsWith: acceptanceTextPrefix(runId) },
    email: { endsWith: acceptanceEmailSuffix(runId) },
    continentName: acceptanceContinentName(runId),
    countryName: acceptanceCountryName(runId),
  };
}

export type AcceptanceCounts = Record<string, number>;

/** Counts rows owned by `runId` that are still present, soft-deleted included. */
export async function countAcceptanceRecords(
  runId: string = acceptanceRunId(),
): Promise<AcceptanceCounts> {
  const prisma = client();
  const own = acceptanceOwnership(runId);
  const { slug, text, email } = own;
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
    const browserContinents = await prisma.continent.count({
      where: { name: { startsWith: own.continentName } },
    });
    const browserCountries = await prisma.country.count({
      where: {
        OR: [{ name: { startsWith: own.countryName } }, { slug: own.slug }],
      },
    });
    const testInquiries = await prisma.contactInquiry.count({
      where: { email },
    });
    const testLeads = await prisma.lead.count({ where: { email } });
    const testClaims = await prisma.universityClaimRequest.count({
      where: { workEmail: email },
    });
    return {
      testInquiries,
      testLeads,
      testClaims,
      browserContinents,
      browserCountries,
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

/** Removes every row owned by `runId`. Safe to call repeatedly, and safe after
 * a run that failed part-way through, since each delete is scoped by the run
 * marker rather than by ids collected during the test. */
export async function purgeAcceptanceRecords(
  runId: string = acceptanceRunId(),
): Promise<AcceptanceCounts> {
  const prisma = client();
  const own = acceptanceOwnership(runId);
  const { slug, text, email } = own;
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

    // Enquiries, leads and claims from this run. Children first: notes and
    // status history reference their lead/claim, and an inquiry references the
    // lead it was converted into.
    const testLeadIds = (
      await prisma.lead.findMany({ where: { email }, select: { id: true } })
    ).map((row) => row.id);
    const testClaimIds = (
      await prisma.universityClaimRequest.findMany({
        where: { workEmail: email },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (testLeadIds.length) {
      await prisma.leadNote.deleteMany({
        where: { leadId: { in: testLeadIds } },
      });
      await prisma.leadStatusHistory.deleteMany({
        where: { leadId: { in: testLeadIds } },
      });
      // Clear the back-reference before deleting the lead, so an inquiry from
      // another run that was converted into this run's lead is detached rather
      // than blocked or cascaded away.
      await prisma.contactInquiry.updateMany({
        where: { convertedLeadId: { in: testLeadIds } },
        data: { convertedLeadId: null },
      });
    }
    if (testClaimIds.length) {
      await prisma.universityClaimNote.deleteMany({
        where: { claimId: { in: testClaimIds } },
      });
      await prisma.universityClaimStatusHistory.deleteMany({
        where: { claimId: { in: testClaimIds } },
      });
    }
    removed.testInquiries = (
      await prisma.contactInquiry.deleteMany({ where: { email } })
    ).count;
    removed.testLeads = testLeadIds.length
      ? (await prisma.lead.deleteMany({ where: { id: { in: testLeadIds } } }))
          .count
      : 0;
    removed.testClaims = testClaimIds.length
      ? (
          await prisma.universityClaimRequest.deleteMany({
            where: { id: { in: testClaimIds } },
          })
        ).count
      : 0;

    // The catalog spec's location fixtures. Countries go first because they
    // reference a continent. Canonical-name Country tests own their records
    // through the run-scoped slug; their visible names must remain real names
    // so Country Admin can derive ISO identity from local metadata.
    // `startsWith`, not an exact match: a test may append a per-invocation
    // suffix (repeat/retry index) to keep its fixtures unique across repeated
    // runs of the same test. The run id is still inside the prefix, so this
    // stays strictly run-owned -- it just no longer leaks the suffixed rows,
    // which an exact match silently left behind.
    removed.browserCountries = (
      await prisma.country.deleteMany({
        where: {
          OR: [{ name: { startsWith: own.countryName } }, { slug: own.slug }],
        },
      })
    ).count;
    removed.browserContinents = (
      await prisma.continent.deleteMany({
        where: { name: { startsWith: own.continentName } },
      })
    ).count;

    // Free the private-use ISO codes this run consumed. Restricted to
    // soft-deleted rows, since the column is too narrow to carry a run id.
    const burned = await prisma.country.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, iso2Code: true },
    });
    const reclaim = burned.filter((row) =>
      PRIVATE_USE_ISO2.test(row.iso2Code ?? ''),
    );
    removed.privateUseCountries = reclaim.length
      ? (
          await prisma.country.deleteMany({
            where: { id: { in: reclaim.map((row) => row.id) } },
          })
        ).count
      : 0;
    return removed;
  } finally {
    await prisma.$disconnect();
  }
}
