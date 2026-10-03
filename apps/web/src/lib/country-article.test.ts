import { describe, expect, it } from 'vitest';
import { inCountry } from './country-article';

/**
 * Every heading on a destination page read "Study in United Kingdom".
 *
 * A handful of country names take the definite article and the rest do not,
 * which is a list rather than a rule -- "the Germany" is as wrong in the
 * other direction.
 */
describe('a country name inside a sentence', () => {
  it.each([
    ['United Kingdom', 'GB'],
    ['United States', 'US'],
    ['Netherlands', 'NL'],
    ['Philippines', 'PH'],
    ['United Arab Emirates', 'AE'],
  ])('puts "the" in front of %s', (name, code) => {
    expect(inCountry(name, code)).toBe(`the ${name}`);
  });

  it.each([
    ['Germany', 'DE'],
    ['Canada', 'CA'],
    ['Australia', 'AU'],
    ['India', 'IN'],
    ['France', 'FR'],
  ])('leaves %s alone', (name, code) => {
    expect(inCountry(name, code)).toBe(name);
  });

  it('recognises the name when the code is missing', () => {
    expect(inCountry('Netherlands')).toBe('the Netherlands');
    expect(inCountry('Japan')).toBe('Japan');
  });

  it('trusts the code over the spelling, which editors vary', () => {
    expect(inCountry('Britain', 'GB')).toBe('the Britain');
    expect(inCountry('USA', 'US')).toBe('the USA');
  });

  it('does not add a second one', () => {
    expect(inCountry('The Gambia', 'GM')).toBe('The Gambia');
    expect(inCountry('the Netherlands', 'NL')).toBe('the Netherlands');
  });
});
