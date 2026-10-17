import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  blankUnifiedSeo,
  canonicalInputError,
  seoDraftFromRecord,
  unifiedSeoConfigured,
  UnifiedSeoFields,
  type UnifiedSeoDraft,
} from './UnifiedSeoFields';
import type { EditorialSeo } from '@/features/catalog/catalog.types';

describe('canonicalInputError', () => {
  it.each(['/countries/qa-country', 'https://example.com/countries/qa-country', 'http://example.com/countries/qa-country', ''])('accepts supported canonical input %s', (value) => {
    expect(canonicalInputError(value)).toBeNull();
  });

  it.each(['abc xyz', 'javascript:alert(1)', 'data:text/plain,test', '//evil.example/path', 'https://example.com/a b', '/countries/a b'])('rejects unsupported canonical input %s', (value) => {
    expect(canonicalInputError(value)).toContain('site path');
  });
});

describe('unifiedSeoConfigured', () => {
  it('is false for the blank form, whatever the robots ticks say', () => {
    expect(unifiedSeoConfigured(blankUnifiedSeo)).toBe(false);
    expect(unifiedSeoConfigured({ ...blankUnifiedSeo, robotsIndex: false, robotsFollow: false })).toBe(false);
    expect(unifiedSeoConfigured({ ...blankUnifiedSeo, seoTitle: '   ' })).toBe(false);
  });

  it('is true once any one field is written, an image included', () => {
    expect(unifiedSeoConfigured({ ...blankUnifiedSeo, ogMediaId: 'media-1' })).toBe(true);
    expect(unifiedSeoConfigured({ ...blankUnifiedSeo, focusKeyword: 'masters' })).toBe(true);
    expect(unifiedSeoConfigured({ ...blankUnifiedSeo, twitterMediaId: 'media-2' })).toBe(true);
  });
});

describe('seoDraftFromRecord', () => {
  it('gives the blank form for no record', () => {
    expect(seoDraftFromRecord(null)).toEqual(blankUnifiedSeo);
  });

  it('turns nulls into empty fields and keeps the robots ticks and images', () => {
    const record = {
      id: 'seo-1', ownerType: 'SUBJECT_LEVEL_PAGE', ownerId: 'page-1',
      seoTitle: "Master's in Computing", metaDescription: 'Study it.',
      canonicalUrl: null, focusKeyword: null, ogTitle: null, ogDescription: null, ogMediaId: 'media-1',
      twitterTitle: null, twitterDescription: null, twitterMediaId: null,
      robotsIndex: false, robotsFollow: true, schemaJson: null, hreflangJson: null,
      ogMedia: null, twitterMedia: null, createdAt: 'c', updatedAt: 'u',
    } satisfies EditorialSeo;
    expect(seoDraftFromRecord(record)).toEqual<UnifiedSeoDraft>({
      ...blankUnifiedSeo,
      seoTitle: "Master's in Computing",
      metaDescription: 'Study it.',
      ogMediaId: 'media-1',
      robotsIndex: false,
      robotsFollow: true,
    });
  });
});

describe('UnifiedSeoFields', () => {
  const draw = (props: { value?: UnifiedSeoDraft; note?: string; noun?: string }) =>
    render(createElement(UnifiedSeoFields, { value: props.value ?? blankUnifiedSeo, onChange: () => undefined, media: [], note: props.note, noun: props.noun }));

  it('shows a note of its own when it is given one', () => {
    draw({ note: 'Leave blank to use the Study level pages template under SEO management > Bulk SEO.' });
    expect(screen.getByText('Leave blank to use the Study level pages template under SEO management > Bulk SEO.')).toBeInTheDocument();
  });

  /* Every editor's alert used to say "this Country". */
  it('names the record it belongs to in the required-fields alert', () => {
    draw({ value: { ...blankUnifiedSeo, focusKeyword: 'masters' }, noun: 'level page' });
    expect(screen.getByRole('alert')).toHaveTextContent('SEO title and Meta description are required before this level page can be saved.');
  });

  it('still says Country where no noun is given', () => {
    draw({ value: { ...blankUnifiedSeo, focusKeyword: 'canada' } });
    expect(screen.getByRole('alert')).toHaveTextContent('before this Country can be saved.');
  });
});
