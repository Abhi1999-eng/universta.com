import { describe, expect, it } from 'vitest';
import {
  activeChips,
  activeFilterCount,
  commitHref,
  draftFromFilters,
  dropHref,
  hasValue,
  stagedCountQuery,
  toggleValue,
} from './country-filters';

/**
 * The listing's filters are a shareable address. Refresh, Back, Forward and a
 * pasted link all work for the same reason: the URL is the only place the state
 * lives. These cover the round trip in both directions -- what a URL means for
 * the controls, and what a control change means for the URL.
 */
describe('country discovery filter state', () => {
  describe('reading the URL', () => {
    it('seeds every control from the query string', () => {
      const draft = draftFromFilters({
        subjects: 'engineering,nursing',
        intakes: 'september',
        ieltsMax: '6.5',
        postStudyWork: 'true',
      });
      expect(draft.subjects).toBe('engineering,nursing');
      expect(draft.intakes).toBe('september');
      expect(draft.ieltsMax).toBe('6.5');
      expect(draft.postStudyWork).toBe('true');
      // Anything absent is simply empty, never undefined.
      expect(draft.universitiesMin).toBe('');
    });

    it('counts a group by its values, the way a visitor reads them', () => {
      expect(activeFilterCount({ subjects: 'engineering,nursing' })).toBe(2);
      expect(
        activeFilterCount({ subjects: 'engineering', ieltsMax: '6.5' }),
      ).toBe(2);
      // Sorting and paging are not filters.
      expect(activeFilterCount({ sort: 'tuition', page: '2' })).toBe(0);
    });
  });

  describe('OR within a group', () => {
    it('adds and removes values without disturbing the rest', () => {
      expect(toggleValue('', 'engineering')).toBe('engineering');
      expect(toggleValue('engineering', 'nursing')).toBe('engineering,nursing');
      expect(toggleValue('engineering,nursing', 'engineering')).toBe('nursing');
      expect(toggleValue('engineering', 'engineering')).toBe('');
    });

    it('reports membership exactly', () => {
      expect(hasValue('engineering,nursing', 'nursing')).toBe(true);
      expect(hasValue('engineering,nursing', 'nurse')).toBe(false);
      expect(hasValue('', 'engineering')).toBe(false);
    });
  });

  describe('writing the URL', () => {
    it('applies staged choices and keeps what was already there', () => {
      const href = commitHref('/countries', 'region=europe', {
        subjects: 'engineering,nursing',
        ieltsMax: '6.5',
      });
      expect(href).toContain('region=europe');
      expect(decodeURIComponent(href)).toContain('subjects=engineering,nursing');
      expect(href).toContain('ieltsMax=6.5');
    });

    it('restarts paging, because page 3 of the old results means nothing', () => {
      expect(
        commitHref('/countries', 'page=3&region=europe', { ieltsMax: '6.0' }),
      ).not.toContain('page=');
    });

    it('drops a filter when its value is cleared', () => {
      const href = commitHref('/countries', 'ieltsMax=6.5&region=europe', {
        ieltsMax: null,
      });
      expect(href).not.toContain('ieltsMax');
      expect(href).toContain('region=europe');
    });

    it('returns the bare listing address once nothing is left', () => {
      expect(commitHref('/countries', 'ieltsMax=6.5', { ieltsMax: null })).toBe(
        '/countries#regions',
      );
    });
  });

  describe('removing one filter', () => {
    it('takes one value out of a group and leaves the others', () => {
      const href = dropHref(
        '/countries',
        'subjects=engineering,nursing',
        'subjects',
        'engineering',
      );
      expect(decodeURIComponent(href)).toContain('subjects=nursing');
      expect(href).not.toContain('engineering');
    });

    it('removes the group entirely when its last value goes', () => {
      expect(
        dropHref('/countries', 'subjects=engineering', 'subjects', 'engineering'),
      ).toBe('/countries#regions');
    });

    it('takes the amounts with the currency that gave them meaning', () => {
      const href = dropHref(
        '/countries',
        'currency=EUR&tuitionMax=9000&livingMax=800&region=europe',
        'currency',
      );
      expect(href).not.toContain('tuitionMax');
      expect(href).not.toContain('livingMax');
      expect(href).not.toContain('currency');
      // Unrelated filters are untouched.
      expect(href).toContain('region=europe');
    });

    it('restarts paging', () => {
      expect(
        dropHref('/countries', 'ieltsMax=6.5&page=4', 'ieltsMax'),
      ).not.toContain('page=');
    });
  });

  describe('the chips a visitor sees', () => {
    it('names each applied filter in readable terms', () => {
      const chips = activeChips(
        {
          subjects: 'engineering,nursing',
          intakes: 'september',
          ieltsMax: '6.5',
          postStudyWork: 'true',
          partTimeWork: 'true',
          applicationFee: 'none',
          universitiesMin: '3',
          currency: 'EUR',
          tuitionMax: '9000',
        },
        {
          subjects: new Map([
            ['engineering', 'Engineering'],
            ['nursing', 'Nursing'],
          ]),
          intakes: new Map([['september', 'September']]),
        },
      );
      expect(chips.map((chip) => chip.label)).toEqual([
        'Engineering',
        'Nursing',
        'September intake',
        'IELTS ≤ 6.5',
        'In EUR',
        'Tuition ≤ 9000',
        'Post-study work',
        'Work while studying',
        'No application fee',
        '3+ universities',
      ]);
    });

    it('falls back to the slug when a name is not to hand', () => {
      const [chip] = activeChips({ subjects: 'engineering' });
      expect(chip.label).toBe('engineering');
    });

    it('distinguishes the negative choices', () => {
      const chips = activeChips({
        postStudyWork: 'false',
        partTimeWork: 'false',
        applicationFee: 'any',
      });
      expect(chips.map((chip) => chip.label)).toEqual([
        'No post-study work',
        'No work while studying',
        'Has application fee',
      ]);
    });

    it('shows nothing when nothing is applied', () => {
      expect(activeChips({ sort: 'tuition', page: '2' })).toEqual([]);
    });

    it('carries the value, so removing one chip removes one value', () => {
      const chips = activeChips({ subjects: 'engineering,nursing' });
      expect(chips.map((chip) => chip.value)).toEqual([
        'engineering',
        'nursing',
      ]);
    });
  });

  describe('the staged count query', () => {
    it('asks about the set the visitor is about to see', () => {
      const query = stagedCountQuery(
        { q: 'pol', region: 'europe' },
        draftFromFilters({ subjects: 'engineering', ieltsMax: '6.5' }),
      );
      const params = new URLSearchParams(query);
      expect(params.get('q')).toBe('pol');
      // `region` is the shareable public name for what the API calls continent.
      expect(params.get('continent')).toBe('europe');
      expect(params.get('subjects')).toBe('engineering');
      expect(params.get('ieltsMax')).toBe('6.5');
    });

    it('never carries an Admin tag', () => {
      const query = stagedCountQuery(
        { tagId: 'tag-1', region: 'europe' },
        draftFromFilters({}),
      );
      expect(query).not.toContain('tag');
    });
  });
});
