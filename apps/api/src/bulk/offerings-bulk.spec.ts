import type { PrismaService } from '../prisma/prisma.service';
import { bulkResource } from './bulk-resources';
import {
  exportOfferingDetails,
  offeringRelationsChanged,
  parseOfferingDetails,
  reconcileOfferingDetails,
  type OfferingRelations,
} from './offerings-bulk';

const january = { id: 'jan', slug: 'january', name: 'January', startMonth: 1 };
const september = {
  id: 'sep',
  slug: 'september',
  name: 'September',
  startMonth: 9,
};
function client() {
  return {
    intake: {
      findUnique: jest.fn(
        async ({ where }: { where: { slug?: string; name?: string } }) =>
          [january, september].find(
            (row) => where.slug === row.slug || where.name === row.name,
          ) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { startMonth: number } }) =>
        [january, september].filter(
          (row) => row.startMonth === where.startMonth,
        ),
      ),
    },
    university: {
      findFirst: jest.fn().mockResolvedValue({ id: 'uni', slug: 'demo' }),
    },
    course: {
      findFirst: jest.fn().mockResolvedValue({ id: 'course', slug: 'msc' }),
    },
    universityCourseIntake: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    universityCourseRequirement: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}
function asPrisma(value: ReturnType<typeof client>) {
  return value as unknown as PrismaService;
}
const ielts = {
  category: 'ENGLISH_TEST',
  title: 'IELTS',
  minimumScore: 6.5,
  description: null,
};

