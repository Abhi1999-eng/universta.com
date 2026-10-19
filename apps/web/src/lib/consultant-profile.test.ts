import { describe, expect, it } from 'vitest';
import type { CountryConsultantRow } from './country-consultant-list';
import { consultantNeighbours, consultantVerification, displayUrl, externalHttpUrl } from './consultant-profile';

describe('a consultant\'s website and source, as links', () => {
  it('links an absolute http or https address', () => {
    expect(externalHttpUrl('https://lindenhall.example/admissions')).toBe(
      'https://lindenhall.example/admissions',
    );
    expect(externalHttpUrl('  http://lindenhall.example ')).toBe('http://lindenhall.example');
    expect(externalHttpUrl('HTTPS://LINDENHALL.EXAMPLE')).toBe('HTTPS://LINDENHALL.EXAMPLE');
  });

  it('leaves a bare domain, a note or another scheme unlinked', () => {
    expect(externalHttpUrl('www.audit-consultant.test')).toBeNull();
    expect(externalHttpUrl('Checked by phone with the office')).toBeNull();
    expect(externalHttpUrl('javascript:alert(1)')).toBeNull();
    expect(externalHttpUrl('mailto:hello@example.test')).toBeNull();
    expect(externalHttpUrl('https://')).toBeNull();
    expect(externalHttpUrl(null)).toBeNull();
  });

  it('reads an address without its scheme', () => {
    expect(displayUrl('https://lindenhall.example')).toBe('lindenhall.example');
    expect(displayUrl('www.audit-consultant.test')).toBe('www.audit-consultant.test');
  });
});

describe('a consultant\'s verification, as its pages may state it', () => {
  it('dates a verified record', () => {
    expect(consultantVerification('VERIFIED', '2026-10-01T00:00:00.000Z')).toEqual({
      verified: true,
      verifiedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('keeps a verified record without a date verified, and undated', () => {
    expect(consultantVerification('VERIFIED', null)).toEqual({ verified: true, verifiedAt: null });
    expect(consultantVerification('VERIFIED', 'not a date')).toEqual({ verified: true, verifiedAt: null });
  });

  it('never dates a pending or unverified record, whatever date it holds', () => {
    expect(consultantVerification('PENDING', '2026-10-01T00:00:00.000Z')).toEqual({
      verified: false,
      verifiedAt: null,
    });
    expect(consultantVerification('UNVERIFIED', '2026-10-01T00:00:00.000Z').verifiedAt).toBeNull();
    expect(consultantVerification(undefined, undefined)).toEqual({ verified: false, verifiedAt: null });
  });
});

const row = (slug: string, over: Partial<CountryConsultantRow> = {}): CountryConsultantRow => ({
  id: slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  slug,
  summary: null,
  verified: false,
  verifiedAt: null,
  cities: [],
  services: [],
  languages: [],
  destinations: [],
  ...over,
});
const svc = (...names: string[]) => names.map((name) => ({ slug: name.toLowerCase().replace(/ /g, '-'), name }));
const dest = (...slugs: string[]) => slugs.map((slug) => ({ slug, name: slug[0]!.toUpperCase() + slug.slice(1) }));
const slugs = (rows: CountryConsultantRow[]) => rows.map((entry) => entry.slug);

describe('the consultants a profile suggests', () => {
  const self = row('self', { cities: ['Heidelberg'], destinations: dest('germany', 'japan'), services: svc('Visa documentation', 'Course selection') });

  it('suggests up to three that share most by city, then destination, then service, never the consultant itself', () => {
    const rows = [
      self,
      row('service-only', { services: svc('Visa documentation', 'Course selection') }),
      row('one-destination', { destinations: dest('japan') }),
      row('same-city', { cities: ['heidelberg'] }),
      row('two-destinations', { destinations: dest('germany', 'japan'), services: svc('visa documentation') }),
      row('nothing', { cities: ['Paris'], destinations: dest('france') }),
    ];
    const { similar } = consultantNeighbours(self, rows);
    expect(slugs(similar)).toEqual(['two-destinations', 'same-city', 'one-destination']);
  });

  it('does not call a consultant similar for a shared service alone', () => {
    const { similar } = consultantNeighbours(self, [row('service-only', { services: svc('Visa documentation') })]);
    expect(similar).toEqual([]);
  });

  it('keeps the catalogue\'s order between equals: nothing is paid for', () => {
    const rows = ['c', 'a', 'b', 'd'].map((slug) => row(slug, { destinations: dest('germany') }));
    expect(slugs(consultantNeighbours(self, rows).similar)).toEqual(['c', 'a', 'b']);
  });

  it('lists the rest of the consultants for these destinations A to Z, leaving out the similar ones', () => {
    const rows = [
      row('zeta', { destinations: dest('japan') }),
      row('alpha', { destinations: dest('germany') }),
      row('mid', { destinations: dest('japan') }),
      row('near', { cities: ['Heidelberg'], destinations: dest('germany') }),
      row('beta', { destinations: dest('germany') }),
      row('france-only', { destinations: dest('france') }),
      row('alpha', { destinations: dest('germany') }),
    ];
    const { similar, others } = consultantNeighbours(self, rows);
    expect(slugs(similar)).toEqual(['near', 'zeta', 'alpha']);
    expect(slugs(others)).toEqual(['beta', 'mid']);
    expect(slugs(others).some((slug) => slugs(similar).includes(slug))).toBe(false);
  });

  it('suggests nobody for a consultant with no city or destination in common with anyone', () => {
    expect(consultantNeighbours(row('alone'), [row('other', { services: svc('Visa documentation') })])).toEqual({
      similar: [],
      others: [],
    });
  });
});
