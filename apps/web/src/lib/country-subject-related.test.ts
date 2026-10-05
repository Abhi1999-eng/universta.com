import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consultantItems,
  consultantsGroup,
  listTotal,
  scholarshipItems,
  scholarshipsGroup,
  specializationUniversities,
} from './country-subject-related';

/**
 * The closing band of a specialization's page in one destination. It had one
 * group, "More in Computer Science", whose count said 6 over eleven; the
 * design's band also names who teaches it there, the funding for students
 * going there and the people who advise them.
 */

const read = vi.hoisted(() => ({
  calls: [] as Array<{ resource: string; params: Record<string, string> }>,
  result: null as null | { data: unknown[]; meta: unknown },
  fail: false,
}));
vi.mock('@/lib/phase1', () => ({
  phaseList: async (resource: string, params: Record<string, string>) => {
    read.calls.push({ resource, params });
    if (read.fail) throw new Error('down');
    return read.result;
  },
}));

beforeEach(() => {
  read.calls = [];
  read.result = null;
  read.fail = false;
});

describe("a group's count", () => {
  it("is the list's own total, not the handful named", () => {
    expect(listTotal({ total: 7 }, 5)).toBe(7);
  });

  it('is never fewer than the rows it names', () => {
    expect(listTotal({ total: 2 }, 5)).toBe(5);
    expect(listTotal(null, 3)).toBe(3);
    expect(listTotal({ total: 'many' }, 4)).toBe(4);
  });
});

describe('scholarships for a destination', () => {
  it('names each with what it is worth, else what it covers', () => {
    expect(
      scholarshipItems([
        { id: 'a', slug: 'demo-grant', title: 'Demo grant', amount: '2000', currencyCode: 'CAD' },
        { id: 'b', slug: 'chevening', title: 'Chevening', benefitType: 'FULL_FUNDING' },
        { id: 'c', slug: '', title: 'No address' },
      ]),
    ).toEqual([
      { id: 'a', name: 'Demo grant', href: '/scholarships/demo-grant', note: 'CAD 2,000' },
      { id: 'b', name: 'Chevening', href: '/scholarships/chevening', note: 'Full funding' },
    ]);
  });

  it("asks for the destination's list and counts all of it", async () => {
    read.result = {
      data: [{ id: 'a', slug: 'a', title: 'A' }],
      meta: { total: 7 },
    };
    const group = await scholarshipsGroup('united-kingdom', 'the United Kingdom');
    expect(read.calls[0]).toEqual({
      resource: 'scholarships',
      params: { country: 'united-kingdom', limit: '5' },
    });
    expect(group.title).toBe('Scholarships for the United Kingdom');
    expect(group.total).toBe(7);
  });

  it('is an empty group, not a broken page, when the list cannot be read', async () => {
    read.fail = true;
    const group = await scholarshipsGroup('united-kingdom', 'the United Kingdom');
    expect(group.items).toEqual([]);
  });
});

describe('consultants for a destination', () => {
  it('says where each one is and whether Universta has verified it', () => {
    expect(
      consultantItems([
        {
          id: 'l',
          slug: 'lindenhall',
          name: 'Lindenhall',
          verificationStatus: 'VERIFIED',
          locations: [{ location: { city: 'Manipal' } }],
        },
        { id: 'n', slug: 'northbridge', name: 'Northbridge', locations: [] },
        /* The list sends each location nested under its link row, which the
           shared record type does not spell out. */
      ] as unknown as Parameters<typeof consultantItems>[0]),
    ).toEqual([
      {
        id: 'l',
        name: 'Lindenhall',
        href: '/study-abroad-consultants/lindenhall',
        note: 'Manipal · Verified',
      },
      {
        id: 'n',
        name: 'Northbridge',
        href: '/study-abroad-consultants/northbridge',
        note: 'Not yet verified',
      },
    ]);
  });

  it("is the destination's, said as such", async () => {
    read.result = { data: [], meta: { total: 0 } };
    const group = await consultantsGroup('afghanistan', 'Afghanistan');
    expect(read.calls[0].params).toEqual({ country: 'afghanistan', limit: '5' });
    expect(group.title).toBe('Consultants for Afghanistan');
    expect(group.items).toEqual([]);
  });
});

describe('the universities that teach a specialization in one destination', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => body,
    });

  const args = [
    { slug: 'computer-science' },
    { slug: 'software-engineering', name: 'Software Engineering' },
    { slug: 'united-kingdom' },
    'the United Kingdom',
  ] as const;

  it("asks the specialization's own list, narrowed to the destination", async () => {
    respond(200, {
      data: [
        { id: '1', name: 'University of Edinburgh', slug: 'university-of-edinburgh', city: 'Edinburgh' },
        { id: '2', name: 'Kingsley University', slug: 'kingsley-university', city: null },
      ],
      meta: { total: 4 },
      error: null,
    });
    const result = await specializationUniversities(...args);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe(
      '/api/v1/subjects/computer-science/specializations/software-engineering/universities',
    );
    expect(url.searchParams.get('country')).toBe('united-kingdom');
    expect(url.searchParams.get('limit')).toBe('6');
    expect(result.total).toBe(4);
    expect(result.group).toEqual({
      title: 'Universities teaching Software Engineering in the United Kingdom',
      total: 4,
      items: [
        {
          id: '1',
          name: 'University of Edinburgh',
          href: '/universities/university-of-edinburgh',
          note: 'Edinburgh',
        },
        { id: '2', name: 'Kingsley University', href: '/universities/kingsley-university', note: null },
      ],
    });
  });

  it('knows nothing, rather than zero, when the list cannot be read', async () => {
    // The figures strip leaves an unknown out; a zero would be a claim.
    respond(503, { data: null, meta: null, error: { code: 'BUSY' } });
    const result = await specializationUniversities(...args);
    expect(result.total).toBeNull();
    expect(result.group.items).toEqual([]);
  });

  it('survives the API being unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await specializationUniversities(...args);
    expect(result.total).toBeNull();
  });
});
