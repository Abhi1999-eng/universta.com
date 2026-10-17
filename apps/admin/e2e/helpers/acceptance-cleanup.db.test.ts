// @vitest-environment node
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../api/src/generated/prisma/client';
import {
  countAcceptanceRecords,
  purgeAcceptanceRecords,
  totalAcceptanceRecords,
} from './acceptance-cleanup';
import {
  acceptanceCountryName,
  acceptanceEmail,
  acceptanceSlugPrefix,
} from './acceptance-run';

/** The predicate tests prove what the filters *mean*; these prove what the
 * database actually does with them. Both matter: a filter can be correct and
 * still delete the wrong rows if it is applied to the wrong table, or if a
 * foreign key cascades further than intended. */

loadEnv({ path: resolve(__dirname, '../../../api/.env'), quiet: true });

const THIS_RUN = 'db1111aaaa11';
const OTHER_RUN = 'db2222bbbb22';

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

/** A genuine-looking enquiry that the old `contains: 'example.invalid'`
 * predicate would have deleted. Nothing in the suite may remove it. */
const BYSTANDER_EMAIL = 'example.invalid.user@gmail.com';

let sequence = 0;
function leadNumber() {
  return `ACCEPT-TEST-${Date.now()}-${sequence++}`;
}

/** LeadNote requires an author. Any existing admin will do -- the note is
 * deleted again by the assertion under test. */
async function anyUserId() {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('the local database must be seeded before this test');
  return user.id;
}

/** University requires a country. Borrowing a seeded one also lets the final
 * assertion prove that country was not collaterally deleted. */
async function anyCountryId() {
  const country = await prisma.country.findFirst({ select: { id: true } });
  if (!country) throw new Error('the local database must be seeded before this test');
  return country.id;
}

async function createInquiry(email: string, name: string) {
  const row = await prisma.contactInquiry.create({
    data: {
      inquiryNumber: `ACCEPT-TEST-${Date.now()}-${sequence++}`,
      fullName: name,
      email,
      message: 'Fictional record created by an automated ownership test.',
      privacyConsent: true,
    },
  });
  created.inquiries.push(row.id);
  return row;
}

async function createLead(email: string, firstName: string) {
  const row = await prisma.lead.create({
    data: {
      leadNumber: leadNumber(),
      formType: 'COUNSELLING',
      firstName,
      email,
      phoneNumber: '+15550000000',
    },
  });
  created.leads.push(row.id);
  return row;
}

async function createUniversity(runId: string, suffix: string) {
  const row = await prisma.university.create({
    data: {
      name: `Acceptance Ownership Test ${runId} ${suffix}`,
      slug: `${acceptanceSlugPrefix(runId)}university-${suffix}`,
      countryId: await anyCountryId(),
    },
  });
  created.universities.push(row.id);
  return row;
}

/** Every row these tests create, registered at the moment of creation rather
 * than by the caller afterwards.
 *
 * The difference is not cosmetic: an earlier version pushed the ids on the line
 * after a group of creates, so when a later create threw, the rows already
 * written were never registered and survived the run -- the very partial-failure
 * leak these tests exist to rule out. */
const created = {
  inquiries: [] as string[],
  leads: [] as string[],
  universities: [] as string[],
};

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required: these tests prove real deletion behaviour and are meaningless without a database',
    );
  }
});

afterAll(async () => {
  await prisma.leadNote.deleteMany({ where: { leadId: { in: created.leads } } });
  await prisma.leadStatusHistory.deleteMany({
    where: { leadId: { in: created.leads } },
  });
  await prisma.contactInquiry.deleteMany({
    where: { id: { in: created.inquiries } },
  });
  await prisma.lead.deleteMany({ where: { id: { in: created.leads } } });
  await prisma.university.deleteMany({
    where: { id: { in: created.universities } },
  });
  await prisma.$disconnect();
});

