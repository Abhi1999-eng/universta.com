import { describe, expect, it } from 'vitest';
import { relatedSubjects } from './related-subjects';

const subject = (id: string, branches: string[]) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  slug: id,
  subSubjects: branches.map((name) => ({ name })),
});

const business = subject('business', ['Finance', 'Marketing', 'Data & Analytics', 'Law']);
const all = [
  business,
  subject('economics', ['Finance', 'Econometrics', 'Data and Analytics']),
  subject('law', ['Law', 'Human Rights']),
  subject('art', ['Painting']),
  subject('accounting', ['Finance']),
];

describe('a subject’s related subjects', () => {
  it('are the ones that share a specialization, most shared first', () => {
    const related = relatedSubjects(business, all);
    expect(related.map((row) => row.slug)).toEqual(['economics', 'accounting', 'law']);
    expect(related.map((row) => row.shared)).toEqual([2, 1, 1]);
  });

  it('match a branch whatever its punctuation and case', () => {
    const [economics] = relatedSubjects(business, all);
    /* "Data & Analytics" and "Data and Analytics" are one branch. */
    expect(economics.shared).toBe(2);
  });

  it('never include the subject itself, nor one sharing nothing', () => {
    const slugs = relatedSubjects(business, all).map((row) => row.slug);
    expect(slugs).not.toContain('business');
    expect(slugs).not.toContain('art');
  });

  it('stop at the limit', () => {
    expect(relatedSubjects(business, all, 1).map((row) => row.slug)).toEqual(['economics']);
  });

  it('are none for a subject with no specializations', () => {
    expect(relatedSubjects(subject('empty', []), all)).toEqual([]);
  });
});
