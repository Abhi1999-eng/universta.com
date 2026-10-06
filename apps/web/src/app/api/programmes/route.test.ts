import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The catalogue read is what this route forwards to; it is replaced by one
   that records what it was asked and answers with one programme. */
const asked: Array<Record<string, string>> = [];
let fail = false;
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: async (params: Record<string, string>) => {
    asked.push(params);
    if (fail) throw new Error('down');
    return {
      data: [
        {
          id: 'o1',
          name: 'MSc Computer Science',
          slug: 'university-of-warwick-msc-computer-science',
          requirements: [
            { category: 'ENGLISH_TEST', title: 'IELTS', minimumScore: '6.5' },
          ],
          genericCourse: { name: 'MSc Computer Science', slug: 'msc-computer-science' },
          university: {
            name: 'University of Warwick',
            slug: 'university-of-warwick',
            country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
            campuses: [{ city: 'Coventry' }],
          },
        },
      ],
      meta: { page: 2, limit: 18, total: 19, totalPages: 2 },
    };
  },
}));

import { GET } from './route';

/**
 * "Load more" on the course finder and the lists drawn from it: the next
 * eighteen programmes across universities, as cards that open each
 * programme under its own university and country. The filters are read the
 * way the page reads them -- the reference's names included -- and a list
 * fixed to part of the catalogue says so with `within`.
 */

const call = (search: string) =>
  GET(new Request(`http://localhost/api/programmes${search}`));

beforeEach(() => {
  asked.length = 0;
  fail = false;
});

describe('the next page of programmes', () => {
  it('answers with cards that open each programme under its country', async () => {
    const response = await call('?country=united-kingdom&page=2');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as {
      cards: Array<{ href: string; language: unknown; university: { name: string } }>;
      meta: { page: number };
    };
    expect(body.cards[0]!.href).toBe(
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science',
    );
    expect(body.cards[0]!.university.name).toBe('University of Warwick');
    expect(body.cards[0]!.language).toEqual({ value: 'English', note: 'IELTS 6.5 minimum' });
    expect(body.meta.page).toBe(2);
    expect(asked[0]).toEqual({
      limit: '18',
      page: '2',
      country: 'united-kingdom',
    });
  });

  it('reads the reference’s names and passes the API ours', async () => {
    await call('?level=masters&specialization=ai&study_mode=full-time&pg=3&sort=title&ielts=6.5');
    expect(asked[0]).toEqual({
      limit: '18',
      page: '3',
      level: 'PG',
      specialization: 'ai',
      studyMode: 'FULL_TIME',
      ielts: '6.5',
      sort: 'name',
    });
  });

  it('passes on the part of the catalogue a list is fixed to, and nothing it does not know', async () => {
    await call('?country=united-kingdom&subject=law&within=country,subject,galaxy');
    expect(asked[0]).toMatchObject({
      country: 'united-kingdom',
      subject: 'law',
      within: 'country,subject',
    });
  });

  it('says the catalogue could not be reached rather than answering with nothing', async () => {
    fail = true;
    const response = await call('');
    expect(response.status).toBe(502);
  });
});
