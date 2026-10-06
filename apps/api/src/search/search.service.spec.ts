import { SearchService } from './search.service';

/**
 * One search across the catalogue.
 *
 * The box said it searched "countries, courses, universities, scholarships"
 * and was wired to the course listing, so "Denmark" found the courses called
 * Denmark -- none. What matters here is that a word reaches every kind of
 * record, that the kinds stay apart, and that the row a reader meant is the
 * row at the top.
 */

type Rows = {
  countries?: unknown[];
  subjects?: unknown[];
  courses?: unknown[];
  programmes?: unknown[];
  universities?: unknown[];
  scholarships?: unknown[];
};

function build(rows: Rows = {}) {
  const prisma = {
    country: { findMany: jest.fn().mockResolvedValue(rows.countries ?? []) },
    subject: { findMany: jest.fn().mockResolvedValue(rows.subjects ?? []) },
    course: { findMany: jest.fn().mockResolvedValue(rows.courses ?? []) },
    universityCourseOffering: {
      findMany: jest.fn().mockResolvedValue(rows.programmes ?? []),
    },
    university: {
      findMany: jest.fn().mockResolvedValue(rows.universities ?? []),
    },
    scholarship: {
      findMany: jest.fn().mockResolvedValue(rows.scholarships ?? []),
    },
  };
  return {
    prisma,
    service: new SearchService(prisma as never),
  };
}

const country = (name: string, slug = name.toLowerCase()) => ({
  id: name,
  name,
  slug,
  iso2Code: null,
  continent: { name: 'Europe' },
});

describe('catalogue search', () => {
  it('reaches every kind of record from one word', async () => {
    const { service } = build({
      countries: [country('Denmark', 'denmark')],
      universities: [
        {
          id: 'u1',
          name: 'Technical University of Denmark',
          slug: 'dtu',
          country: { name: 'Denmark' },
        },
      ],
    });

    const results = await service.search('Denmark');

    expect(results.groups.map((group) => group.type)).toEqual([
      'country',
      'university',
    ]);
    expect(results.total).toBe(2);
  });

  /* A country's guide lives at /study-abroad, not at /countries: the listing
     there redirects, and a suggestion that redirects is a suggestion that
     flickers. */
  it('points a country at its guide', async () => {
    const { service } = build({ countries: [country('Denmark', 'denmark')] });
    const [group] = (await service.search('Denmark')).groups;
    expect(group.items[0].href).toBe('/study-abroad/denmark');
  });

  /* "Denmark" before "New Zealand and Denmark": a row that opens with what
     was typed is what the reader meant; one that merely contains it is a
     maybe. */
  it('puts what the query opens before what merely contains it', async () => {
    const { service } = build({
      countries: [
        country('New Denmark Territory', 'new-denmark'),
        country('Denmark', 'denmark'),
      ],
    });
    const [group] = (await service.search('Denmark')).groups;
    expect(group.items.map((item) => item.label)).toEqual([
      'Denmark',
      'New Denmark Territory',
    ]);
  });

  /* Two letters match half the catalogue and say nothing about what the
     reader wants, so nothing is asked of the database at all. */
  it('asks nothing of the database for a query too short to mean anything', async () => {
    const { prisma, service } = build({ countries: [country('Denmark')] });
    const results = await service.search('de');
    expect(results).toEqual({ query: 'de', total: 0, groups: [] });
    expect(prisma.country.findMany).not.toHaveBeenCalled();
  });

  it('reads a query padded with spaces as the word inside it', async () => {
    const { prisma, service } = build({ countries: [country('Denmark')] });
    await service.search('  Denmark  ');
    expect(prisma.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { contains: 'Denmark' } }),
      }),
    );
  });

  /* A draft country is a country nobody can open yet. */
  it('asks only for published records', async () => {
    const { prisma, service } = build();
    await service.search('Denmark');
    for (const delegate of Object.values(prisma))
      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PUBLISHED',
            deletedAt: null,
          }),
        }),
      );
  });

  /* A programme -- a course at one university -- is what the course
     finder lists, so the search offers them under their own heading, each
     opening its page under its country, and "all" opens the finder on the
     same word. The course guides' "all" keeps the word too. */
  it('offers programmes, each at its own address, and keeps the word in "all"', async () => {
    const { prisma, service } = build({
      courses: [
        {
          id: 'c1',
          name: 'MSc Computer Science',
          slug: 'msc-cs',
          subject: null,
        },
      ],
      programmes: [
        {
          id: 'o1',
          name: 'MSc Computer Science',
          slug: 'warwick-msc-cs',
          university: {
            name: 'University of Warwick',
            slug: 'university-of-warwick',
            country: { slug: 'united-kingdom' },
          },
        },
      ],
    });
    const results = await service.search('Computer Science');
    expect(results.groups.map((group) => group.type)).toEqual([
      'course',
      'programme',
    ]);
    const [courses, programmes] = results.groups;
    expect(courses.href).toBe('/courses?view=guides&q=Computer+Science');
    expect(programmes.label).toBe('Programmes');
    expect(programmes.href).toBe('/courses?q=Computer+Science');
    expect(programmes.items[0]).toEqual({
      id: 'o1',
      label: 'MSc Computer Science',
      href: '/study-abroad/united-kingdom/universities/university-of-warwick/courses/warwick-msc-cs',
      meta: 'University of Warwick',
    });
    /* Only live programmes, at live universities in published countries. */
    expect(prisma.universityCourseOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          university: expect.objectContaining({
            status: 'PUBLISHED',
            country: { status: 'PUBLISHED', deletedAt: null },
          }),
        }),
      }),
    );
  });

  it('leaves out a kind that matched nothing', async () => {
    const { service } = build({
      subjects: [{ id: 's1', name: 'Computer Science', slug: 'cs' }],
    });
    const results = await service.search('Computer');
    expect(results.groups).toHaveLength(1);
    expect(results.groups[0].type).toBe('subject');
  });

  /* The dropdown shows a handful per heading; the results page asks for more
     of the same rows rather than a different search. */
  it('shows no more per heading than it was asked for', async () => {
    const { service } = build({
      countries: Array.from({ length: 12 }, (_, i) => country(`Denmark ${i}`)),
    });
    const [group] = (await service.search('Denmark', 3)).groups;
    expect(group.items).toHaveLength(3);
  });
});
