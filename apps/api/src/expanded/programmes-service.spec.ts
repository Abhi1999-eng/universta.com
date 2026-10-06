import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * The course finder's reads, against a database that only records what it
 * was asked.
 *
 * A programme is listed only while it, its university and its university's
 * destination are all live -- the rule a course page's neighbours always
 * kept -- and its "with scholarships" flag counts only awards that are
 * live, not drafts or ones whose window has closed. The list is read once
 * in a light shape and only the page's rows are read in full.
 */

type Args = Record<string, any>;

const warwick = {
  name: 'University of Warwick',
  slug: 'university-of-warwick',
  country: {
    name: 'United Kingdom',
    slug: 'united-kingdom',
    iso2Code: 'GB',
    workProfile: { postStudyWorkAvailable: true },
  },
  campuses: [{ city: 'Coventry', cityRef: null }],
};

const scanned = (over: Record<string, unknown>) => ({
  id: 'o-msc',
  name: 'MSc Computer Science',
  slug: 'university-of-warwick-msc-computer-science',
  courseCode: null,
  studyMode: 'FULL_TIME',
  durationMin: null,
  durationMax: null,
  durationUnit: null,
  tuitionMin: null,
  tuitionMax: null,
  currencyCode: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01'),
  courseLevel: { code: 'PG', name: "Master's", educationOrder: 6 },
  campus: null,
  genericCourse: null,
  intakes: [],
  requirements: [],
  university: warwick,
  _count: { scholarships: 0 },
  ...over,
});

/* The catalogue's own records, which a choice nothing is listed under is
   named from: only published ones are answered, as the read asks. */
const records: Record<string, Array<Record<string, unknown>>> = {
  country: [{ name: 'Hong Kong', slug: 'hong-kong', iso2Code: 'HK' }],
  subject: [{ name: 'Law', slug: 'law' }],
  course: [{ name: 'BA Law', slug: 'ba-law-15' }],
};

function build(rows: Array<Record<string, unknown>>) {
  const findMany: Args[] = [];
  const named: Record<string, Args[]> = {
    country: [],
    subject: [],
    course: [],
  };
  const lookup = (kind: string) => ({
    findMany: async (args: Args) => {
      named[kind].push(args);
      const slugs = args.where.slug.in as string[];
      return records[kind].filter((row) => slugs.includes(row.slug as string));
    },
  });
  const prisma = {
    courseLevel: {
      findMany: async () => [{ code: 'UG' }, { code: 'PG' }],
    },
    studyMode: {
      findMany: async () => [{ code: 'FULL_TIME' }, { code: 'PART_TIME' }],
    },
    country: lookup('country'),
    subject: lookup('subject'),
    course: lookup('course'),
    universityCourseOffering: {
      findMany: async (args: Args) => {
        findMany.push(args);
        /* The page's full read asks by id; the scan asks by the live rule. */
        const ids = args.where?.id?.in as string[] | undefined;
        return ids
          ? rows.filter((row) => ids.includes(row.id as string))
          : rows;
      },
    },
  } as unknown as PrismaService;
  return {
    service: new ExpandedService(prisma, {} as ExperimentsService),
    findMany,
    named,
  };
}

