import { bulkResource } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The public site lists a scholarship or a consultant under a destination
 * only through its country links, which the admin sets from an "Eligible
 * countries" picker. The sheets had no column for them, so an imported
 * record was published and appeared under no destination: the UK's
 * scholarships and consultants pages read 0 after an import. The sheets
 * now carry `countrySlugs`, resolved like the courses sheet's.
 */

const COUNTRIES = [
  { id: 'c-uk', slug: 'uk', name: 'United Kingdom' },
  { id: 'c-ca', slug: 'canada', name: 'Canada' },
];

function client() {
  return {
    scholarshipProvider: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    country: {
      findFirst: async ({ where }: { where: { slug?: string } }) =>
        COUNTRIES.find((row) => row.slug === where.slug) ?? null,
      findMany: async ({ where }: { where: { name?: string } }) =>
        COUNTRIES.filter((row) => row.name === where.name),
    },
  } as unknown as PrismaService;
}

/** A stand-in for a link table inside the row's transaction. */
function links(table: string, existing: string[]) {
  const created: Array<Record<string, unknown>> = [];
  const deleted: Array<Record<string, unknown>> = [];
  return {
    created,
    deleted,
    tx: {
      [table]: {
        findMany: async () => existing.map((countryId) => ({ countryId })),
        createMany: async ({
          data,
        }: {
          data: Array<Record<string, unknown>>;
        }) => {
          created.push(...data);
          return { count: data.length };
        },
        deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
          deleted.push(where);
          return { count: 0 };
        },
      },
    },
  };
}

const scholarships = bulkResource('scholarships');
const consultants = bulkResource('consultants');

describe('the destinations column on a scholarship row', () => {
  it('resolves the countries it names, by slug or by name', async () => {
    const parsed = await scholarships.parseRow(
      { title: 'Chevening Scholarships', countrySlugs: 'uk | Canada' },
      client(),
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.relations).toEqual({ countryIds: ['c-uk', 'c-ca'] });
  });

  it('names a destination it could not find, against that row', async () => {
    const parsed = await scholarships.parseRow(
      { title: 'Somewhere Award', countrySlugs: 'uk | narnia' },
      client(),
    );
    expect(parsed.errors?.join(' ')).toContain('narnia');
    expect(parsed.data).toBeUndefined();
  });

  it('imports a sheet without the column as before, linking nothing', async () => {
    const parsed = await scholarships.parseRow(
      { title: 'Plain Award' },
      client(),
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.relations).toEqual({ countryIds: [] });
    const fake = links('scholarshipCountry', ['c-ca']);
    await scholarships.reconcile?.(fake.tx, 'sch-1', parsed.relations, true);
    expect(fake.created).toEqual([]);
    expect(fake.deleted).toEqual([]);
  });

  it("makes the links exactly the sheet's set: adds the new, drops the rest", async () => {
    const fake = links('scholarshipCountry', ['c-ca', 'c-old']);
    await scholarships.reconcile?.(
      fake.tx,
      'sch-1',
      { countryIds: ['c-uk', 'c-ca'] },
      false,
    );
    expect(fake.created).toEqual([
      { scholarshipId: 'sch-1', countryId: 'c-uk' },
    ]);
    expect(fake.deleted).toEqual([
      { scholarshipId: 'sch-1', countryId: { in: ['c-old'] } },
    ]);
  });

  it('writes the links back out as the sheet spelled them', () => {
    const row = scholarships.toExportRow(
      {
        slug: 'chevening-scholarship',
        title: 'Chevening Scholarships',
        status: 'PUBLISHED',
        countries: [
          { country: { slug: 'uk' } },
          { country: { slug: 'canada' } },
        ],
      },
      {},
    );
    expect(row.countrySlugs).toBe('uk | canada');
  });
});

describe('the destinations column on a consultant row', () => {
  it('links the consultant to the destinations it serves', async () => {
    const parsed = await consultants.parseRow(
      { name: 'Leap Scholar', countrySlugs: 'uk' },
      client(),
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.relations).toEqual({ countryIds: ['c-uk'] });
    const fake = links('consultantCountry', []);
    await consultants.reconcile?.(fake.tx, 'con-1', parsed.relations, true);
    expect(fake.created).toEqual([
      { consultantId: 'con-1', countryId: 'c-uk' },
    ]);
  });

  it('still needs a name, and says so with the destination error', async () => {
    const parsed = await consultants.parseRow(
      { countrySlugs: 'narnia' },
      client(),
    );
    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name is required'),
        expect.stringContaining('narnia'),
      ]),
    );
  });
});
