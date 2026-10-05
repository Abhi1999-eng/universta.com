import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  faqJsonLd,
  plainText,
  universityJsonLd,
} from './university-json-ld';

/**
 * Structured data for a university's pages, built only from what the page
 * shows and the record holds.
 */

const origin = 'https://universta.example';

describe('the breadcrumb trail', () => {
  it('numbers each step and gives the unlinked last step the page’s own address', () => {
    expect(
      breadcrumbJsonLd(
        [
          { label: 'Home', href: '/' },
          { label: 'Universities', href: '/universities' },
          { label: 'University of Warwick' },
        ],
        '/universities/university-of-warwick',
        origin,
      ),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://universta.example/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Universities',
          item: 'https://universta.example/universities',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'University of Warwick',
          item: 'https://universta.example/universities/university-of-warwick',
        },
      ],
    });
  });
});

describe('the questions', () => {
  it('reads an answer as its words, links included', () => {
    expect(
      plainText(
        <>
          Fees are set by the destination, and <a href="/x">the guide to the United Kingdom</a>{' '}
          covers them. {3} awards.
        </>,
      ),
    ).toBe('Fees are set by the destination, and the guide to the United Kingdom covers them. 3 awards.');
    expect(plainText(null)).toBe('');
    expect(plainText(false)).toBe('');
  });

  it('leaves out a question without an answer, and stands down with none', () => {
    expect(faqJsonLd([])).toBeNull();
    expect(faqJsonLd([{ question: 'Empty?', answer: '  ' }])).toBeNull();
    expect(
      faqJsonLd([
        { question: 'Where is it?', answer: 'In  Coventry.' },
        { question: 'Empty?', answer: '' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Where is it?',
          acceptedAnswer: { '@type': 'Answer', text: 'In Coventry.' },
        },
      ],
    });
  });
});

describe('the institution', () => {
  it('has no address when the record says nowhere', () => {
    const data = universityJsonLd(
      {
        name: 'Lakeside College',
        slug: 'lakeside-college',
        shortDescription: null,
        websiteUrl: null,
        establishedYear: null,
        country: null,
      },
      origin,
    );
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollegeOrUniversity',
      name: 'Lakeside College',
      url: 'https://universta.example/universities/lakeside-college',
    });
  });

  it('names the country by its code, or by its name without one', () => {
    const data = universityJsonLd(
      {
        name: 'Lakeside College',
        slug: 'lakeside-college',
        shortDescription: null,
        websiteUrl: null,
        establishedYear: null,
        city: 'Toronto',
        country: { name: 'Canada', iso2Code: null },
      },
      origin,
    );
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Toronto',
      addressCountry: 'Canada',
    });
  });
});
