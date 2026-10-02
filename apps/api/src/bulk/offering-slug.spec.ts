import { offeringSlug } from './bulk-resources';

/**
 * A sheet of forty-seven offerings once loaded twenty-nine.
 *
 * The eighteen that vanished were not rejected and did not appear in the
 * error list: `UniversityCourseOffering.slug` is unique across the whole
 * catalogue while its name only has to be unique within one university
 * (`@@unique([universityId, name])`), and the importer derived the slug
 * from the name alone. The second university to teach a programme produced
 * a slug that was already taken, and the row went nowhere.
 *
 * Qualifying the slug with the university is what makes the two rules agree.
 */
describe('offeringSlug', () => {
  it('lets two universities teach the same programme', () => {
    const toronto = offeringSlug('university-of-toronto', 'MSc Data Science');
    const melbourne = offeringSlug('university-of-melbourne', 'MSc Data Science');
    expect(toronto).toBe('university-of-toronto-msc-data-science');
    expect(melbourne).toBe('university-of-melbourne-msc-data-science');
    expect(toronto).not.toBe(melbourne);
  });

  it('does not repeat a university the name already carries', () => {
    /* Operators were told to write "<programme> at <university>" while this
       was broken. Those sheets must not produce the university twice. */
    expect(offeringSlug('oxford', 'Oxford MSc Data Science')).toBe(
      'oxford-msc-data-science',
    );
  });

  it('leaves a name that merely starts with a similar word alone', () => {
    // "oxford-brookes" does not start with "oxford-" as a whole segment of
    // this slug's own making -- it is a different university entirely.
    expect(offeringSlug('oxford-brookes', 'MSc Data Science')).toBe(
      'oxford-brookes-msc-data-science',
    );
  });

  it('falls back to the name when no university is given', () => {
    // The row will fail validation for the missing university anyway; the
    // slug should not throw on the way there.
    expect(offeringSlug(undefined, 'MSc Data Science')).toBe('msc-data-science');
    expect(offeringSlug('', 'MSc Data Science')).toBe('msc-data-science');
  });

  it('collapses a name that is only the university', () => {
    expect(offeringSlug('demo-university', 'Demo University')).toBe(
      'demo-university',
    );
  });

  it('normalises punctuation and case the way every other slug does', () => {
    expect(offeringSlug('St Mary’s University', 'B.A. (Hons) History')).toBe(
      'st-mary-s-university-b-a-hons-history',
    );
  });

  it('keeps distinct programmes at one university distinct', () => {
    const a = offeringSlug('tu-munich', 'MSc Data Science');
    const b = offeringSlug('tu-munich', 'MSc Data Engineering');
    expect(a).not.toBe(b);
  });
});
