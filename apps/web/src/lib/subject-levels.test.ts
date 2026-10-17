import { describe, expect, it } from 'vitest';
import { levelPages } from './course-levels';
import { findSubjectLevel, levelPageHref, subjectLevelHref, subjectLevelSlug } from './subject-levels';

const levels = [
  { code: 'FOUNDATION', name: 'Foundation' },
  { code: 'PATHWAY', name: 'Pathway' },
  { code: 'UG', name: "Bachelor's" },
  { code: 'PG', name: "Master's" },
  { code: 'MBA', name: 'MBA' },
  { code: 'PHD', name: 'PhD' },
];

describe('subject study-level addresses', () => {
  it('gives all six public levels distinct readable addresses', () => {
    expect(levels.map((level) => subjectLevelSlug(level.code))).toEqual([
      'foundation', 'pathway', 'bachelors', 'masters', 'mba', 'phd',
    ]);
    expect(subjectLevelSlug('ug')).toBe('bachelors');
    expect(subjectLevelSlug('PRE_MASTERS')).toBe('pre_masters');
  });

  it('keeps study levels outside the specialization segment and marks guide listings explicitly', () => {
    expect(subjectLevelHref({ subject: 'computing', level: 'UG' })).toBe('/subjects/computing/bachelors');
    expect(subjectLevelHref({ subject: 'computing', specialization: 'computer-science', level: 'PG', guides: true }))
      .toBe('/subjects/computing/computer-science/masters?view=guides');
    expect(subjectLevelHref({ subject: 'arts & design', specialization: 'film/tv', level: 'PHD' }))
      .toBe('/subjects/arts%20%26%20design/film%2Ftv/phd');
  });

  it.each([
    ['bachelors', 'UG'], ['ug', 'UG'], ['UG', 'UG'], ['undergraduate', 'UG'],
    ['masters', 'PG'], ['pg', 'PG'], ['MBA', 'MBA'],
  ])('resolves %s to the catalogue level %s', (slug, code) => {
    expect(findSubjectLevel(levels, slug)?.code).toBe(code);
  });

  it('only resolves levels that the catalogue actually records', () => {
    expect(findSubjectLevel(levels, 'postdoctoral')).toBeUndefined();
    expect(findSubjectLevel(levels, 'postgraduate')).toBeUndefined();
    expect(findSubjectLevel([], 'ug')).toBeUndefined();
    const extra = { code: 'CERTIFICATE', name: 'Certificate' };
    expect(findSubjectLevel([...levels, extra], 'certificate')).toBe(extra);
  });

  it('links a level page only where the field has one', () => {
    const offered = levelPages([{ code: 'PG' }, { code: 'PHD' }]);
    expect(levelPageHref(offered, { subject: 'computing', specialization: 'ai', level: 'PG', guides: true }))
      .toBe('/subjects/computing/ai/masters?view=guides');
    expect(levelPageHref(offered, { subject: 'computing', level: 'phd' })).toBe('/subjects/computing/phd');
    expect(levelPageHref(offered, { subject: 'computing', level: 'UG' })).toBeNull();
    /* A field offered at nothing has the six named pages, and only those. */
    const fallback = levelPages([]);
    expect(levelPageHref(fallback, { subject: 'x', level: 'FOUNDATION' })).toBe('/subjects/x/foundation');
    expect(levelPageHref(fallback, { subject: 'x', level: 'DIPLOMA' })).toBeNull();
  });
});
