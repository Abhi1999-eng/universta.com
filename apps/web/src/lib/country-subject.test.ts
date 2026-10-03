import { describe, expect, it } from 'vitest';
import {
  countrySubjectPage,
  rankSpecializations,
  subjectsForCountry,
} from './country-subject';

const spec = (name: string, slug: string, publishedCourseCount = 0) => ({
  id: slug,
  name,
  slug,
  publishedCourseCount,
});

describe('specializations on a destination-and-subject page', () => {
  it('puts the ones with programmes first, deepest first', () => {
    const order = rankSpecializations([
      spec('Applied Systems', 'applied-systems', 0),
      spec('Civil Engineering', 'civil', 7),
      spec('Mechanical Engineering', 'mechanical', 8),
    ]).map((row) => row.slug);
    expect(order).toEqual(['mechanical', 'civil', 'applied-systems']);
  });

  it('keeps the empty ones, alphabetically, rather than hiding them', () => {
    // The catalogue covering a field unevenly is a fact about the catalogue.
    const order = rankSpecializations([
      spec('Zoology', 'zoology'),
      spec('Agronomy', 'agronomy'),
    ]).map((row) => row.slug);
    expect(order).toEqual(['agronomy', 'zoology']);
  });
});

describe('the other subjects offered beside it', () => {
  const others = [
    { id: '1', name: 'Engineering', slug: 'engineering' },
    { id: '2', name: 'Law', slug: 'law' },
    { id: '3', name: 'Medicine', slug: 'medicine' },
  ];

  it('never offers the subject the reader is already on', () => {
    const view = countrySubjectPage({
      specializations: [],
      others,
      subjectSlug: 'engineering',
    });
    expect(view.others.map((row) => row.slug)).toEqual(['law', 'medicine']);
  });

  it('stops at eight, because this is a footer and not a listing', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      name: `Subject ${index}`,
      slug: `subject-${index}`,
    }));
    const view = countrySubjectPage({
      specializations: [],
      others: many,
      subjectSlug: 'none-of-them',
    });
    expect(view.others).toHaveLength(8);
  });
});

describe('which subjects a destination shows', () => {
  const linked = [{ id: '1', name: 'Engineering', slug: 'engineering' }];
  const catalogue = [
    { id: '1', name: 'Engineering', slug: 'engineering' },
    { id: '2', name: 'Law', slug: 'law' },
    { id: '3', name: 'Medicine', slug: 'medicine' },
  ];

  it('shows its own when it has them', () => {
    const view = subjectsForCountry({ linked, catalogue });
    expect(view.subjects.map((row) => row.slug)).toEqual(['engineering']);
    expect(view.listed).toBe(true);
  });

  it('falls back to the catalogue rather than showing nothing', () => {
    // A destination with no courses yet is not a destination with no fields.
    const view = subjectsForCountry({ linked: [], catalogue });
    expect(view.subjects).toHaveLength(3);
    expect(view.listed).toBe(false);
  });

  it('still has nothing to show when the catalogue is empty too', () => {
    const view = subjectsForCountry({ linked: [], catalogue: [] });
    expect(view.subjects).toEqual([]);
    expect(view.listed).toBe(false);
  });
});
