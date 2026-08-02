import { ConflictException } from '@nestjs/common';
import { MediaService } from './media.service';
import type { PrismaService } from '../prisma/prisma.service';

/** ISS-021. `archive()` unlinks a media file from disk the moment its usage
 * count reads zero, so every relation this check does not know about is a
 * guaranteed silent break, not a race: the referencing record's `xxxMediaId`
 * still points at the (now-fileless) asset row, the Media Library reported
 * it as "not in use" right up until the delete, and there is nothing in that
 * UI to say why the image is now broken.
 *
 * The fix widens `usageCount` from the nine relations it originally checked
 * to every MediaAsset relation the schema defines. Each case below seeds a
 * fake Prisma with exactly one referencing row in exactly one relation,
 * pointed at the asset under test, and confirms `archive()` refuses. A
 * matching row pointed at a *different* asset id is also checked, so a test
 * cannot pass by coincidence of an over-broad `where` clause. */

type Row = Record<string, unknown>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR')
      return (value as Row[]).some((clause) => matches(row, clause));
    if (key === 'AND')
      return (value as Row[]).every((clause) => matches(row, clause));
    if (value === null) return row[key] == null;
    return row[key] === value;
  });
}

function countable(rows: Row[]) {
  return {
    count: async ({ where = {} }: { where?: Row } = {}) =>
      rows.filter((row) => matches(row, where)).length,
  };
}

const MEDIA_ID = 'media-under-test';

/** Every model key `usageCount` queries, defaulting to empty. A test seeds
 * exactly the one it is exercising via `overrides`. */
function fakePrisma(overrides: Partial<Record<string, Row[]>> = {}) {
  const table = (key: string) => countable(overrides[key] ?? []);
  return {
    pageSection: table('pageSection'),
    university: table('university'),
    universityCourseOffering: table('universityCourseOffering'),
    scholarship: table('scholarship'),
    consultantLandingCard: table('consultantLandingCard'),
    consultant: table('consultant'),
    event: table('event'),
    successStory: table('successStory'),
    testimonial: table('testimonial'),
    subject: table('subject'),
    subSubject: table('subSubject'),
    continent: table('continent'),
    country: table('country'),
    countryContentSection: table('countryContentSection'),
    city: table('city'),
    course: table('course'),
    courseContentSection: table('courseContentSection'),
    navigationItem: table('navigationItem'),
    platformMetric: table('platformMetric'),
    seoMetadata: table('seoMetadata'),
    user: table('user'),
    mediaAsset: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; deletedAt: null };
      }) =>
        where.id === MEDIA_ID
          ? {
              id: MEDIA_ID,
              storedFileName: 'test-fixture.png',
              fileSizeBytes: 100n,
              deletedAt: null,
            }
          : null,
      update: async ({ data }: { data: Row }) => ({
        id: MEDIA_ID,
        storedFileName: 'test-fixture.png',
        fileSizeBytes: 100n,
        ...data,
      }),
    },
  } as unknown as PrismaService;
}

