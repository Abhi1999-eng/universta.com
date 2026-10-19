import { ExpandedService, eventDateWhere } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * The public events and careers lists, read through a fake database that
 * applies the `where` the service builds -- so these say which records a
 * visitor gets, not how the query happens to be spelt.
 */

type Row = Record<string, unknown>;

/** Enough of Prisma's filter language for these lists. */
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND')
      return (condition as Row[]).every((part) => matches(row, part));
    if (key === 'OR')
      return (condition as Row[]).some((part) => matches(row, part));
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date)
      return value instanceof Date && value.getTime() === condition.getTime();
    if (typeof condition !== 'object') return value === condition;
    const ops = condition as Row;
    const comparable = (input: unknown) =>
      input instanceof Date ? input.getTime() : (input as number | string);
    if (['gte', 'gt', 'lte', 'lt'].some((op) => op in ops)) {
      if (value === null || value === undefined) return false;
      const left = comparable(value);
      return Object.entries(ops).every(([op, target]) => {
        const right = comparable(target);
        if (op === 'gte') return left >= right;
        if (op === 'gt') return left > right;
        if (op === 'lte') return left <= right;
        if (op === 'lt') return left < right;
        return true;
      });
    }
    return value && typeof value === 'object'
      ? matches(value as Row, ops)
      : false;
  });
}

const NOW = new Date('2026-10-19T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
const live = {
  status: 'PUBLISHED',
  deletedAt: null,
  publishStartsAt: null,
  publishEndsAt: null,
  displayOrder: 0,
  featuredMediaId: null,
};

const events: Row[] = [
  {
    ...live,
    id: 'long-ago',
    title: 'Long ago',
    slug: 'long-ago',
    startsAt: new Date('2025-06-10T09:00:00Z'),
    endsAt: new Date('2025-06-10T11:00:00Z'),
  },
  {
    ...live,
    id: 'last-week',
    title: 'Last week',
    slug: 'last-week',
    startsAt: new Date('2026-10-10T09:00:00Z'),
    endsAt: null,
  },
  {
    /* Started half an hour ago, ends in two hours. */
    ...live,
    id: 'happening-now',
    title: 'Happening now',
    slug: 'happening-now',
    startsAt: hours(-0.5),
    endsAt: hours(2),
  },
  {
    ...live,
    id: 'later-this-month',
    title: 'Later this month',
    slug: 'later-this-month',
    startsAt: new Date('2026-10-28T09:00:00Z'),
    endsAt: null,
    featuredMediaId: 'media-1',
    state: { id: 'state-1', name: 'Kanto', slug: 'kanto' },
  },
  {
    ...live,
    id: 'in-december',
    title: 'In December',
    slug: 'in-december',
    startsAt: new Date('2026-12-05T09:00:00Z'),
    endsAt: new Date('2026-12-05T12:00:00Z'),
  },
];

const jobs: Row[] = [
  {
    ...live,
    id: 'closes-today',
    title: 'Closes today',
    slug: 'closes-today',
    expiryDate: new Date('2026-10-19T00:00:00Z'),
    /* The local database has no states, so the row carries the one the
       include would have read. */
    state: { id: 'state-1', name: 'Kanto', slug: 'kanto' },
  },
  {
    ...live,
    id: 'closed-yesterday',
    title: 'Closed yesterday',
    expiryDate: new Date('2026-10-18T00:00:00Z'),
  },
  {
    ...live,
    id: 'no-closing-date',
    title: 'No closing date',
    expiryDate: null,
  },
];

function service() {
  const calls: Row[] = [];
  const table = (rows: Row[]) => ({
    findMany: async (args: { where: Row }) => {
      calls.push(args);
      return rows.filter((row) => matches(row, args.where));
    },
    findFirst: async (args: { where: Row; include?: Row }) => {
      calls.push(args);
      return rows.find((row) => matches(row, args.where)) ?? null;
    },
  });
  const prisma = {
    event: table(events),
    job: table(jobs),
    mediaAsset: {
      findMany: async () => [
        {
          id: 'media-1',
          publicUrl: '/media/fair.jpg',
          altText: 'A fictional fair hall',
          title: 'Fair hall',
        },
      ],
    },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), calls };
}