describe('purgeAcceptanceRecords', () => {
  it('deletes this run’s records and preserves every other row', async () => {
    const mine = await createInquiry(
      acceptanceEmail('contact', THIS_RUN),
      'Owned By This Run',
    );
    const theirs = await createInquiry(
      acceptanceEmail('contact', OTHER_RUN),
      'Owned By Another Run',
    );
    const bystander = await createInquiry(BYSTANDER_EMAIL, 'Genuine Enquirer');
    const myUniversity = await createUniversity(THIS_RUN, 'owned');
    const theirUniversity = await createUniversity(OTHER_RUN, 'foreign');

    const removed = await purgeAcceptanceRecords(THIS_RUN);

    expect(removed.testInquiries).toBe(1);
    expect(removed.universities).toBe(1);
    expect(await prisma.contactInquiry.findUnique({ where: { id: mine.id } }))
      .toBeNull();
    expect(await prisma.university.findUnique({ where: { id: myUniversity.id } }))
      .toBeNull();

    // The two rows that must survive, and the reason each one exists.
    expect(
      await prisma.contactInquiry.findUnique({ where: { id: theirs.id } }),
      'a concurrent run’s enquiry must survive',
    ).not.toBeNull();
    expect(
      await prisma.contactInquiry.findUnique({ where: { id: bystander.id } }),
      'a genuine enquiry containing "example.invalid" must survive',
    ).not.toBeNull();
    expect(
      await prisma.university.findUnique({ where: { id: theirUniversity.id } }),
      'a concurrent run’s catalogue record must survive',
    ).not.toBeNull();
  });

  it('cleans up after a run that failed part-way through', async () => {
    // A crashed run leaves an arbitrary subset behind: here a lead with its
    // child rows and a converted enquiry, but no catalogue records at all.
    // Cleanup is scoped by marker, not by ids gathered during the test, so it
    // has everything it needs to finish the job.
    const lead = await createLead(
      acceptanceEmail('counselling', THIS_RUN),
      'Half Finished Run',
    );
    await prisma.leadNote.create({
      data: {
        leadId: lead.id,
        userId: await anyUserId(),
        note: 'Fictional note from an interrupted run.',
      },
    });
    await prisma.leadStatusHistory.create({
      data: { leadId: lead.id, newStatus: 'NEW' },
    });
    const inquiry = await createInquiry(
      acceptanceEmail('contact-converted', THIS_RUN),
      'Converted Then Crashed',
    );
    await prisma.contactInquiry.update({
      where: { id: inquiry.id },
      data: { convertedLeadId: lead.id },
    });

    const removed = await purgeAcceptanceRecords(THIS_RUN);

    expect({ leads: removed.testLeads, inquiries: removed.testInquiries })
      .toEqual({ leads: 1, inquiries: 1 });
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await prisma.leadNote.count({ where: { leadId: lead.id } })).toBe(0);
    expect(
      await prisma.leadStatusHistory.count({ where: { leadId: lead.id } }),
    ).toBe(0);
  });

  it('clears a subject’s specializations before the subject itself', async () => {
    /* The subject bulk sheet creates specializations from its own column, so
       an acceptance run that imports subjects leaves children behind -- and a
       specialization holds its subject with onDelete: Restrict. Cleanup used
       to stop here with "Foreign key constraint violated on the fields:
       (`subject_id`)", which left the whole Playwright suite unfinished. */
    const subject = await prisma.subject.create({
      data: {
        name: `${acceptanceCountryName(THIS_RUN)} Imported Subject`,
        slug: `${acceptanceSlugPrefix(THIS_RUN)}-imported-subject`,
        status: 'DRAFT',
      },
    });
    const child = await prisma.subSubject.create({
      data: {
        subjectId: subject.id,
        name: 'Imported Specialization',
        slug: 'imported-specialization',
        status: 'DRAFT',
      },
    });

    const removed = await purgeAcceptanceRecords(THIS_RUN);

    expect(removed.browserSubSubjects).toBe(1);
    expect(removed.browserSubjects).toBe(1);
    expect(await prisma.subSubject.findUnique({ where: { id: child.id } })).toBeNull();
    expect(await prisma.subject.findUnique({ where: { id: subject.id } })).toBeNull();
  });

  it('clears a subject’s level pages and their SEO before the subject', async () => {
    /* A level page goes with its subject or specialization by foreign key,
       but its SEO row has none: left to the cascade, the row would outlive
       the page. Another run's page and SEO row must survive the purge. */
    const level = await prisma.courseLevel.findFirst({ select: { id: true } });
    if (!level) throw new Error('the local database must be seeded before this test');
    const makeSubject = (runId: string, suffix: string) =>
      prisma.subject.create({
        data: {
          name: `${acceptanceCountryName(runId)} Level Page Subject`,
          slug: `${acceptanceSlugPrefix(runId)}-level-page-subject-${suffix}`,
          status: 'DRAFT',
        },
      });
    const subject = await makeSubject(THIS_RUN, 'mine');
    const foreign = await makeSubject(OTHER_RUN, 'theirs');
    const child = await prisma.subSubject.create({
      data: { subjectId: subject.id, name: 'Level Page Specialization', slug: 'level-page-specialization', status: 'DRAFT' },
    });
    const subjectPage = await prisma.subjectLevelPage.create({
      data: { subjectId: subject.id, scopeKey: '', courseLevelId: level.id, intro: '<p>Mine.</p>' },
    });
    const childPage = await prisma.subjectLevelPage.create({
      data: { subjectId: subject.id, subSubjectId: child.id, scopeKey: child.id, courseLevelId: level.id, faqs: { create: [{ question: 'Q?', answer: 'A.' }] } },
    });
    const foreignPage = await prisma.subjectLevelPage.create({
      data: { subjectId: foreign.id, scopeKey: '', courseLevelId: level.id },
    });
    const seo = (ownerId: string) =>
      prisma.seoMetadata.create({ data: { ownerType: 'SUBJECT_LEVEL_PAGE', ownerId, seoTitle: 'Level page', metaDescription: 'Level page.' } });
    const mineSeo = await seo(subjectPage.id);
    const childSeo = await seo(childPage.id);
    const foreignSeo = await seo(foreignPage.id);

    try {
      const before = await countAcceptanceRecords(THIS_RUN);
      expect({ pages: before.browserLevelPages, seo: before.browserLevelPageSeo }).toEqual({ pages: 2, seo: 2 });

      const removed = await purgeAcceptanceRecords(THIS_RUN);

      expect({ pages: removed.browserLevelPages, seo: removed.browserLevelPageSeo }).toEqual({ pages: 2, seo: 2 });
      expect(await prisma.subject.findUnique({ where: { id: subject.id } })).toBeNull();
      expect(await prisma.subjectLevelPage.count({ where: { id: { in: [subjectPage.id, childPage.id] } } })).toBe(0);
      expect(await prisma.subjectLevelPageFaq.count({ where: { pageId: childPage.id } })).toBe(0);
      expect(await prisma.seoMetadata.count({ where: { id: { in: [mineSeo.id, childSeo.id] } } })).toBe(0);
      expect(
        await prisma.seoMetadata.findUnique({ where: { id: foreignSeo.id } }),
        'a concurrent run’s level-page SEO must survive',
      ).not.toBeNull();
      expect(await prisma.subjectLevelPage.findUnique({ where: { id: foreignPage.id } })).not.toBeNull();
    } finally {
      // The other run's page goes with its subject.
      await prisma.seoMetadata.deleteMany({ where: { id: foreignSeo.id } });
      await prisma.subject.deleteMany({ where: { id: foreign.id } });
    }
  });

  it('reports zero owned records once cleanup has run', async () => {
    await purgeAcceptanceRecords(THIS_RUN);
    const counts = await countAcceptanceRecords(THIS_RUN);
    expect(totalAcceptanceRecords(counts)).toBe(0);
  });

  it('is safe to run twice', async () => {
    const second = await purgeAcceptanceRecords(THIS_RUN);
    expect(totalAcceptanceRecords(second)).toBe(0);
  });

  it('does not touch the seeded catalogue', async () => {
    const before = await prisma.university.count({ where: { deletedAt: null } });
    await purgeAcceptanceRecords(THIS_RUN);
    expect(await prisma.university.count({ where: { deletedAt: null } })).toBe(
      before,
    );
  });
});
