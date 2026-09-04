import { describe, expect, it } from 'vitest';
import {
  countryFieldRules,
  fieldErrorsFromServer,
  seoFieldRules,
} from './country-field-rules';

/**
 * These mirror `apps/api/src/countries/dto/country.dto.ts`. A value that passes
 * here must pass there -- the point is to say the same thing the API would, at
 * the moment the field is left, instead of after a round trip that named no
 * field.
 */
describe('country field rules', () => {
  it('accepts the identity a real country is created with', () => {
    expect(countryFieldRules.name('Malta')).toBeNull();
    expect(countryFieldRules.slug('malta')).toBeNull();
    expect(countryFieldRules.iso2Code('MT')).toBeNull();
    expect(countryFieldRules.iso3Code('MLT')).toBeNull();
    expect(countryFieldRules.currencyCode('EUR')).toBeNull();
    expect(countryFieldRules.currencySymbol('€')).toBeNull();
    expect(countryFieldRules.displayOrder('0')).toBeNull();
  });

  it('names the field and the shape it wants', () => {
    expect(countryFieldRules.iso3Code('ML')).toBe(
      'ISO3 must be exactly 3 letters, like MLT.',
    );
    expect(countryFieldRules.iso2Code('MLT')).toBe(
      'ISO2 must be exactly 2 letters, like MT.',
    );
    expect(countryFieldRules.currencyCode('EURO')).toContain('3 letters');
    expect(countryFieldRules.slug('Not A Slug')).toContain('lowercase');
    expect(countryFieldRules.displayOrder('-1')).toContain('0 to 999999');
    expect(countryFieldRules.displayOrder('abc')).toContain('0 to 999999');
  });

  it('reports a missing required field by name', () => {
    expect(countryFieldRules.name('')).toBe('Country name is required.');
    expect(countryFieldRules.slug('   ')).toBe('Slug is required.');
    expect(countryFieldRules.pageHeading('')).toBe('Page heading is required.');
    expect(countryFieldRules.shortDescription('')).toBe(
      'Short description is required.',
    );
  });

  it('leaves an optional field alone until it holds something', () => {
    for (const field of [
      'externalUid',
      'iso2Code',
      'iso3Code',
      'currencyCode',
      'tagline',
      'capitalCity',
    ])
      expect(countryFieldRules[field]('')).toBeNull();
  });

  it('clears once the value is corrected', () => {
    expect(countryFieldRules.iso3Code('ML')).not.toBeNull();
    expect(countryFieldRules.iso3Code('MLT')).toBeNull();
  });

  it('carries the canonical rule the API already enforces', () => {
    expect(seoFieldRules.canonicalUrl('/countries/malta')).toBeNull();
    expect(seoFieldRules.canonicalUrl('abc xyz')).toContain('site path');
  });
});

describe('fieldErrorsFromServer', () => {
  it('routes a readiness failure back to the fields it names', () => {
    expect(
      fieldErrorsFromServer({
        code: 'COUNTRY_NOT_READY',
        details: [
          { field: 'iso2Code', code: 'REQUIRED', message: 'ISO alpha-2 code is required' },
          { field: 'iso3Code', code: 'REQUIRED', message: 'ISO alpha-3 code is required' },
        ],
      }),
    ).toEqual({
      iso2Code: 'ISO alpha-2 code is required',
      iso3Code: 'ISO alpha-3 code is required',
    });
  });

  it('routes a conflict to the field that conflicts', () => {
    expect(fieldErrorsFromServer({ code: 'COUNTRY_SLUG_CONFLICT' })).toEqual({
      slug: 'That slug is already used by another country.',
    });
    expect(fieldErrorsFromServer({ code: 'COUNTRY_CODE_CONFLICT' })).toEqual({
      iso2Code: 'That ISO code is already used by another country.',
    });
  });

  it('leaves a genuine system failure to the banner', () => {
    expect(fieldErrorsFromServer({ code: 'CATALOG_SERVICE_UNAVAILABLE' })).toEqual(
      {},
    );
    expect(fieldErrorsFromServer(new Error('network down'))).toEqual({});
  });
});
