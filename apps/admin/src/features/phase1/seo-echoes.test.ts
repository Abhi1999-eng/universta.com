import { describe, expect, it } from 'vitest';
import { writtenSeoValues } from './seo-echoes';

const KEYS = ['seoTitle', 'metaDescription', 'canonicalUrl', 'focusKeyword', 'ogTitle', 'ogDescription', 'twitterTitle', 'twitterDescription'] as const;
const DEFAULT = 'Explore published study-abroad courses, universities, destinations and scholarships on Universta.';

/* What the old editor stored for a story it only opened and saved: every
   value the page used anyway, as though written. */
const echoed = {
  seoTitle: 'From Pune to Tokyo',
  metaDescription: DEFAULT,
  canonicalUrl: '/success-stories/from-pune-to-tokyo',
  focusKeyword: '',
  ogTitle: 'From Pune to Tokyo',
  ogDescription: DEFAULT,
  twitterTitle: 'From Pune to Tokyo',
  twitterDescription: DEFAULT,
};

describe('writtenSeoValues', () => {
  it('leaves out a stored title and description the page ignores, and their copies', () => {
    const values = writtenSeoValues(
      echoed,
      { seoTitle: 'From Pune to Tokyo', metaDescription: 'It began with a phone call.', source: { title: 'fallback', description: 'fallback', canonical: 'manual' } },
      KEYS,
    );
    expect(values).toMatchObject({ seoTitle: '', metaDescription: '', ogTitle: '', ogDescription: '', twitterTitle: '', twitterDescription: '' });
    /* A canonical is not judged here: the API clears one that names an old
       address when the record moves. */
    expect(values.canonicalUrl).toBe('/success-stories/from-pune-to-tokyo');
  });

  it('keeps what an editor wrote', () => {
    const values = writtenSeoValues(
      { ...echoed, seoTitle: 'Pune to Tokyo: one student’s year', ogTitle: 'A year in Tokyo', ogDescription: 'Her own words.' },
      { seoTitle: 'Pune to Tokyo: one student’s year', metaDescription: 'It began with a phone call.', source: { title: 'manual', description: 'fallback' } },
      KEYS,
    );
    expect(values.seoTitle).toBe('Pune to Tokyo: one student’s year');
    expect(values.ogTitle).toBe('A year in Tokyo');
    expect(values.twitterTitle).toBe('From Pune to Tokyo');
    expect(values.metaDescription).toBe('');
    expect(values.ogDescription).toBe('Her own words.');
  });

  it('takes the stored values as they are when the API says nothing about them', () => {
    expect(writtenSeoValues(echoed, null, KEYS)).toEqual(echoed);
    expect(writtenSeoValues(echoed, { seoTitle: 'x' }, KEYS)).toEqual(echoed);
    expect(writtenSeoValues(null, { source: { title: 'fallback' } }, KEYS).seoTitle).toBe('');
  });
});
