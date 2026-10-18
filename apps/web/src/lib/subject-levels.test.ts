import { describe, expect, it } from 'vitest';
import { levelPages } from './course-levels';
import {
  findSubjectLevel,
  levelPageHref,
  levelPageLinks,
  subjectLevelHref,
  subjectLevelSlug,
} from './subject-levels';

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

describe('links to the level pages a field is offered at', () => {
  const catalogue = [
    { code: 'FOUNDATION' }, { code: 'PATHWAY' }, { code: 'UG' }, { code: 'PG' },
    { code: 'MBA' }, { code: 'PHD' }, { code: 'DIPLOMA' }, { code: 'PGDM' }, { code: 'CERTIFICATE' },
  ];

  it('links each offered level by its plain address, never the guides copy', () => {
    const links = levelPageLinks(
      [{ code: 'UG', name: "Bachelor's" }, { code: 'PG', name: "Master's" }],
      { subject: 'computing' },
      catalogue,
    );
    expect(links).toEqual([
      { code: 'UG', name: "Bachelor's", href: '/subjects/computing/bachelors' },
      { code: 'PG', name: "Master's", href: '/subjects/computing/masters' },
    ]);
    expect(links.some((link) => link.href.includes('?'))).toBe(false);
  });

  it("links a specialization's levels under the specialization", () => {
    expect(
      levelPageLinks([{ code: 'PHD', name: 'PhD' }], { subject: 'computing', specialization: 'ai' }, catalogue),
    ).toEqual([{ code: 'PHD', name: 'PhD', href: '/subjects/computing/ai/phd' }]);
  });

  it('links nothing for a field offered at nothing, though its six named pages render', () => {
    expect(levelPageLinks([], { subject: 'computing' }, catalogue)).toEqual([]);
    expect(levelPageLinks(null, { subject: 'computing' }, catalogue)).toEqual([]);
    expect(levelPageLinks(undefined, { subject: 'computing' })).toEqual([]);
  });

  it('leaves out a level the catalogue has switched off, and a level with no code', () => {
    const links = levelPageLinks(
      [
        { code: 'PG', name: "Master's" },
        { code: 'POSTDOC', name: 'Postdoctoral' },
        { code: null, name: 'Unknown' },
      ],
      { subject: 'computing' },
      catalogue,
    );
    expect(links.map((link) => link.code)).toEqual(['PG']);
    /* Offered only at a switched-off level: offered at nothing, so no links. */
    expect(levelPageLinks([{ code: 'POSTDOC', name: 'Postdoctoral' }], { subject: 'x' }, catalogue)).toEqual([]);
    /* Even when that level is one of the six every field has a page at: the
       field is offered at nothing, and those pages claim nothing. */
    expect(levelPageLinks([{ code: 'PHD', name: 'PhD' }], { subject: 'x' }, [{ code: 'UG' }])).toEqual([]);
    expect(levelPageLinks([{ code: 'FOUNDATION', name: 'Foundation' }], { subject: 'x' }, [{ code: 'PG' }])).toEqual([]);
  });

  it('puts the links in the order a student climbs them, each level once', () => {
    const links = levelPageLinks(
      [
        { code: 'PHD', name: 'PhD' },
        { code: 'pg', name: "Master's" },
        { code: 'UG', name: "Bachelor's" },
        { code: 'PG', name: "Master's" },
      ],
      { subject: 'computing' },
      catalogue,
    );
    expect(links.map((link) => link.href)).toEqual([
      '/subjects/computing/bachelors',
      '/subjects/computing/masters',
      '/subjects/computing/phd',
    ]);
  });

  it('keeps the given order where the catalogue is unknown', () => {
    const links = levelPageLinks(
      [{ code: 'PG', name: "Master's" }, { code: 'UG', name: "Bachelor's" }],
      { subject: 'computing' },
      null,
    );
    expect(links.map((link) => link.code)).toEqual(['PG', 'UG']);
  });

  it('gives the levels without a named address their lower-case code', () => {
    const links = levelPageLinks(
      [
        { code: 'DIPLOMA', name: 'Diploma' },
        { code: 'PGDM', name: 'Post Graduate Diploma in Management' },
        { code: 'CERTIFICATE', name: 'Certificate' },
      ],
      { subject: 'business' },
      catalogue,
    );
    expect(links.map((link) => link.href)).toEqual([
      '/subjects/business/diploma',
      '/subjects/business/pgdm',
      '/subjects/business/certificate',
    ]);
  });
});
