import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subjectUniversitiesGroup, subjectUniversitiesHref } from './university-related';

/**
 * The universities group on a subject's page in one destination.
 *
 * It names six, and its count said 6 as well: "Universities in the United
 * Kingdom 6" over Computer Science, which ten UK universities teach, with
 * a title that read as every university in the country and no way on to
 * the four it left out.
 */

const read = vi.hoisted(() => ({
  calls: [] as Array<Record<string, string>>,
  result: null as null | { data: unknown[]; meta: unknown },
  fail: false,
}));
vi.mock('@/lib/phase1', () => ({
  phaseList: async (_resource: string, params: Record<string, string>) => {
    read.calls.push(params);
    if (read.fail) throw new Error('down');
    return read.result;
  },
}));

beforeEach(() => {
  read.calls = [];
  read.result = null;
  read.fail = false;
});

const university = (slug: string, name: string, qsRanking: number | null = null) => ({
  id: slug,
  slug,
  name,
  qsRanking,
  campuses: [],
  _count: { offerings: 1 },
});

const computing = { slug: 'computer-science', name: 'Computer Science' };

describe('the universities that teach a subject in one destination', () => {
  it('counts every one of them, not the six it names', async () => {
    read.result = {
      data: [
        university('imperial', 'Imperial College London', 2),
        university('kingsley', 'Kingsley University'),
        university('lakemont', 'Lakemont University'),
        university('sterling', 'Sterling Metropolitan University'),
        university('kingsley-poly', 'Kingsley Polytechnic'),
        university('lakemont-poly', 'Lakemont Polytechnic'),
      ],
      meta: { page: 1, limit: 6, total: 10, totalPages: 2 },
    };
    const group = await subjectUniversitiesGroup('united-kingdom', computing, 'the United Kingdom');
    expect(group.items).toHaveLength(6);
    expect(group.total).toBe(10);
    expect(read.calls).toEqual([
      { country: 'united-kingdom', subject: 'computer-science', sort: 'ranking', limit: '6' },
    ]);
  });

  it('names the subject in its title, not only the country', async () => {
    read.result = { data: [university('imperial', 'Imperial College London')], meta: { total: 1 } };
    const group = await subjectUniversitiesGroup('united-kingdom', computing, 'the United Kingdom');
    expect(group.title).toBe('Universities teaching Computer Science in the United Kingdom');
  });

  it('lists them ranked first, then A to Z, each to its own page', async () => {
    read.result = {
      data: [
        university('zeta', 'Zeta University'),
        university('alpha', 'Alpha University'),
        university('ranked', 'Ranked University', 40),
      ],
      meta: { total: 3 },
    };
    const group = await subjectUniversitiesGroup('united-kingdom', computing, 'the United Kingdom');
    expect(group.items.map((item) => item.href)).toEqual([
      '/universities/ranked',
      '/universities/alpha',
      '/universities/zeta',
    ]);
  });

  it('never counts fewer than it names', async () => {
    read.result = { data: [university('a', 'A'), university('b', 'B')], meta: null };
    const group = await subjectUniversitiesGroup('united-kingdom', computing, 'the United Kingdom');
    expect(group.total).toBe(2);
  });

  it('costs the group, not the page, when the read fails', async () => {
    read.fail = true;
    const group = await subjectUniversitiesGroup('united-kingdom', computing, 'the United Kingdom');
    expect(group.items).toEqual([]);
    expect(group.total).toBe(0);
  });

  it('links to the rest: the destination’s list, opened on the subject', () => {
    expect(subjectUniversitiesHref('united-kingdom', 'computer-science')).toBe(
      '/study-abroad/united-kingdom/universities?subject=computer-science',
    );
  });
});
