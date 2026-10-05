import { describe, expect, it } from 'vitest';
import {
  offeringTitle,
  universityDescription,
  universityPageMetadata,
  universityTitle,
} from './university-seo';

/**
 * A university's profile and its courses build their own tab title and
 * description, the way the behaviour reference does, unless an editor
 * wrote one -- and a stored value that only repeats the record's name is
 * not one an editor wrote.
 */

const defaults = {
  seoTitle: 'University of Warwick',
  metaDescription: 'Explore published study-abroad courses on Universta.',
  canonicalUrl: '/universities/university-of-warwick',
  ogTitle: 'University of Warwick',
  ogDescription: 'Explore published study-abroad courses on Universta.',
  twitterTitle: 'University of Warwick',
  twitterDescription: 'Explore published study-abroad courses on Universta.',
  robotsIndex: true,
  robotsFollow: true,
  titleSuffix: '| Universta',
  source: { title: 'fallback', description: 'default' },
};

const build = (seo: Record<string, unknown> | null, names: string[] = []) =>
  universityPageMetadata({
    seo,
    title: universityTitle('University of Warwick'),
    description: 'A research university founded in 1965.',
    canonical: '/universities/university-of-warwick',
    names,
  });

describe('a university page’s title and description', () => {
  it('names what the page covers when nobody wrote a title, and uses the record’s own description', () => {
    const meta = build(defaults);
    expect(meta.title).toEqual({
      absolute: 'University of Warwick | Courses, Fees & Admissions | Universta',
    });
    expect(meta.description).toBe('A research university founded in 1965.');
    expect(meta.openGraph).toMatchObject({
      title: 'University of Warwick | Courses, Fees & Admissions',
      description: 'A research university founded in 1965.',
    });
    expect(meta.twitter).toMatchObject({
      title: 'University of Warwick | Courses, Fees & Admissions',
      description: 'A research university founded in 1965.',
    });
    expect(meta.alternates?.canonical).toMatch(/\/universities\/university-of-warwick$/);
  });

  it('keeps what an editor wrote, one by one or through a bulk rule', () => {
    const manual = build({
      ...defaults,
      seoTitle: 'Warwick for international students',
      metaDescription: 'Written by an editor.',
      ogTitle: 'Shared title',
      source: { title: 'manual', description: 'bulk' },
    });
    expect(manual.title).toEqual({ absolute: 'Warwick for international students | Universta' });
    expect(manual.description).toBe('Written by an editor.');
    expect(manual.openGraph).toMatchObject({ title: 'Shared title' });
  });

  it('treats a stored title that is only the record’s name as unwritten', () => {
    /* The admin saved its prefilled default back as "manual". */
    const meta = build(
      { ...defaults, source: { title: 'manual', description: 'default' } },
      ['University of Warwick'],
    );
    expect(meta.title).toEqual({
      absolute: 'University of Warwick | Courses, Fees & Admissions | Universta',
    });
  });

  it('keeps a sharing card an editor wrote when the title and description are only defaults', () => {
    const meta = build({
      ...defaults,
      ogTitle: 'Warwick, shared',
      ogDescription: 'Written for the card.',
      twitterTitle: 'Warwick, shared',
      twitterDescription: 'Written for the card.',
    });
    expect(meta.title).toEqual({
      absolute: 'University of Warwick | Courses, Fees & Admissions | Universta',
    });
    expect(meta.openGraph).toMatchObject({
      title: 'Warwick, shared',
      description: 'Written for the card.',
    });
    expect(meta.twitter).toMatchObject({
      title: 'Warwick, shared',
      description: 'Written for the card.',
    });
  });

  it('still has a title and description without any SEO record', () => {
    const meta = build(null);
    expect(meta.title).toEqual({
      absolute: 'University of Warwick | Courses, Fees & Admissions | Universta',
    });
    expect(meta.description).toBe('A research university founded in 1965.');
  });

  it('titles a course with its university, as the reference does', () => {
    expect(offeringTitle('MSc Computer Science', 'University of Warwick')).toBe(
      'MSc Computer Science at University of Warwick | Fees, Eligibility & Intakes',
    );
  });
});

describe('a university’s description without its own', () => {
  const uk = { name: 'United Kingdom', iso2Code: 'GB' };

  it('prefers the record’s short description', () => {
    expect(
      universityDescription({
        name: 'University of Warwick',
        shortDescription: '  A research university.  ',
        city: 'Coventry',
        country: uk,
        courses: 2,
      }),
    ).toBe('A research university.');
  });

  it('says where it is and how many courses the catalogue profiles', () => {
    expect(
      universityDescription({
        name: 'University of Warwick',
        shortDescription: null,
        city: 'Coventry',
        country: uk,
        courses: 2,
      }),
    ).toBe(
      'Study at University of Warwick in Coventry, United Kingdom: 2 courses, intakes, entry requirements and visa guidance.',
    );
    expect(
      universityDescription({
        name: 'University of Warwick',
        shortDescription: null,
        city: null,
        country: uk,
        courses: 1,
      }),
    ).toBe(
      'Study at University of Warwick in the United Kingdom: 1 course, intakes, entry requirements and visa guidance.',
    );
  });

  it('claims no courses it does not have', () => {
    expect(
      universityDescription({
        name: 'Lakeside College',
        shortDescription: null,
        city: null,
        country: null,
        courses: 0,
      }),
    ).toBe('Study at Lakeside College: intakes, entry requirements and visa guidance.');
  });
});
