import { describe, expect, it } from 'vitest';
import {
  LEVEL_PAGE_MIN_PROGRAMMES,
  levelPageDescription,
  levelPageIndexable,
  specializationsAtLevel,
  withArticle,
} from './level-page';

const indexable = (over: Partial<Parameters<typeof levelPageIndexable>[0]> = {}) =>
  levelPageIndexable({
    narrowed: false,
    claimed: true,
    robots: [true, true, undefined],
    programmes: 9,
    ownContent: false,
    ...over,
  });

describe('whether a level page is indexed', () => {
  it('indexes at three published programmes and not at two', () => {
    expect(LEVEL_PAGE_MIN_PROGRAMMES).toBe(3);
    expect(indexable({ programmes: 3 })).toBe(true);
    expect(indexable({ programmes: 2 })).toBe(false);
    expect(indexable({ programmes: 0 })).toBe(false);
  });

  it('keeps a page whose programmes could not be read out, until the next crawl', () => {
    expect(indexable({ programmes: null })).toBe(false);
  });

  it('keeps a narrowed address out, however much it lists', () => {
    expect(indexable({ narrowed: true, programmes: 50 })).toBe(false);
    expect(indexable({ narrowed: true, ownContent: true })).toBe(false);
  });

  it.each([0, 1, 2])('lets robots=false win from any of the three records (%i)', (at) => {
    const robots: Array<boolean | null | undefined> = [true, null, undefined];
    robots[at] = false;
    expect(indexable({ robots, programmes: 50, ownContent: true })).toBe(false);
  });

  it('keeps the six levels of a field offered at nothing out', () => {
    expect(indexable({ claimed: false, programmes: 50 })).toBe(false);
    expect(indexable({ claimed: false, ownContent: true })).toBe(false);
  });

  it('indexes a page with words of its own whatever is listed', () => {
    expect(indexable({ programmes: 0, ownContent: true })).toBe(true);
    expect(indexable({ programmes: null, ownContent: true })).toBe(true);
  });
});

describe('a level page’s description', () => {
  it('counts what the page lists', () => {
    expect(
      levelPageDescription({
        level: "Bachelor's",
        field: 'Computing',
        summary: { programmes: 1234, universities: 3, countries: 2 },
      }),
    ).toBe(
      "Compare 1,234 programmes for Bachelor's in Computing at 3 universities in 2 destinations, with the fees, intakes and entry requirements each one lists.",
    );
  });

  it('says one in the singular', () => {
    expect(
      levelPageDescription({
        level: 'PhD',
        field: 'AI',
        summary: { programmes: 1, universities: 1, countries: 1 },
      }),
    ).toBe('Compare 1 programme for PhD in AI at 1 university in 1 destination, with the fees, intakes and entry requirements each one lists.');
  });

  it('leaves out the universities and destinations it has not counted', () => {
    expect(
      levelPageDescription({ level: 'PhD', field: 'AI', summary: { programmes: 4, universities: 0, countries: 0 } }),
    ).toBe('Compare 4 programmes for PhD in AI, with the fees, intakes and entry requirements each one lists.');
  });

  it('promises no fees where nothing is listed', () => {
    const none = levelPageDescription({
      level: "Bachelor's",
      field: 'Computing',
      summary: { programmes: 0, universities: 0, countries: 0 },
    });
    expect(none).toBe(
      "No Bachelor's programme in Computing is listed on Universta yet. See Computing at the levels it is offered at.",
    );
    expect(none).not.toContain('fees');
  });

  it('promises no programmes where they could not be read', () => {
    const unread = levelPageDescription({ level: "Master's", field: 'Law', summary: null });
    expect(unread).toBe("Study Master's in Law abroad with Universta.");
    expect(unread).not.toMatch(/\d/);
  });
});

describe('the specializations at one level', () => {
  const UG = { code: 'UG' };
  const PG = { code: 'PG' };
  const branches = [
    { id: 'web', name: 'Web', slug: 'web', levels: [UG] },
    { id: 'ai', name: 'AI', slug: 'ai', levels: [UG, PG] },
    { id: 'law', name: 'Law Tech', slug: 'law-tech', levels: [PG] },
    { id: 'bare', name: 'Bare', slug: 'bare', levels: [] },
    { id: 'none', name: 'None', slug: 'none', levels: null },
    { id: 'cs', name: 'Computer Science', slug: 'computer-science', levels: [{ code: 'ug' }] },
  ];

  it('keeps only the branches offered at the level, and leaves out the one being read', () => {
    expect(specializationsAtLevel(branches, 'UG', { except: 'web' }).map((row) => row.slug)).toEqual([
      'ai',
      'computer-science',
    ]);
  });

  it('puts the ones with programmes first, most first, and prints no nought', () => {
    const counts = new Map([['web', 2], ['computer-science', 6], ['ai', 0]]);
    expect(specializationsAtLevel(branches, 'UG', { counts }).map((row) => [row.slug, row.count])).toEqual([
      ['computer-science', 6],
      ['web', 2],
      ['ai', undefined],
    ]);
  });

  it('orders by name and counts nothing when there are no counts', () => {
    expect(specializationsAtLevel(branches, 'UG').map((row) => [row.name, row.count])).toEqual([
      ['AI', undefined],
      ['Computer Science', undefined],
      ['Web', undefined],
    ]);
  });

  it('has none for no branches', () => {
    expect(specializationsAtLevel(null, 'UG')).toEqual([]);
    expect(specializationsAtLevel(undefined, 'UG')).toEqual([]);
  });
});

/* "Why study an MBA in Finance?": the article the level's name is read
   with, said aloud -- an initialism letter by letter, a word by its sound. */
describe('a level’s name with its article', () => {
  it.each([
    ['MBA', 'an MBA'],
    ["Master's", "a Master's"],
    ['PhD', 'a PhD'],
    ["Bachelor's", "a Bachelor's"],
    ['Diploma', 'a Diploma'],
    ['Foundation', 'a Foundation'],
    ['Pathway', 'a Pathway'],
    ['MSc', 'an MSc'],
    ['HND', 'an HND'],
    ['LLM', 'an LLM'],
    ['Undergraduate Certificate', 'an Undergraduate Certificate'],
    ['University Diploma', 'a University Diploma'],
    ['Honours degree', 'an Honours degree'],
    ['Associate degree', 'an Associate degree'],
  ])('reads %s as “%s”', (name, read) => {
    expect(withArticle(name)).toBe(read);
  });

  it('trims the name, and has nothing for no name', () => {
    expect(withArticle('  MBA ')).toBe('an MBA');
    expect(withArticle('  ')).toBe('');
  });
});
