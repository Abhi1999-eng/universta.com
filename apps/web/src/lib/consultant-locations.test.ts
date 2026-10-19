import { describe, expect, it } from 'vitest';
import { liveConsultantOffices, locationHeading, locationPlaceLabel, nearbyOffices, type ConsultantOffice } from './consultant-locations';

const office = (slug: string, over: Partial<ConsultantOffice> = {}): ConsultantOffice => ({
  slug,
  name: `${slug} office`,
  city: null,
  state: null,
  countryId: null,
  countrySlug: null,
  ...over,
});
const slugs = (list: ConsultantOffice[]) => list.map((entry) => entry.slug);

describe('a location\'s place', () => {
  it('is the city, with its state when there is one, or the record\'s name', () => {
    expect(locationPlaceLabel({ city: 'Heidelberg', state: 'Baden-Württemberg' })).toBe('Heidelberg, Baden-Württemberg');
    expect(locationPlaceLabel({ name: 'Online office', city: null })).toBe('Online office');
    expect(locationHeading({ city: 'Pune' })).toBe('Study abroad consultants in Pune');
  });
});

describe('the offices near a location', () => {
  const offices = [
    office('here', { city: 'Pune', state: 'Maharashtra', countrySlug: 'india' }),
    office('mumbai', { city: 'Mumbai', state: 'maharashtra', countrySlug: 'india' }),
    office('nagpur', { city: 'Nagpur', state: 'Maharashtra' }),
    office('delhi', { city: 'Delhi', state: 'Delhi', countrySlug: 'india' }),
    office('pune-2', { city: 'Pune' }),
    office('maharashtra-uk', { city: 'Elsewhere', state: 'Maharashtra', countrySlug: 'united-kingdom' }),
  ];

  it('are those in the same state, never in another country, and never the location itself', () => {
    expect(slugs(nearbyOffices({ slug: 'here', city: 'Pune', state: 'Maharashtra', countrySlug: 'india' }, offices))).toEqual([
      'mumbai',
      'nagpur',
    ]);
  });

  it('are those in the same country when there is no state', () => {
    expect(slugs(nearbyOffices({ slug: 'here', city: 'Pune', countrySlug: 'india' }, offices))).toEqual(['delhi', 'mumbai']);
  });

  it('are those in the same city when the location has neither', () => {
    expect(slugs(nearbyOffices({ slug: 'here', city: 'pune' }, offices))).toEqual(['pune-2']);
    expect(nearbyOffices({ slug: 'here', city: null }, offices)).toEqual([]);
  });

  it('stop at the limit', () => {
    const many = Array.from({ length: 12 }, (_, index) => office(`c${String(index).padStart(2, '0')}`, { city: 'Cambridge' }));
    expect(nearbyOffices({ slug: 'x', city: 'Cambridge' }, many)).toHaveLength(8);
  });
});

describe('the live offices of the published consultants', () => {
  it('keep each active, unarchived location once', () => {
    const list = liveConsultantOffices([
      { locations: [{ location: { slug: 'a', name: 'A', city: 'Pune', status: 'ACTIVE' } }] },
      { locations: [{ location: { slug: 'a', name: 'A', city: 'Pune', status: 'ACTIVE' } }, { location: { slug: 'b', status: 'INACTIVE' } }] },
      { locations: [{ location: { slug: 'c', status: 'ACTIVE', deletedAt: '2026-10-01' } }] },
    ]);
    expect(list.map((entry) => entry.slug)).toEqual(['a']);
  });
});
