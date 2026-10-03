import { describe, expect, it } from 'vitest';
import { countrySubjectPage, rankSpecializations } from './country-subject';

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
