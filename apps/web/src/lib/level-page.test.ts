import { describe, expect, it } from 'vitest';
import {
  LEVEL_PAGE_MIN_PROGRAMMES,
  levelPageDescription,
  levelPageIndexable,
  levelPlanLinks,
  specializationsAtLevel,
  subjectsAtLevel,
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

describe('the links to plan a level', () => {
  it('names the site’s pages for the level in the order a reader plans one', () => {
    expect(levelPlanLinks({ level: { code: 'PG', name: "Master's" }, subject: 'law', from: '/subjects/law/masters' })).toEqual([
      { key: 'programmes', label: "Find Master's programmes", href: '/courses?level=PG' },
      { key: 'scholarships', label: 'Find scholarships', href: '/scholarships?degreeLevel=PG#scholarships' },
      { key: 'universities', label: 'Browse universities', href: '/universities' },
      { key: 'destinations', label: 'Compare study destinations', href: '/study-abroad' },
      { key: 'counselling', label: 'Free counselling', href: '/counselling?source=subject&subject=law&from=%2Fsubjects%2Flaw%2Fmasters' },
    ]);
  });

  it('asks counselling about the specialization where there is one, and takes the level by its code', () => {
    const links = levelPlanLinks({ level: { code: 'mba', name: 'MBA' }, subject: 'business', specialization: 'finance', from: '/subjects/business/finance/mba' });
    expect(links.map((link) => link.href)).toEqual([
      '/courses?level=MBA',
      '/scholarships?degreeLevel=MBA#scholarships',
      '/universities',
      '/study-abroad',
      '/counselling?source=specialization&subject=business&specialization=finance&from=%2Fsubjects%2Fbusiness%2Ffinance%2Fmba',
    ]);
  });
});

describe('the other subjects at one level', () => {
  const UG = { code: 'UG', name: "Bachelor's" };
  const PG = { code: 'PG', name: "Master's" };
  const catalogue = ['FOUNDATION', 'UG', 'PG', 'MBA'].map((code) => ({ code }));
  const rows = [
    { id: 'computing', slug: 'computing', name: 'Computing', levels: [UG, PG] },
    { id: 'law', slug: 'law', name: 'Law', levels: [PG, UG] },
    /* Offered at nothing: shown at six levels, claiming none. */
    { id: 'art', slug: 'art', name: 'Art', levels: [] },
    { id: 'none', slug: 'none', name: 'None', levels: null },
    { id: 'music', slug: 'music', name: 'Music', levels: [{ code: 'ug', name: "Bachelor's" }] },
    /* At a level switched off in Admin alone: offered at nothing. */
    { id: 'old', slug: 'old', name: 'Old', levels: [{ code: 'DIPLOMA', name: 'Diploma' }] },
    { id: 'history', slug: 'history', name: 'History', levels: [PG] },
  ];

  it('keeps the subjects offered at the level and claiming it, in the list’s order, by the plain address', () => {
    expect(subjectsAtLevel(rows, 'ug', { except: 'computing', catalogue })).toEqual([
      { id: 'law', name: 'Law', href: '/subjects/law/bachelors' },
      { id: 'music', name: 'Music', href: '/subjects/music/bachelors' },
    ]);
    expect(subjectsAtLevel(rows, 'PG', { except: 'law', catalogue }).map((row) => row.href)).toEqual([
      '/subjects/computing/masters',
      '/subjects/history/masters',
    ]);
  });

  it('leaves out a level the catalogue no longer lists', () => {
    expect(subjectsAtLevel(rows, 'DIPLOMA', { catalogue })).toEqual([]);
    expect(subjectsAtLevel(rows, 'FOUNDATION', { catalogue })).toEqual([]);
  });

  it('stops at twelve, or the number asked for', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, slug: `s-${index}`, name: `S${index}`, levels: [UG] }));
    expect(subjectsAtLevel(many, 'UG', { catalogue })).toHaveLength(12);
    expect(subjectsAtLevel(many, 'UG', { catalogue, max: 3 }).map((row) => row.id)).toEqual(['s0', 's1', 's2']);
  });

  it('has none for no list', () => {
    expect(subjectsAtLevel(null, 'UG')).toEqual([]);
    expect(subjectsAtLevel(undefined, 'UG')).toEqual([]);
  });
});
