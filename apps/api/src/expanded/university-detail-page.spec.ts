import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * What a university's public page needs from its record.
 *
 * The page says which city the university is in, names the specialization
 * each of its courses belongs to, and closes with three more universities
 * from the same country, best ranked first. The record carried the campus
 * city only as typed text, never the specialization, and no other
 * university at all -- and the public listing cannot sort by ranking, so
 * the page could not pick the three itself without reading a whole country.
 */

const university = {
  id: 'u-oxford',
  countryId: 'c-uk',
  name: 'University of Oxford',
  slug: 'university-of-oxford',
};

function service(
  others: Array<Record<string, unknown>> = [],
  total = others.length,
) {
  const detailArgs: Array<Record<string, unknown>> = [];
  const listArgs: Array<Record<string, unknown>> = [];
  const countArgs: Array<Record<string, unknown>> = [];
  const prisma = {
    university: {
      findFirst: async (args: Record<string, unknown>) => {
        detailArgs.push(args);
        return university;
      },
      findMany: async (args: Record<string, unknown>) => {
        listArgs.push(args);
        return others;
      },
      count: async (args: Record<string, unknown>) => {
        countArgs.push(args);
        return total;
      },
    },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
  return {
    svc: new ExpandedService(prisma, {} as ExperimentsService),
    detailArgs,
    listArgs,
    countArgs,
  };
}

type Include = {
  campuses: { include?: Record<string, unknown> };
  offerings: {
    include: { genericCourse: { include: Record<string, unknown> } };
  };
};

describe('a university’s public record', () => {
  it('brings each course’s specialization along with its subject and level', async () => {
    const { svc, detailArgs } = service();
    await svc.detail('universities', 'university-of-oxford');
    const include = detailArgs[0]?.include as Include;
    expect(include.offerings.include.genericCourse.include).toEqual({
      subject: true,
      subSubject: true,
      courseLevel: true,
    });
  });

  it('names the city a campus was picked from, not only the city typed on it', async () => {
    const { svc, detailArgs } = service();
    await svc.detail('universities', 'university-of-oxford');
    const include = detailArgs[0]?.include as Include;
    expect(include.campuses.include).toEqual({
      cityRef: { select: { name: true, slug: true } },
    });
  });
});

describe('other universities in the same country', () => {
  const row = (slug: string) => ({ id: slug, slug, name: slug });

  it('asks for published universities in its country, leaving itself out', async () => {
    const { svc, listArgs, countArgs } = service();
    await svc.detail('universities', 'university-of-oxford');
    const where = listArgs[0]?.where as Record<string, unknown>;
    expect(where.countryId).toBe('c-uk');
    expect(where.id).toEqual({ not: 'u-oxford' });
    expect(where.status).toBe('PUBLISHED');
    expect(countArgs[0]?.where).toEqual(where);
  });

  it('orders them best ranked first, the unranked after them A to Z', async () => {
    const { svc, listArgs } = service();
    await svc.detail('universities', 'university-of-oxford');
    expect(listArgs[0]?.orderBy).toEqual([
      { qsRanking: { sort: 'asc', nulls: 'last' } },
      { name: 'asc' },
    ]);
  });

  it('returns three, and how many there are in all', async () => {
    const { svc } = service(
      ['cambridge', 'imperial', 'ucl', 'edinburgh'].map(row),
      13,
    );
    const record = (await svc.detail(
      'universities',
      'university-of-oxford',
    )) as unknown as {
      otherUniversities: { total: number; data: Array<{ slug: string }> };
    };
    expect(record.otherUniversities.total).toBe(13);
    expect(record.otherUniversities.data.map((other) => other.slug)).toEqual([
      'cambridge',
      'imperial',
      'ucl',
    ]);
  });

  it('skips a hand-typed slug the router cannot reach, as the listing does', async () => {
    const { svc } = service([row('Bad Slug'), row('cambridge')]);
    const record = (await svc.detail(
      'universities',
      'university-of-oxford',
    )) as unknown as { otherUniversities: { data: Array<{ slug: string }> } };
    expect(record.otherUniversities.data.map((other) => other.slug)).toEqual([
      'cambridge',
    ]);
  });

  it('carries each one’s city and its published course count for the card', async () => {
    const { svc, listArgs } = service();
    await svc.detail('universities', 'university-of-oxford');
    const select = listArgs[0]?.select as Record<string, unknown>;
    expect(select).toMatchObject({
      name: true,
      slug: true,
      qsRanking: true,
      campuses: expect.objectContaining({
        select: { city: true, cityRef: { select: { name: true } } },
      }),
      _count: expect.anything(),
    });
  });
});
