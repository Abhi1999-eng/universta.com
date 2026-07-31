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
/** The catalog spec creates a Country using an ISO 3166 private-use code
 * (QA-QZ / QAX-QZX), which impersonates no real country.
 *
 * Those columns are DB-unique and ignore `deletedAt`, so the admin API's soft
 * delete permanently burns a code. With only 26 available, repeated local runs
 * exhaust the range and the spec then fails with "every QA-QZ ISO code is
 * already taken locally" -- which reads like a product bug and is not one.
 * Hard-removing them here is what keeps repeated runs viable. */
const PRIVATE_USE_ISO2 = /^Q[A-Z]$/;
/** The catalog spec also creates a Continent and a Country named
 * "Browser Region E2E <timestamp>" / "Browser Country E2E <timestamp>".
 *
 * These were not covered before, and unlike the catalogue records they are not
 * soft-deleted by the spec -- so every run left a continent behind, and those
 * continents render as destination tabs on the public Countries page. A client
 * demo showing "Browser Region E2E 1785472873911" as a study destination is
 * exactly the kind of leak this cleanup exists to prevent. */
export const BROWSER_FIXTURE_MARKER = 'E2E ';
const BROWSER_CONTINENT_PREFIX = 'Browser Region ';
const BROWSER_COUNTRY_PREFIX = 'Browser Country ';
/** Enquiries, leads and claims submitted by automated or manual UAT runs.
 *
 * Matched on the reserved `.invalid` TLD (RFC 2606), which is guaranteed never
 * to belong to a real person -- so this can never delete a genuine enquiry. A
 * demo that opens the Leads screen and shows two dozen
 * "Manual UAT Contact 1785477575150" rows undermines the whole pitch. */
const TEST_EMAIL_DOMAIN = 'example.invalid';

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
    const browserContinents = await prisma.continent.count({
      where: { name: { startsWith: BROWSER_CONTINENT_PREFIX } },
    });
    const browserCountries = await prisma.country.count({
      where: { name: { startsWith: BROWSER_COUNTRY_PREFIX } },
    });
    const testInquiries = await prisma.contactInquiry.count({
      where: { email: { contains: TEST_EMAIL_DOMAIN } },
    });
    const testLeads = await prisma.lead.count({
      where: { email: { contains: TEST_EMAIL_DOMAIN } },
    });
    const testClaims = await prisma.universityClaimRequest.count({
      where: { workEmail: { contains: TEST_EMAIL_DOMAIN } },
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
    // Enquiries, leads and claims from test runs. Children first: notes and
    // status history reference their lead/claim, and an inquiry references the
    // lead it was converted into.
    const testLeadIds = (
      await prisma.lead.findMany({
        where: { email: { contains: TEST_EMAIL_DOMAIN } },
        select: { id: true },
      })
    ).map((row) => row.id);
    const testClaimIds = (
      await prisma.universityClaimRequest.findMany({
        where: { workEmail: { contains: TEST_EMAIL_DOMAIN } },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (testLeadIds.length) {
      await prisma.leadNote.deleteMany({ where: { leadId: { in: testLeadIds } } });
      await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: testLeadIds } } });
      await prisma.contactInquiry.updateMany({
        where: { convertedLeadId: { in: testLeadIds } },
        data: { convertedLeadId: null },
      });
    }
    if (testClaimIds.length) {
      await prisma.universityClaimNote.deleteMany({ where: { claimId: { in: testClaimIds } } });
      await prisma.universityClaimStatusHistory.deleteMany({
        where: { claimId: { in: testClaimIds } },
      });
    }
    removed.testInquiries = (
      await prisma.contactInquiry.deleteMany({
        where: { email: { contains: TEST_EMAIL_DOMAIN } },
      })
    ).count;
    removed.testLeads = testLeadIds.length
      ? (await prisma.lead.deleteMany({ where: { id: { in: testLeadIds } } })).count
      : 0;
    removed.testClaims = testClaimIds.length
      ? (
          await prisma.universityClaimRequest.deleteMany({
            where: { id: { in: testClaimIds } },
          })
        ).count
      : 0;

    // The catalog spec's continent/country fixtures. Countries go first
    // because they reference a continent.
    removed.browserCountries = (
      await prisma.country.deleteMany({
        where: { name: { startsWith: BROWSER_COUNTRY_PREFIX } },
      })
    ).count;
    removed.browserContinents = (
      await prisma.continent.deleteMany({
        where: { name: { startsWith: BROWSER_CONTINENT_PREFIX } },
      })
    ).count;
    // Free the private-use ISO codes the catalog spec consumes. Scoped to
    // soft-deleted rows only, so a country an admin is genuinely working on is
    // never touched.
    const burned = await prisma.country.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, iso2Code: true },
    });
    const reclaim = burned.filter((row) => PRIVATE_USE_ISO2.test(row.iso2Code ?? ''));
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
