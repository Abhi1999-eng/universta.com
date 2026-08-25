import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CountryDetailReference,
  type CountryDetailReferenceProps,
} from './CountryDetailReference';

/**
 * Every row of the hero "at a glance" panel comes from an Admin-managed
 * profile. On the deployed catalogue none of those profiles were filled in, so
 * all six rows resolved to null and the aside still rendered: a titled card
 * with a subtitle and nothing under it, on all six country pages, with the
 * hero heading stranded at 62% width beside the empty column.
 */

const emptyProfiles = {
  cost: null,
  work: null,
  language: null,
  statistics: null,
  intakes: [],
} as unknown as CountryDetailReferenceProps['page']['profiles'];

function build(
  profiles: CountryDetailReferenceProps['page']['profiles'],
): CountryDetailReferenceProps {
  return {
    page: {
      country: {
        id: 'c1',
        name: 'United Kingdom',
        slug: 'united-kingdom',
        pageHeading: 'Study in the United Kingdom',
        shortDescription: 'Explore universities across the United Kingdom.',
        continent: { id: 'e1', name: 'Europe', slug: 'europe' },
        flag: null,
        featured: false,
        displayOrder: 0,
      },
      profiles,
      sections: [],
      faqs: [],
      seo: null,
      consultantCards: [],
    },
    cities: [],
    universities: [],
    universityTotal: 0,
    scholarships: [],
    scholarshipTotal: 0,
    subjects: [],
    courseTotal: 0,
  } as unknown as CountryDetailReferenceProps;
}

describe('CountryDetailReference hero quick facts', () => {
  it('omits the at-a-glance panel when no figure is published', () => {
    const html = renderToStaticMarkup(<CountryDetailReference {...build(emptyProfiles)} />);
    expect(html).not.toContain('quickfacts');
    expect(html).not.toContain('at a glance');
    // and the hero must not keep an empty second column
    expect(html).toContain('hero-grid-solo');
  });

  it('renders the panel, and no solo modifier, as soon as one figure exists', () => {
    const withCost = {
      ...emptyProfiles,
      cost: { currencyCode: 'GBP', tuitionMin: '20000', tuitionMax: '30000', tuitionPeriod: 'PER_YEAR' },
    } as unknown as CountryDetailReferenceProps['page']['profiles'];
    const html = renderToStaticMarkup(<CountryDetailReference {...build(withCost)} />);
    expect(html).toContain('quickfacts');
    expect(html).toContain('at a glance');
    expect(html).toContain('Tuition');
    expect(html).not.toContain('hero-grid-solo');
  });
});
