import 'reflect-metadata';
import { CountryFieldPagesController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * GET /country-field-pages: every /study-abroad/<country>/<subject> and
 * /study-abroad/<country>/<subject>/<specialization> page the sitemap may
 * list, and how many programmes each has. A pair is listed where the
 * destination links the field or teaches it; all of it published, every
 * slug one the router can open. The programmes are counted in one grouped
 * read for the whole catalogue.
 */

const at = (iso: string) => new Date(`2026-10-${iso}Z`);
type Row = Record<string, any>;

function fixture() {
  return {
    countries: [
      { id: 'jp', slug: 'japan', updatedAt: at('01T00:00:00') },
      { id: 'de', slug: 'germany', updatedAt: at('02T00:00:00') },
      /* Hand-typed: no page can be opened at it. */
      { id: 'bad', slug: 'Bad Slug', updatedAt: at('01T00:00:00') },
    ],
    subjects: [
      { id: 'cs', slug: 'computer-science', updatedAt: at('03T00:00:00') },
      { id: 'eng', slug: 'engineering', updatedAt: at('01T00:00:00') },
      /* A fixed page under every destination. */
      { id: 'res', slug: 'universities', updatedAt: at('01T00:00:00') },
    ],
    specializations: [
      {
        id: 'ai',
        slug: 'artificial-intelligence',
        subjectId: 'cs',
        updatedAt: at('04T00:00:00'),
      },
      {
        id: 'civil',
        slug: 'civil-engineering',
        subjectId: 'eng',
        updatedAt: at('01T00:00:00'),
      },
    ],
    subjectLinks: [
      { countryId: 'jp', subjectId: 'cs' },
      { countryId: 'jp', subjectId: 'eng' },
      { countryId: 'jp', subjectId: 'res' },
      { countryId: 'bad', subjectId: 'cs' },
    ],
    specializationLinks: [{ countryId: 'jp', subSubjectId: 'civil' }],
    /* Live programmes, per university and course. */
    offerings: [
      {
        universityId: 'tokyo',
        genericCourseId: 'msc-ai',
        _count: { _all: 2 },
        _max: { updatedAt: at('10T00:00:00') },
      },
      {
        universityId: 'kyoto',
        genericCourseId: 'bsc-cs',
        _count: { _all: 1 },
        _max: { updatedAt: at('05T00:00:00') },
      },
      /* Taught in Germany with no link there. */
      {
        universityId: 'tum',
        genericCourseId: 'msc-ai',
        _count: { _all: 3 },
        _max: { updatedAt: at('06T00:00:00') },
      },
      /* A university the router cannot open is not counted. */
      {
        universityId: 'hand-typed',
        genericCourseId: 'bsc-cs',
        _count: { _all: 9 },
        _max: { updatedAt: at('11T00:00:00') },
      },
    ],
    universities: [
      { id: 'tokyo', slug: 'university-of-tokyo', countryId: 'jp' },
      { id: 'kyoto', slug: 'kyoto-university', countryId: 'jp' },
      { id: 'tum', slug: 'tum', countryId: 'de' },
      { id: 'hand-typed', slug: 'Hand Typed', countryId: 'jp' },
    ],
    courses: [
      { id: 'msc-ai', subjectId: 'cs', subSubjectId: 'ai' },
      { id: 'bsc-cs', subjectId: 'cs', subSubjectId: null },
    ],
  };
}

/* A Prisma `where` read against one record: plain fields equal, a nested
   object against the related record, OR any of its parts. */
function matches(where: Row, record: Row | null): boolean {
  if (!record) return false;
  return Object.entries(where).every(([key, value]) =>
    key === 'OR'
      ? (value as Row[]).some((part) => matches(part, record))
      : value !== null && typeof value === 'object'
        ? matches(value as Row, record[key] as Row | null)
        : record[key] === value,
  );
}

function prisma(data: ReturnType<typeof fixture>, calls: Row[]) {
  const read =
    (name: string, rows: unknown[]) =>
    async (args: Row): Promise<unknown> => {
      calls.push({ name, args });
      return rows;
    };
  return {
    country: { findMany: read('country.findMany', data.countries) },
    subject: { findMany: read('subject.findMany', data.subjects) },
    subSubject: {
      findMany: read('subSubject.findMany', data.specializations),
    },
    countrySubject: {
      findMany: read('countrySubject.findMany', data.subjectLinks),
    },
    countrySubSubject: {
      findMany: read('countrySubSubject.findMany', data.specializationLinks),
    },
    universityCourseOffering: {
      groupBy: read('offering.groupBy', data.offerings),
    },
    university: { findMany: read('university.findMany', data.universities) },
    course: { findMany: read('course.findMany', data.courses) },
  } as unknown as PrismaService;
}

describe('the country field pages', () => {
  it('lists the linked and the taught pairs, with their programmes', async () => {
    const result = await new SubjectsService(
      prisma(fixture(), []),
    ).publicCountryFieldPages();
    expect(
      result.data.map((row) => [
        row.countrySlug,
        row.subjectSlug,
        row.specializationSlug,
        row.programmes,
      ]),
    ).toEqual([
      /* Taught there, though Germany never linked the field. */
      ['germany', 'computer-science', null, 3],
      ['germany', 'computer-science', 'artificial-intelligence', 3],
      /* A specialization's programmes count for its subject's page too. */
      ['japan', 'computer-science', null, 3],
      ['japan', 'computer-science', 'artificial-intelligence', 2],
      /* Linked with nothing taught yet. */
      ['japan', 'engineering', null, 0],
      ['japan', 'engineering', 'civil-engineering', 0],
    ]);
    expect(result.total).toBe(6);
  });

  it('dates each page by the latest of its country, its field and its programmes', async () => {
    const { data } = await new SubjectsService(
      prisma(fixture(), []),
    ).publicCountryFieldPages();
    const date = (country: string, subject: string, spec: string | null) =>
      data.find(
        (row) =>
          row.countrySlug === country &&
          row.subjectSlug === subject &&
          row.specializationSlug === spec,
      )?.updatedAt;
    expect(date('japan', 'computer-science', null)).toBe(
      '2026-10-10T00:00:00.000Z',
    );
    expect(date('japan', 'engineering', null)).toBe('2026-10-01T00:00:00.000Z');
    expect(date('germany', 'computer-science', 'artificial-intelligence')).toBe(
      '2026-10-06T00:00:00.000Z',
    );
  });

  it('reads published records only, and live programmes at live universities', async () => {
    const calls: Row[] = [];
    await new SubjectsService(
      prisma(fixture(), calls),
    ).publicCountryFieldPages();
    const where = (name: string) =>
      calls.find((call) => call.name === name)?.args.where;
    const published = { status: 'PUBLISHED', deletedAt: null };
    /* A destination as the public country reads open it: under no region
       or under an active one. */
    const liveCountry = {
      ...published,
      OR: [
        { continentId: null },
        { continent: { status: 'ACTIVE', deletedAt: null } },
      ],
    };
    expect(where('country.findMany')).toEqual(liveCountry);
    expect(where('subject.findMany')).toEqual(published);
    expect(where('subSubject.findMany')).toEqual({
      ...published,
      subject: published,
    });
    expect(where('countrySubject.findMany')).toEqual({
      country: liveCountry,
      subject: published,
    });
    expect(where('countrySubSubject.findMany')).toEqual({
      country: liveCountry,
      subSubject: { ...published, subject: published },
    });
    const offerings = where('offering.groupBy');
    expect(offerings).toMatchObject({
      ...published,
      university: { ...published, country: liveCountry },
      genericCourse: { subject: published },
    });
    /* Inside its publishing window, as the programme finder reads it. */
    expect(offerings.AND).toHaveLength(2);
    expect(offerings.university.AND).toHaveLength(2);
  });

  /* A published country can sit under a region an editor archived or
     deleted. The public country reads hide it, so its page and every field
     page under it answer 404; the sitemap must not list them. */
  it('leaves out a destination under an archived or deleted region', async () => {
    const data = fixture();
    const regions: Record<string, Row> = {
      asia: { status: 'ACTIVE', deletedAt: null },
      archived: { status: 'INACTIVE', deletedAt: null },
      deleted: { status: 'ACTIVE', deletedAt: at('01T00:00:00') },
    };
    const countries: Row[] = [
      { id: 'jp', slug: 'japan', continentId: null },
      { id: 'de', slug: 'germany', continentId: 'asia' },
      { id: 'kr', slug: 'south-korea', continentId: 'archived' },
      { id: 'sg', slug: 'singapore', continentId: 'deleted' },
    ].map((row) => ({
      ...row,
      status: 'PUBLISHED',
      deletedAt: null,
      updatedAt: at('01T00:00:00'),
      continent: row.continentId ? regions[row.continentId] : null,
    }));
    data.countries = countries.map(({ id, slug, updatedAt }) => ({
      id,
      slug,
      updatedAt,
    }));
    data.subjectLinks = countries.map((row) => ({
      countryId: row.id,
      subjectId: 'eng',
    }));
    data.specializationLinks = countries.map((row) => ({
      countryId: row.id,
      subSubjectId: 'civil',
    }));
    data.universities = countries.map((row) => ({
      id: `uni-${row.id}`,
      slug: `uni-${row.id}`,
      countryId: row.id,
    }));
    data.offerings = countries.map((row) => ({
      universityId: `uni-${row.id}`,
      genericCourseId: 'msc-ai',
      _count: { _all: 1 },
      _max: { updatedAt: at('02T00:00:00') },
    }));
    /* Each read keeps the rows its country condition lets through, as the
       database does. */
    const country = (id: string) => countries.find((row) => row.id === id)!;
    const university = (id: string) =>
      data.universities.find((row) => row.id === id)!;
    const db = prisma(data, []) as unknown as Record<string, Row>;
    db.country.findMany = async (args: { where: Row }) =>
      data.countries.filter((row) => matches(args.where, country(row.id)));
    db.countrySubject.findMany = async (args: { where: { country: Row } }) =>
      data.subjectLinks.filter((row) =>
        matches(args.where.country, country(row.countryId)),
      );
    db.countrySubSubject.findMany = async (args: { where: { country: Row } }) =>
      data.specializationLinks.filter((row) =>
        matches(args.where.country, country(row.countryId)),
      );
    db.universityCourseOffering.groupBy = async (args: {
      where: { university: { country: Row } };
    }) =>
      data.offerings.filter((row) =>
        matches(
          args.where.university.country,
          country(university(row.universityId).countryId),
        ),
      );
    const result = await new SubjectsService(
      db as unknown as PrismaService,
    ).publicCountryFieldPages();
    expect([...new Set(result.data.map((row) => row.countrySlug))]).toEqual([
      'germany',
      'japan',
    ]);
    expect(result.total).toBe(8);
  });

  it('asks a fixed number of reads, however large the catalogue', async () => {
    const calls: Row[] = [];
    const data = fixture();
    for (let index = 0; index < 50; index += 1)
      data.offerings.push({
        universityId: 'tokyo',
        genericCourseId: 'bsc-cs',
        _count: { _all: 1 },
        _max: { updatedAt: at('01T00:00:00') },
      });
    await new SubjectsService(prisma(data, calls)).publicCountryFieldPages();
    expect(calls).toHaveLength(8);
  });

  it('stops at 5000 pages, keeping the ones with programmes', async () => {
    const data = fixture();
    data.countries = Array.from({ length: 5001 }, (_, index) => ({
      id: `c${index}`,
      slug: `country-${String(index).padStart(4, '0')}`,
      updatedAt: at('01T00:00:00'),
    }));
    data.subjectLinks = data.countries.map((country) => ({
      countryId: country.id,
      subjectId: 'eng',
    }));
    data.specializationLinks = [];
    /* The one taught pair sorts last by address. */
    data.universities = [
      { id: 'tokyo', slug: 'university-of-tokyo', countryId: 'c5000' },
    ];
    data.offerings = [data.offerings[1]];
    data.offerings[0].universityId = 'tokyo';
    const result = await new SubjectsService(
      prisma(data, []),
    ).publicCountryFieldPages();
    expect(result.total).toBe(5002);
    expect(result.data).toHaveLength(5000);
    expect(
      result.data.find((row) => row.subjectSlug === 'computer-science'),
    ).toMatchObject({ countrySlug: 'country-5000', programmes: 1 });
    /* Still in address order. */
    expect(result.data[0].countrySlug).toBe('country-0000');
  });

  it('is served at a path of its own', () => {
    expect(Reflect.getMetadata('path', CountryFieldPagesController)).toBe(
      'country-field-pages',
    );
  });
});