/** [label, model key in fakePrisma, row shape with a media FK set to MEDIA_ID] */
const RELATIONS: Array<[string, string, Row]> = [
  [
    'PageSection.mediaId',
    'pageSection',
    { mediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'PageSection.backgroundMediaId',
    'pageSection',
    { backgroundMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'University.featuredMediaId',
    'university',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'UniversityCourseOffering.featuredMediaId',
    'universityCourseOffering',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Scholarship.featuredMediaId',
    'scholarship',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'ConsultantLandingCard.iconMediaId',
    'consultantLandingCard',
    { iconMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'ConsultantLandingCard.featuredMediaId',
    'consultantLandingCard',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  // The Phase 1 catalog's own Consultant model, distinct from the landing
  // card above -- its "Media (optional)" picker was entirely unchecked.
  [
    'Consultant.featuredMediaId',
    'consultant',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Event.featuredMediaId',
    'event',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'SuccessStory.featuredMediaId',
    'successStory',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Testimonial.imageMediaId',
    'testimonial',
    { imageMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Subject.iconMediaId',
    'subject',
    { iconMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Subject.listingMediaId',
    'subject',
    { listingMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Subject.heroMediaId',
    'subject',
    { heroMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'SubSubject.iconMediaId',
    'subSubject',
    { iconMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'SubSubject.listingMediaId',
    'subSubject',
    { listingMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Continent.iconMediaId',
    'continent',
    { iconMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Continent.heroMediaId',
    'continent',
    { heroMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Country.flagMediaId',
    'country',
    { flagMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Country.listingMediaId',
    'country',
    { listingMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'Country.heroMediaId',
    'country',
    { heroMediaId: MEDIA_ID, deletedAt: null },
  ],
  ['Country.mapMediaId', 'country', { mapMediaId: MEDIA_ID, deletedAt: null }],
  [
    'CountryContentSection.primaryMediaId',
    'countryContentSection',
    { primaryMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'CountryContentSection.secondaryMediaId',
    'countryContentSection',
    { secondaryMediaId: MEDIA_ID, deletedAt: null },
  ],
  ['City.heroMediaId', 'city', { heroMediaId: MEDIA_ID, deletedAt: null }],
  [
    'Course.featuredMediaId',
    'course',
    { featuredMediaId: MEDIA_ID, deletedAt: null },
  ],
  [
    'CourseContentSection.mediaId',
    'courseContentSection',
    { mediaId: MEDIA_ID, deletedAt: null },
  ],
  ['NavigationItem.iconMediaId', 'navigationItem', { iconMediaId: MEDIA_ID }],
  ['PlatformMetric.iconMediaId', 'platformMetric', { iconMediaId: MEDIA_ID }],
  ['SeoMetadata.ogMediaId', 'seoMetadata', { ogMediaId: MEDIA_ID }],
  ['SeoMetadata.twitterMediaId', 'seoMetadata', { twitterMediaId: MEDIA_ID }],
  ['User.avatarMediaId', 'user', { avatarMediaId: MEDIA_ID, deletedAt: null }],
];

describe('MediaService.archive — usage check covers every MediaAsset relation', () => {
  it.each(RELATIONS)(
    'refuses to archive when %s references the asset',
    async (_label, modelKey, row) => {
      const prisma = fakePrisma({ [modelKey]: [row] });
      const service = new MediaService(prisma);
      await expect(service.archive(MEDIA_ID)).rejects.toThrow(
        ConflictException,
      );
    },
  );

  it.each(RELATIONS)(
    'is not fooled by a matching row pointed at a different asset (%s)',
    async (_label, modelKey, row) => {
      const otherRow = { ...row };
      for (const key of Object.keys(otherRow)) {
        if (otherRow[key] === MEDIA_ID) otherRow[key] = 'a-different-media-id';
      }
      const prisma = fakePrisma({ [modelKey]: [otherRow] });
      const service = new MediaService(prisma);
      await expect(service.archive(MEDIA_ID)).resolves.toMatchObject({
        id: MEDIA_ID,
      });
    },
  );

  it('respects deletedAt: soft-deleted referencing rows do not block archiving', async () => {
    const prisma = fakePrisma({
      subject: [{ iconMediaId: MEDIA_ID, deletedAt: new Date() }],
      country: [{ flagMediaId: MEDIA_ID, deletedAt: new Date() }],
      consultant: [{ featuredMediaId: MEDIA_ID, deletedAt: new Date() }],
    });
    const service = new MediaService(prisma);
    await expect(service.archive(MEDIA_ID)).resolves.toMatchObject({
      id: MEDIA_ID,
    });
  });

  it('archives cleanly when nothing in the schema references the asset', async () => {
    const service = new MediaService(fakePrisma());
    const result = await service.archive(MEDIA_ID);
    expect(result).toMatchObject({ id: MEDIA_ID, status: 'ARCHIVED' });
  });

  it('names the reference count in the rejection message', async () => {
    const prisma = fakePrisma({
      subject: [{ iconMediaId: MEDIA_ID, deletedAt: null }],
      country: [{ flagMediaId: MEDIA_ID, deletedAt: null }],
    });
    const service = new MediaService(prisma);
    await expect(service.archive(MEDIA_ID)).rejects.toMatchObject({
      response: {
        code: 'MEDIA_IN_USE',
        message: expect.stringContaining('2 records'),
      },
    });
  });
});