const ids = (result: { data: Row[] }) => result.data.map((row) => row.id);

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe('the public events list', () => {
  /* EV-C1 and EV-M2. The filter split on the start: an event that began
     half an hour ago was "past", fell off the /courses strip and would
     have landed in the Past events band while still running. */
  it('counts an event that is still running as upcoming, soonest first', async () => {
    const { svc } = service();
    expect(ids(await svc.list('events', { when: 'upcoming' }))).toEqual([
      'happening-now',
      'later-this-month',
      'in-december',
    ]);
  });

  it('lists past events newest first, without the one still running', async () => {
    const { svc } = service();
    const past = ids(await svc.list('events', { when: 'past' }));
    expect(past).toEqual(['last-week', 'long-ago']);
    expect(past).not.toContain('happening-now');
  });

  /* EV-C10. `when`, `from` and `to` each wrote startsAt, and the last one
     silently replaced the others. */
  it('meets when and to together', async () => {
    const { svc } = service();
    expect(
      ids(await svc.list('events', { when: 'upcoming', to: '2026-11-30' })),
    ).toEqual(['happening-now', 'later-this-month']);
  });

  it('meets from and to together', async () => {
    const { svc } = service();
    expect(
      ids(await svc.list('events', { from: '2026-12-01', to: '2026-12-31' })),
    ).toEqual(['in-december']);
    expect(
      ids(
        await svc.list('events', {
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-31T23:59:59Z',
        }),
      ),
    ).toEqual(['last-week', 'happening-now', 'later-this-month']);
  });

  it('ignores a date it cannot read rather than failing', async () => {
    const { svc } = service();
    expect(ids(await svc.list('events', { from: 'soon' }))).toHaveLength(5);
  });

  /* EV-C5 and EV-C8. */
  it('carries each event’s image and its country’s code', async () => {
    const { svc, calls } = service();
    const list = await svc.list('events', { when: 'upcoming' });
    expect(list.data[1]).toMatchObject({
      id: 'later-this-month',
      featuredMedia: {
        publicUrl: '/media/fair.jpg',
        altText: 'A fictional fair hall',
      },
    });
    expect(list.data[0].featuredMedia).toBeNull();
    expect(calls[0]).toMatchObject({
      include: {
        country: { select: { name: true, slug: true, iso2Code: true } },
      },
    });
  });

  it('builds one condition for the dates', () => {
    expect(eventDateWhere({}, NOW)).toEqual([]);
    expect(
      eventDateWhere({ when: 'upcoming', from: '2026-11-01' }, NOW),
    ).toEqual([
      {
        OR: [
          { endsAt: { gte: NOW } },
          { endsAt: null, startsAt: { gte: NOW } },
        ],
      },
      { startsAt: { gte: new Date('2026-11-01') } },
    ]);
  });
});

describe('an event’s page', () => {
  /* EV-C8, EV-M7, EV-C5. */
  it('comes with its state and its image', async () => {
    const { svc, calls } = service();
    const detail = (await svc.detail('events', 'later-this-month')) as Row;
    expect(calls[0]).toMatchObject({
      include: {
        country: true,
        city: true,
        state: { select: { id: true, name: true, slug: true } },
      },
    });
    expect(detail.featuredMedia).toMatchObject({
      publicUrl: '/media/fair.jpg',
    });
    expect(detail.state).toEqual({
      id: 'state-1',
      name: 'Kanto',
      slug: 'kanto',
    });
  });
});

describe('the public careers list', () => {
  /* JOB-M3. A closing date is a calendar date: at noon UTC on that day the
     role is still open. */
  it('keeps a role listed through its whole closing day', async () => {
    const { svc } = service();
    expect(ids(await svc.list('jobs', {}))).toEqual(
      expect.arrayContaining(['closes-today', 'no-closing-date']),
    );
    expect(ids(await svc.list('jobs', {}))).not.toContain('closed-yesterday');
    expect(ids(await svc.list('jobs', { active: 'true' }))).toContain(
      'closes-today',
    );
  });

  it('lists only the roles that closed before today as inactive', async () => {
    const { svc } = service();
    expect(ids(await svc.list('jobs', { active: 'false' }))).toEqual([
      'closed-yesterday',
    ]);
  });

  /* JOB-C9. JobGuide reads row.state; the detail never sent it. */
  it('gives a role’s page its state', async () => {
    const { svc, calls } = service();
    const detail = (await svc.detail('jobs', 'closes-today')) as Row;
    expect(detail.state).toEqual({
      id: 'state-1',
      name: 'Kanto',
      slug: 'kanto',
    });
    expect(calls[0]).toMatchObject({
      include: {
        country: true,
        city: true,
        state: { select: { id: true, name: true, slug: true } },
      },
    });
  });
});
