import { describe, expect, it } from 'vitest';
import { readUniversityCompareSlugs, toCompareUniversity, universityCompareHref } from './university-compare';

describe('the university comparison address and record', () => {
  it('keeps five distinct slugs in requested order, including repeated query parameters', () => {
    expect(readUniversityCompareSlugs({ items: [' A, b,a, ', ' C,D,e,f'] })).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(universityCompareHref([' A ', 'b', 'a'])).toBe('/compare/universities?items=a,b');
    expect(universityCompareHref([])).toBe('/compare/universities');
    expect(universityCompareHref(['invalid&query'])).toBe('/compare/universities?items=invalid%26query');
  });

  it('retains published record fields, factual zero counts and distinct campus cities', () => {
    expect(toCompareUniversity({
      name: 'University A', slug: 'a', country: { name: 'United Kingdom', slug: 'uk' },
      institutionType: 'PUBLIC', shortDescription: 'Official summary', qsRanking: 23,
      campuses: [{ city: 'London' }, { city: 'London' }, { city: 'Birmingham' }],
      accreditations: [{ name: 'Accreditation A' }], _count: { offerings: 0 }, verifiedAt: '2026-10-06',
      tuitionMin: 12000,
    })).toEqual({
      name: 'University A', slug: 'a', country: 'United Kingdom', countrySlug: 'uk',
      institutionType: 'PUBLIC', shortDescription: 'Official summary', qsRanking: 23,
      campuses: 3, cities: ['London', 'Birmingham'], accreditations: ['Accreditation A'],
      offerings: 0, verifiedAt: '2026-10-06',
    });
  });

  it('leaves unrecorded facts missing and rejects unnamed or malformed records', () => {
    expect(toCompareUniversity({ name: 'A', slug: 'a', qsRanking: 0 })?.qsRanking).toBeNull();
    expect(toCompareUniversity({ name: 'A', slug: 'a' })?.country).toBeNull();
    expect(toCompareUniversity({ slug: 'a' })).toBeNull();
    expect(toCompareUniversity(null)).toBeNull();
  });

  it('counts and names current campuses, excluding retired records but retaining legacy rows without state', () => {
    const item = toCompareUniversity({ name: 'University A', slug: 'a', campuses: [
      { city: 'London', status: 'ACTIVE', deletedAt: null },
      { city: 'Manchester', status: 'INACTIVE', deletedAt: null },
      { city: 'Cardiff', status: 'ACTIVE', deletedAt: '2026-10-01' },
      { city: 'Oxford', status: 'ARCHIVED' },
      { city: 'York' },
    ] });
    expect(item?.campuses).toBe(2);
    expect(item?.cities).toEqual(['London', 'York']);
  });
});
