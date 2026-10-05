import { describe, expect, it } from 'vitest';
import { matchCount, searchSubjectIndex } from './subject-index-search';

const branch = (name: string) => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
});

const subjects = [
  {
    id: 'cs',
    name: 'Computer Science',
    slug: 'computer-science',
    subSubjects: [branch('Software Engineering'), branch('Artificial Intelligence')],
  },
  {
    id: 'eng',
    name: 'Engineering',
    slug: 'engineering',
    subSubjects: [branch('Software Engineering'), branch('Civil Engineering')],
  },
  {
    id: 'sci',
    name: 'Natural Sciences',
    slug: 'natural-sciences',
    subSubjects: [branch('Physics')],
  },
];

describe('the subjects explorer’s search', () => {
  it('keeps a subject for a specialization it teaches, showing that pill alone', () => {
    const result = searchSubjectIndex(subjects, 'software');
    expect(result.rows.map((row) => row.subject.id)).toEqual(['cs', 'eng']);
    expect(result.rows[0].specs.map((spec) => spec.name)).toEqual(['Software Engineering']);
  });

  it('answers a specialization search with the specializations, not "none found"', () => {
    const result = searchSubjectIndex(subjects, 'software');
    expect(result.subjects).toEqual([]);
    expect(result.specializations.map((row) => `${row.spec.name} / ${row.subject.name}`)).toEqual([
      'Software Engineering / Computer Science',
      'Software Engineering / Engineering',
    ]);
    expect(result.matches).toBe(2);
  });

  it('keeps every pill on a subject matched by its own name', () => {
    const result = searchSubjectIndex(subjects, 'engineering');
    const eng = result.rows.find((row) => row.subject.id === 'eng');
    expect(eng?.specs).toHaveLength(2);
    /* Engineering itself, and three branches with "Engineering" in them. */
    expect(result.matches).toBe(4);
  });

  it('matches from the start of a word, as the country search does', () => {
    expect(searchSubjectIndex(subjects, 'ience').rows).toEqual([]);
    expect(searchSubjectIndex(subjects, 'sci comp').rows.map((row) => row.subject.id)).toEqual([
      'cs',
    ]);
  });

  it('shows everything, and counts nothing, with no term', () => {
    const result = searchSubjectIndex(subjects, '  ');
    expect(result.rows).toHaveLength(3);
    expect(result.searching).toBe(false);
    expect(result.matches).toBe(0);
  });

  it('finds nothing for a term nothing answers', () => {
    const result = searchSubjectIndex(subjects, 'xyzq');
    expect(result.rows).toEqual([]);
    expect(result.matches).toBe(0);
    expect(result.searching).toBe(true);
  });

  it('says its count in words', () => {
    expect(matchCount(1)).toBe('1 match');
    expect(matchCount(4)).toBe('4 matches');
  });
});
