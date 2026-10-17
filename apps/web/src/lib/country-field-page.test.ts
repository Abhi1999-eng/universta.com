import { describe, expect, it } from 'vitest';
import {
  countryFieldDescription,
  countryFieldIndexed,
  countryFieldPaths,
} from './country-field-page';

describe('a field in one destination: its description', () => {
  it('says what the page shows there, with its counts', () => {
    expect(
      countryFieldDescription({
        field: 'Computer Science',
        where: 'Japan',
        programmes: 42,
        universities: 12,
        specializations: 8,
      }),
    ).toBe(
      'Study Computer Science in Japan: 42 programmes at 12 universities, 8 specializations, the study levels it is offered at and advice on applying.',
    );
  });

  it('counts one of each in the singular', () => {
    expect(
      countryFieldDescription({
        field: 'Law',
        where: 'Japan',
        programmes: 1,
        universities: 1,
        specializations: 1,
      }),
    ).toBe(
      'Study Law in Japan: 1 programme at 1 university, 1 specialization, the study levels it is offered at and advice on applying.',
    );
  });

  it.each([
    [{ programmes: 0, universities: 0, specializations: 0 }],
    [{ programmes: null, universities: null, specializations: null }],
    [{}],
  ])('names no count that is not there (%o)', (counts) => {
    const text = countryFieldDescription({ field: 'Law', where: 'Japan', ...counts });
    expect(text).toBe('Study Law in Japan: the study levels it is offered at and advice on applying.');
    expect(text).not.toMatch(/\b0\b/);
  });

  it('leaves the universities out when only the programmes are counted', () => {
    expect(
      countryFieldDescription({ field: 'Law', where: 'Japan', programmes: 3, universities: 0 }),
    ).toBe('Study Law in Japan: 3 programmes, the study levels it is offered at and advice on applying.');
  });

  it('names a specialization’s subject, and its questions where it answers any', () => {
    expect(
      countryFieldDescription({
        field: 'Robotics',
        where: 'the United Kingdom',
        subject: 'Engineering',
        programmes: 5,
        universities: 3,
        faqs: 4,
      }),
    ).toBe(
      'Study Robotics in the United Kingdom, a specialization within Engineering: 5 programmes at 3 universities, the study levels it is offered at, answers to common questions and advice on applying.',
    );
  });

  /* The field's SEO text was written for the field's own page, which
     covers every destination: after the destination it read "Study Law
     in Japan. Compare law degrees abroad". It is no longer an input. */
  it('takes no written text, only what the page shows there', () => {
    const input = {
      field: 'Law',
      where: 'Japan',
      written: 'Compare law degrees abroad.',
      programmes: 9,
    };
    const text = countryFieldDescription(input as Parameters<typeof countryFieldDescription>[0]);
    expect(text).toBe(
      'Study Law in Japan: 9 programmes, the study levels it is offered at and advice on applying.',
    );
    expect(text).not.toContain('abroad');
  });

  it('differs from one destination to the next', () => {
    expect(
      new Set(
        ['Japan', 'Germany'].map((where) =>
          countryFieldDescription({ field: 'Law', where, programmes: 2 }),
        ),
      ).size,
    ).toBe(2);
  });
});

describe('a field in one destination: indexing', () => {
  it('asks to be indexed whole, and not as a narrowed list', () => {
    expect(countryFieldIndexed({ narrowed: false })).toBe(true);
    expect(countryFieldIndexed({ narrowed: true })).toBe(false);
  });

  it('lists each page the site renders at its bare address, with when it last changed', () => {
    expect(
      countryFieldPaths([
        { countrySlug: 'japan', subjectSlug: 'law', specializationSlug: null, programmes: 0, updatedAt: '2026-10-01T00:00:00.000Z' },
        { countrySlug: 'japan', subjectSlug: 'law', specializationSlug: 'tax-law', programmes: 4, updatedAt: '2026-10-02T00:00:00.000Z' },
      ]),
    ).toEqual([
      { path: '/study-abroad/japan/law', lastModified: '2026-10-01T00:00:00.000Z' },
      { path: '/study-abroad/japan/law/tax-law', lastModified: '2026-10-02T00:00:00.000Z' },
    ]);
  });

  it('skips a row that names no page, and a missing date is left off', () => {
    expect(
      countryFieldPaths([
        { countrySlug: '', subjectSlug: 'law', specializationSlug: null, programmes: 0, updatedAt: '2026-10-01T00:00:00.000Z' },
        { countrySlug: 'japan', subjectSlug: '', specializationSlug: null, programmes: 0, updatedAt: '2026-10-01T00:00:00.000Z' },
        { countrySlug: 'japan', subjectSlug: 'law', specializationSlug: null, programmes: 0, updatedAt: '' },
      ]),
    ).toEqual([{ path: '/study-abroad/japan/law' }]);
  });
});
