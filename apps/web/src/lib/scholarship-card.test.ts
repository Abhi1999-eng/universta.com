import { describe, expect, it } from 'vitest';
import {
  awardLabel,
  benefitLabel,
  deadlineLabel,
  eligibilitySnippet,
  toScholarshipCard,
  toScholarshipCards,
} from './scholarship-card';

describe('benefitLabel', () => {
  it('reads a stored constant as a sentence', () => {
    expect(benefitLabel('PARTIAL_TUITION')).toBe('Partial tuition');
    expect(benefitLabel('FULL_TUITION')).toBe('Full tuition');
  });

  it('leaves free text alone beyond its first letter', () => {
    expect(benefitLabel('living stipend')).toBe('Living stipend');
  });

  it('has nothing to say for an empty column', () => {
    expect(benefitLabel(null)).toBeNull();
    expect(benefitLabel('   ')).toBeNull();
    expect(benefitLabel(undefined)).toBeNull();
  });
});

describe('awardLabel', () => {
  it('prefixes the figure with the currency the record states', () => {
    expect(awardLabel('12000.00', 'EUR')).toBe('EUR 12,000');
  });

  it('keeps a part-currency figure rather than rounding it away', () => {
    expect(awardLabel('2500.50', 'GBP')).toBe('GBP 2,500.5');
  });

  it('prints the figure even where no currency is recorded', () => {
    // Thin, but it is what the record says. Hiding it would be thinner.
    expect(awardLabel(5000, null)).toBe('5,000');
  });

  it('treats zero as a field nobody filled in, not an award of nothing', () => {
    expect(awardLabel('0.00', 'EUR')).toBeNull();
    expect(awardLabel(0, 'EUR')).toBeNull();
  });

  it('refuses a negative or unreadable amount', () => {
    expect(awardLabel('-500', 'EUR')).toBeNull();
    expect(awardLabel('not a number', 'EUR')).toBeNull();
    expect(awardLabel(null, 'EUR')).toBeNull();
  });

  it('upper-cases a lower-cased currency code', () => {
    expect(awardLabel('1000', 'eur')).toBe('EUR 1,000');
  });
});

describe('deadlineLabel', () => {
  it('formats the stored date in UTC', () => {
    expect(deadlineLabel('2027-01-15')).toBe('15 Jan 2027');
  });

  it('prints a date that has already passed', () => {
    /* Whether a deadline is still open is the finder's filter. Deriving it
       here would read the clock during render and let the server's HTML and
       the client's hydration disagree. */
    expect(deadlineLabel('2001-03-01')).toBe('1 Mar 2001');
  });

  it('says nothing rather than "Invalid Date"', () => {
    expect(deadlineLabel('whenever')).toBeNull();
    expect(deadlineLabel('')).toBeNull();
    expect(deadlineLabel(null)).toBeNull();
  });
});

describe('eligibilitySnippet', () => {
  it('takes the words out of authored rich text', () => {
    expect(
      eligibilitySnippet('<p>Open to <strong>international</strong> students.</p>'),
    ).toBe('Open to international students.');
  });

  it('leaves a short line whole', () => {
    expect(eligibilitySnippet('Indian nationals under 30.')).toBe(
      'Indian nationals under 30.',
    );
  });

  it('cuts a long line at a word boundary', () => {
    const long = `${'eligible '.repeat(40)}end`;
    const snippet = eligibilitySnippet(long);
    expect(snippet).not.toBeNull();
    expect(snippet!.endsWith('…')).toBe(true);
    // No word is left broken in half.
    expect(snippet!.slice(0, -1).trim().split(' ').pop()).toBe('eligible');
  });

  it('does not leave a dangling comma before the ellipsis', () => {
    const snippet = eligibilitySnippet(`${'word '.repeat(35)}tail, more words here`);
    expect(snippet!.includes(',…')).toBe(false);
  });

  it('has nothing to say for markup that carries no words', () => {
    expect(eligibilitySnippet('<p></p>')).toBeNull();
    expect(eligibilitySnippet(null)).toBeNull();
  });
});

const row = {
  id: 'sch-1',
  title: 'Global Excellence Award',
  slug: 'global-excellence-award',
  summary: 'For high-achieving international applicants.',
  benefitType: 'PARTIAL_TUITION',
  amount: '7500.00',
  currencyCode: 'EUR',
  deadline: '2027-03-31',
  eligibility: '<p>Minimum 70% in the qualifying degree.</p>',
  provider: { name: 'Ministry of Education' },
  countries: [{ country: { name: 'Germany', slug: 'germany', iso2Code: 'DE' } }],
  universities: [{ university: { name: 'TU Munich', slug: 'tu-munich' } }],
};

describe('toScholarshipCard', () => {
  it('carries every line the record holds', () => {
    expect(toScholarshipCard(row)).toEqual({
      id: 'sch-1',
      title: 'Global Excellence Award',
      slug: 'global-excellence-award',
      summary: 'For high-achieving international applicants.',
      provider: 'Ministry of Education',
      benefit: 'Partial tuition',
      award: 'EUR 7,500',
      deadline: '31 Mar 2027',
      eligibility: 'Minimum 70% in the qualifying degree.',
      countries: [{ name: 'Germany', slug: 'germany', iso2: 'DE' }],
      universities: [{ name: 'TU Munich', slug: 'tu-munich' }],
    });
  });

  it('leaves the lines a sparse record does not fill empty', () => {
    const card = toScholarshipCard({ title: 'Bare award', slug: 'bare-award' });
    expect(card).toMatchObject({
      title: 'Bare award',
      summary: null,
      provider: null,
      benefit: null,
      award: null,
      deadline: null,
      eligibility: null,
      countries: [],
      universities: [],
    });
  });

  it('falls back to the id-less row’s slug for a key', () => {
    expect(toScholarshipCard({ title: 'A', slug: 'a' })?.id).toBe('a');
  });

  it('accepts a row that names itself rather than titles itself', () => {
    // Some list endpoints hand back `name` where the model stores `title`.
    expect(toScholarshipCard({ name: 'Named award', slug: 'named' })?.title).toBe(
      'Named award',
    );
  });

  it('drops a row with no page to link to', () => {
    expect(toScholarshipCard({ title: 'No slug' })).toBeNull();
    expect(toScholarshipCard({ slug: 'no-title' })).toBeNull();
    expect(toScholarshipCard(null)).toBeNull();
    expect(toScholarshipCard('a string')).toBeNull();
  });

  it('skips a link whose far side is missing', () => {
    const card = toScholarshipCard({
      ...row,
      countries: [{ country: null }, { country: { name: 'Ireland', slug: 'ireland' } }],
    });
    expect(card?.countries).toEqual([
      { name: 'Ireland', slug: 'ireland', iso2: null },
    ]);
  });
});

describe('toScholarshipCards', () => {
  it('keeps the linkable rows and drops the rest', () => {
    expect(toScholarshipCards([row, { title: 'No slug' }, null]).map((c) => c.slug)).toEqual([
      'global-excellence-award',
    ]);
  });

  it('answers an empty list for anything that is not one', () => {
    expect(toScholarshipCards(undefined)).toEqual([]);
    expect(toScholarshipCards({})).toEqual([]);
  });
});