describe('Whole offerings in bulk sheets', () => {
  it('keeps absent optional scalar columns and blank relation columns untouched', async () => {
    const prisma = client();
    const errors: string[] = [];
    const details = await parseOfferingDetails(
      { intakes: '', ieltsMinimum: '', academicRequirement: '' },
      asPrisma(prisma),
      errors,
    );
    expect(errors).toEqual([]);
    expect(details).toEqual({ data: {}, relations: { requirements: [] } });
    await reconcileOfferingDetails(
      asPrisma(prisma),
      'offering',
      details.relations,
    );
    expect(prisma.intake.findUnique).not.toHaveBeenCalled();
    expect(prisma.universityCourseIntake.deleteMany).not.toHaveBeenCalled();
    expect(prisma.universityCourseRequirement.findMany).not.toHaveBeenCalled();
  });

  it('imports a legacy row without inserting new fields into its scalar update', async () => {
    const parsed = await bulkResource('offerings').parseRow(
      { name: 'MSc Demo', universitySlug: 'demo', genericCourseSlug: 'msc' },
      asPrisma(client()),
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.data).not.toHaveProperty('durationMin');
    expect(parsed.data).not.toHaveProperty('courseCode');
    expect(parsed.relations).toEqual({
      genericCourseId: 'course',
      requirements: [],
    });
  });

  it.each(['Infinity', '-1', '10000000000', '1.234', 'abc'])(
    'rejects malformed or out-of-range tuition %s',
    async (value) => {
      const result = await bulkResource('offerings').parseRow(
        {
          name: 'MSc Demo',
          universitySlug: 'demo',
          genericCourseSlug: 'msc',
          tuitionMin: value,
        },
        asPrisma(client()),
      );
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/tuitionMin must be a number/),
        ]),
      );
    },
  );

  it('parses scalars, valid leap days, durations in weeks and all three test scores', async () => {
    const errors: string[] = [];
    const details = await parseOfferingDetails(
      {
        courseCode: ' DS01 ',
        shortDescription: ' A course. ',
        overview: 'Overview.',
        durationMin: '18',
        durationMax: '24',
        durationUnit: 'WEEKS',
        tuitionPeriod: 'PER_MONTH',
        applicationUrl: 'https://example.edu/course',
        sourceReference: 'https://example.edu/course',
        verifiedAt: '2028-02-29',
        ieltsMinimum: '6.5',
        toeflMinimum: '90',
        pteMinimum: '65',
        academicRequirement: 'A relevant degree.',
      },
      asPrisma(client()),
      errors,
    );
    expect(errors).toEqual([]);
    expect(details.data).toMatchObject({
      courseCode: 'DS01',
      durationMin: 18,
      durationMax: 24,
      durationUnit: 'WEEKS',
      tuitionPeriod: 'PER_MONTH',
      verifiedAt: new Date('2028-02-29T00:00:00Z'),
    });
    expect(details.relations.requirements).toEqual([
      ielts,
      { ...ielts, title: 'TOEFL', minimumScore: 90 },
      { ...ielts, title: 'PTE', minimumScore: 65 },
      {
        category: 'ACADEMIC',
        title: 'Academic entry requirement',
        minimumScore: null,
        description: 'A relevant degree.',
      },
    ]);
  });

  it.each([
    ['durationMin', 'Infinity', /durationMin must be a number/],
    ['durationMax', '-1', /durationMax must be a number/],
    ['durationMin', '10000', /durationMin must be a number/],
    ['ieltsMinimum', '9.5', /ieltsMinimum must be a number/],
    ['toeflMinimum', '121', /toeflMinimum must be a number/],
    ['pteMinimum', '91', /pteMinimum must be a number/],
    ['ieltsMinimum', 'six', /ieltsMinimum must be a number/],
    ['durationUnit', 'DAYS', /durationUnit must be one of/],
    ['tuitionPeriod', 'ANNUAL', /tuitionPeriod must be one of/],
    ['verifiedAt', '2027-02-29', /verifiedAt must be a valid date/],
    ['verifiedAt', '2026-1-1', /verifiedAt must be a valid date/],
    ['intakes', '9:2027-02-30', /intakes deadline.*must be a valid date/],
    ['intakes', '13', /intakes month.*must be from 1 to 12/],
    ['intakes', 'autumn', /intakes entry.*was not found/],
    ['intakes', '9:', /must be a month or intake slug/],
    ['intakes', '9:2027-01-01:extra', /must be a month or intake slug/],
  ])('rejects %s=%s with a useful row error', async (key, value, expected) => {
    const errors: string[] = [];
    await parseOfferingDetails({ [key]: value }, asPrisma(client()), errors);
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(expected)]),
    );
  });

  it('rejects reversed duration ranges', async () => {
    const errors: string[] = [];
    await parseOfferingDetails(
      { durationMin: '3', durationMax: '1' },
      asPrisma(client()),
      errors,
    );
    expect(errors).toContain(
      'durationMax must be greater than or equal to durationMin',
    );
  });

  it('resolves slug, then name, then a month and deduplicates equal entries', async () => {
    const prisma = client();
    const errors: string[] = [];
    const parsed = await parseOfferingDetails(
      { intakes: 'september:2027-01-15;September:2027-01-15;9:2027-01-15;1' },
      asPrisma(prisma),
      errors,
    );
    expect(errors).toEqual([]);
    expect(parsed.relations.intakes).toEqual([
      { intakeId: 'sep', deadline: new Date('2027-01-15T00:00:00Z') },
      { intakeId: 'jan', deadline: null },
    ]);
    expect(prisma.intake.findUnique.mock.calls.slice(0, 3)).toEqual([
      [{ where: { slug: 'september' } }],
      [{ where: { slug: 'September' } }],
      [{ where: { name: 'September' } }],
    ]);
  });

  it('rejects duplicate intake references with different deadlines', async () => {
    const errors: string[] = [];
    await parseOfferingDetails(
      { intakes: 'september:2027-01-15;9' },
      asPrisma(client()),
      errors,
    );
    expect(errors).toEqual(['intakes entry "9" has conflicting deadlines']);
  });

  it('makes nonblank intakes exactly the selected active set', async () => {
    const prisma = client();
    const relations: OfferingRelations = {
      intakes: [{ intakeId: 'sep', deadline: null }],
      requirements: [],
    };
    await reconcileOfferingDetails(asPrisma(prisma), 'offering', relations);
    expect(prisma.universityCourseIntake.deleteMany).toHaveBeenCalledWith({
      where: { offeringId: 'offering', intakeId: { notIn: ['sep'] } },
    });
    expect(prisma.universityCourseIntake.upsert).toHaveBeenCalledWith({
      where: {
        offeringId_intakeId: { offeringId: 'offering', intakeId: 'sep' },
      },
      create: {
        offeringId: 'offering',
        intakeId: 'sep',
        deadline: null,
        status: 'ACTIVE',
      },
      update: { deadline: null, status: 'ACTIVE' },
    });
  });

  it('updates an existing test and removes duplicates without deleting other requirements', async () => {
    const prisma = client();
    prisma.universityCourseRequirement.findMany.mockResolvedValue([
      {
        id: 'first',
        category: 'ENGLISH_TEST',
        title: 'IELTS Academic',
        deletedAt: null,
      },
      {
        id: 'duplicate',
        category: 'ENGLISH_TEST',
        title: 'IELTS overall',
        deletedAt: null,
      },
      {
        id: 'other',
        category: 'ACADEMIC',
        title: 'Portfolio',
        deletedAt: null,
      },
    ]);
    await reconcileOfferingDetails(asPrisma(prisma), 'offering', {
      requirements: [ielts],
    });
    expect(prisma.universityCourseRequirement.create).not.toHaveBeenCalled();
    expect(prisma.universityCourseRequirement.update).toHaveBeenCalledWith({
      where: { id: 'first' },
      data: { ...ielts, status: 'ACTIVE', deletedAt: null },
    });
    expect(prisma.universityCourseRequirement.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['duplicate'] } },
    });
  });

  it('gives each imported test its own row when an old title names two tests', async () => {
    const prisma = client();
    prisma.universityCourseRequirement.findMany.mockResolvedValue([
      {
        id: 'combined',
        category: 'ENGLISH_TEST',
        title: 'IELTS or TOEFL',
        deletedAt: null,
      },
    ]);
    const toefl = { ...ielts, title: 'TOEFL', minimumScore: 90 };
    await reconcileOfferingDetails(asPrisma(prisma), 'offering', {
      requirements: [ielts, toefl],
    });
    expect(prisma.universityCourseRequirement.update).toHaveBeenCalledTimes(1);
    expect(prisma.universityCourseRequirement.update).toHaveBeenCalledWith({
      where: { id: 'combined' },
      data: { ...ielts, status: 'ACTIVE', deletedAt: null },
    });
    expect(prisma.universityCourseRequirement.create).toHaveBeenCalledWith({
      data: {
        offeringId: 'offering',
        ...toefl,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    expect(
      prisma.universityCourseRequirement.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('detects stale inactive relations even when the exported columns match', async () => {
    const prisma = client();
    prisma.universityCourseIntake.findMany.mockResolvedValue([
      { intakeId: 'sep', deadline: null, status: 'INACTIVE' },
    ]);
    expect(
      await offeringRelationsChanged(asPrisma(prisma), 'offering', {
        intakes: [{ intakeId: 'sep', deadline: null }],
        requirements: [],
      }),
    ).toBe(true);
    prisma.universityCourseIntake.findMany.mockResolvedValue([
      { intakeId: 'sep', deadline: null, status: 'ACTIVE' },
    ]);
    prisma.universityCourseRequirement.findMany.mockResolvedValue([
      { ...ielts, status: 'ACTIVE', deletedAt: null },
    ]);
    expect(
      await offeringRelationsChanged(asPrisma(prisma), 'offering', {
        intakes: [{ intakeId: 'sep', deadline: null }],
        requirements: [ielts],
      }),
    ).toBe(false);
  });

  it('exports active intake months and deadlines, scalar fields and test minimums', () => {
    expect(
      exportOfferingDetails({
        durationMin: '1',
        durationUnit: 'YEARS',
        verifiedAt: new Date('2026-10-06'),
        intakes: [
          {
            status: 'ACTIVE',
            intake: september,
            deadline: new Date('2027-01-15'),
          },
          { status: 'ACTIVE', intake: january, deadline: null },
          { status: 'INACTIVE', intake: january, deadline: null },
        ],
        requirements: [
          { ...ielts, minimumScore: '6.5', status: 'ACTIVE', deletedAt: null },
        ],
      }),
    ).toMatchObject({
      durationMin: '1',
      durationUnit: 'YEARS',
      verifiedAt: '2026-10-06',
      intakes: '1;9:2027-01-15',
      ieltsMinimum: '6.5',
      academicRequirement: '',
    });
  });
});