describe('the programme finder’s reads', () => {
  it('asks only for live programmes at live universities in published destinations', async () => {
    const { service, findMany } = build([scanned({})]);
    await service.programmes({});
    const scan = findMany[0];
    expect(scan.where).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      university: {
        status: 'PUBLISHED',
        deletedAt: null,
        country: { status: 'PUBLISHED', deletedAt: null },
      },
    });
    /* Inside the publishing windows of both, not only by status. */
    expect(scan.where.AND).toHaveLength(2);
    expect(scan.where.university.AND).toHaveLength(2);
  });

  it('counts only live scholarships, in the scan and in the cards', async () => {
    const { service, findMany } = build([scanned({})]);
    await service.programmes({});
    for (const args of findMany) {
      const count = (args.select ?? args.include)._count.select.scholarships;
      expect(count.where.scholarship).toMatchObject({
        status: 'PUBLISHED',
        deletedAt: null,
      });
      expect(count.where.scholarship.AND).toHaveLength(2);
    }
  });

  it('flags scholarships from that count, so a draft award flags nothing', async () => {
    const { service } = build([
      scanned({ id: 'o-a', slug: 'a', _count: { scholarships: 0 } }),
      scanned({ id: 'o-b', slug: 'b', _count: { scholarships: 1 } }),
    ]);
    const result = await service.programmes({ scholarship: 'true' });
    expect(result.data.map((row) => row.id)).toEqual(['o-b']);
    expect(result.facets.extras).toContainEqual({
      value: 'scholarship',
      label: 'With scholarships',
      count: 1,
    });
  });

  it('reads the page’s rows in full, in the list’s order, and no more', async () => {
    const { service, findMany } = build([
      scanned({ id: 'o-b', slug: 'b', name: 'B' }),
      scanned({ id: 'o-a', slug: 'a', name: 'A' }),
      scanned({ id: 'o-c', slug: 'c', name: 'C' }),
    ]);
    const result = await service.programmes({ limit: '2' });
    expect(result.data.map((row) => row.id)).toEqual(['o-a', 'o-b']);
    expect(result.meta).toMatchObject({ total: 3, limit: 2, totalPages: 2 });
    const full = findMany.find((args) => args.where?.id);
    expect(full?.where.id.in).toEqual(['o-a', 'o-b']);
    expect(full?.omit).toEqual({ overview: true });
  });

  it('narrows the read by destination and leaves a hand-typed slug out', async () => {
    const { service, findMany } = build([
      scanned({}),
      scanned({ id: 'o-x', slug: 'Not A Slug' }),
    ]);
    const result = await service.programmes({ country: 'united-kingdom' });
    expect(findMany[0].where.university.country).toMatchObject({
      status: 'PUBLISHED',
      slug: { in: ['united-kingdom'] },
    });
    expect(result.meta.total).toBe(1);
    expect(result.summary).toEqual({
      programmes: 1,
      universities: 1,
      cities: 1,
      intakeMonths: 0,
      countries: 1,
    });
  });

  it('says what it left out and which order it applied', async () => {
    const { service } = build([scanned({})]);
    const result = await service.programmes({ sort: 'fee', level: 'nope' });
    expect(result.meta.sort).toBe('relevance');
    expect(result.meta.ignored).toEqual(['level=nope', 'sort=fee']);
  });

  /* "NOPE ×" over an empty list, before; now the catalogue's study-mode
     codes decide, as its level codes do. */
  it('leaves out a study mode the catalogue has no code for', async () => {
    const { service } = build([
      scanned({}),
      scanned({ id: 'o-p', slug: 'p', studyMode: 'PART_TIME' }),
    ]);
    const odd = await service.programmes({ studyMode: 'nope' });
    expect(odd.meta.total).toBe(2);
    expect(odd.meta.ignored).toEqual(['studyMode=nope']);
    const part = await service.programmes({ study_mode: 'part-time' });
    expect(part.data.map((row) => row.id)).toEqual(['o-p']);
    expect(part.meta.ignored).toEqual([]);
  });

  /* A card links "Course guide" to the generic course's own page, which
     answers only a published course under a published subject at an
     active level; the card is read with all three, so it can leave the
     link out when the guide would answer 404. */
  it('reads with each card the state its course guide is answered on', async () => {
    const { service, findMany } = build([scanned({})]);
    await service.programmes({});
    const full = findMany.find((args) => args.where?.id);
    const generic = full?.include.genericCourse.select;
    expect(generic).toMatchObject({ status: true, deletedAt: true });
    expect(generic.subject.select).toMatchObject({
      status: true,
      deletedAt: true,
    });
    /* The whole level, its status with it. */
    expect(generic.courseLevel).toBe(true);
  });

  /* A destination or a course nothing is listed under is named from the
     catalogue, so its chip reads "Hong Kong" and "BA Law", not the slug. */
  it('names a chosen destination, subject or course nothing is listed under', async () => {
    const { service, named } = build([scanned({})]);
    const result = await service.programmes({
      country: 'hong-kong,atlantis',
      subject: 'law',
      course: 'ba-law-15',
    });
    expect(result.meta.total).toBe(0);
    expect(result.facets.countries).toContainEqual({
      value: 'hong-kong',
      label: 'Hong Kong',
      iso2Code: 'HK',
      count: 0,
    });
    expect(result.facets.subjects).toEqual([
      { value: 'law', label: 'Law', count: 0 },
    ]);
    expect(result.facets.courses).toEqual([
      { value: 'ba-law-15', label: 'BA Law', count: 0 },
    ]);
    /* Only published records, asked for by the slugs nothing named. */
    expect(named.country[0].where).toEqual({
      slug: { in: ['hong-kong', 'atlantis'] },
      status: 'PUBLISHED',
      deletedAt: null,
    });
    expect(named.course[0].where.slug).toEqual({ in: ['ba-law-15'] });
    /* A list whose choices the counts already name asks nothing more. */
    const plain = build([scanned({})]);
    await plain.service.programmes({ country: 'united-kingdom' });
    expect(plain.named.country).toHaveLength(0);
    expect(plain.named.subject).toHaveLength(0);
    expect(plain.named.course).toHaveLength(0);
  });
});
