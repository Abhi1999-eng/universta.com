import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Course, CourseLevelGroup } from '@/lib/catalog';
import { everyLevel, LEVEL_ROWS_SHOWN } from '@/lib/course-levels';
import { CourseLevels } from './CourseLevels';

/**
 * A subject's courses, one section per study level -- what the client asked
 * for in so many words: "Agriculture has 10 Bachelor's courses, they come in
 * the Bachelor's section; 20 Master's courses come in the Master's section."
 */
const course = (level: string, index: number): Course =>
  ({
    id: `${level}-${index}`,
    name: `${level} course ${index}`,
    slug: `${level.toLowerCase()}-course-${index}`,
    subject: { id: 'ag', name: 'Agriculture', slug: 'agriculture' },
    subSubject: { id: 'ab', name: 'Agribusiness', slug: 'agribusiness' },
    courseLevel: { id: level, name: level, code: level },
    studyModes: [{ id: 'f', name: 'Full time', code: 'FULL_TIME' }],
    duration: { min: '3.00', max: '3.00', unit: 'YEARS' },
    selectedTuition: null,
    availableCountryCount: 2,
  }) as unknown as Course;

const group = (
  code: string,
  name: string,
  count: number,
  sent = count,
): CourseLevelGroup => ({
  level: { id: code, code, name, educationOrder: 0 },
  count,
  courses: Array.from({ length: sent }, (_, index) => course(code, index + 1)),
});

const render = (groups: CourseLevelGroup[], branch = true) =>
  renderToStaticMarkup(
    <CourseLevels
      groups={groups}
      branch={branch}
      allHref={(level) => `/courses?subject=agriculture&level=${level}`}
    />,
  );

const sections = (html: string) =>
  [...html.matchAll(/<section class="coursegroup[^"]*" id="([^"]+)"/g)].map((m) => m[1]);

describe('courses filed under their levels', () => {
  const html = render([group('UG', "Bachelor's", 10), group('PG', "Master's", 20)]);

  it('gives each level its own section, in the order the catalogue sent them', () => {
    expect(sections(html)).toEqual(['level-ug', 'level-pg']);
  });

  it('heads each one with the level, its whole count, and a way to the full list', () => {
    expect(html).toMatch(
      /<h3[^>]*id="level-ug-h"[^>]*><a class="coursegroup__head" href="\/courses\?subject=agriculture&amp;level=UG">.*?Bachelor&#x27;s.*?10 courses/,
    );
    expect(html).toMatch(/href="\/courses\?subject=agriculture&amp;level=PG">.*?Master&#x27;s.*?20 courses/);
  });

  it("puts all ten of the Bachelor's courses in the Bachelor's section, and none of the Master's", () => {
    const ug = html.slice(html.indexOf('id="level-ug"'), html.indexOf('id="level-pg"'));
    expect([...ug.matchAll(/class="courselist__row"/g)]).toHaveLength(10);
    expect(ug).not.toContain('PG course');
    expect(ug).not.toContain('<details');
  });

  it("holds all twenty of the Master's: ten in view, ten one press further, in place", () => {
    const pg = html.slice(html.indexOf('id="level-pg"'));
    expect([...pg.matchAll(/class="courselist__row"/g)]).toHaveLength(20);
    const [shown, folded] = pg.split('<details');
    expect([...shown.matchAll(/class="courselist__row"/g)]).toHaveLength(LEVEL_ROWS_SHOWN);
    expect([...folded.matchAll(/class="courselist__row"/g)]).toHaveLength(10);
    expect(folded).toContain('Show 10 more Master&#x27;s courses');
    /* Everything is on the page, so nothing sends the reader away for it. */
    expect(pg).not.toContain('class="linkcta"');
  });

  it('gives a chip to each level, with its count, that goes to its section', () => {
    expect(html).toMatch(/<nav class="levelbar levelbar--wide" aria-label="Study levels">/);
    expect(html).toMatch(/<a class="chipbtn" href="#level-ug">Bachelor&#x27;s <span class="chipbtn__n datum">10<\/span><\/a>/);
    expect(html).toMatch(/<a class="chipbtn" href="#level-pg">Master&#x27;s <span class="chipbtn__n datum">20<\/span><\/a>/);
  });

  it('opens a course on its own page, and says what is recorded about it', () => {
    expect(html).toContain('<a class="courselist__row" href="/courses/ug-course-1">');
    expect(html).toContain('Agribusiness · 3 years · Full time');
    expect(html).toContain('2 destinations');
  });
});

describe('the edges', () => {
  it('links to the course list when a level holds more than the page was sent', () => {
    const html = render([group('PG', "Master's", 73, 30)]);
    expect([...html.matchAll(/class="courselist__row"/g)]).toHaveLength(30);
    expect(html).toMatch(
      /<a class="linkcta" href="\/courses\?subject=agriculture&amp;level=PG">All 73 Master&#x27;s courses/,
    );
  });

  it('needs no chips for a single level', () => {
    expect(render([group('UG', "Bachelor's", 3)])).not.toContain('levelbar');
  });

  it('says "1 course", not "1 courses"', () => {
    const html = render([group('PHD', 'PhD', 1)]);
    expect(html).toContain('1 course<');
    expect(html).not.toContain('1 courses');
  });

  it('does not repeat the specialization on its own page', () => {
    const html = render([group('UG', "Bachelor's", 2)], false);
    expect(html).not.toContain('Agribusiness');
    expect(html).toContain('3 years · Full time');
  });

  it('is nothing at all when there are no courses', () => {
    expect(render([])).toBe('');
  });
});

/**
 * The client could not see the levels: on a catalogue with nothing listed
 * yet the block drew no level at all. The six they named now always show,
 * each saying when nothing is listed at it.
 */
describe('every level the client named, listed or not', () => {
  /* Not in the order a student climbs them, as the catalogue may send them:
     the order is the levels' own. */
  const catalogue = [
    { id: 'h', code: 'PHD', name: 'PhD', educationOrder: 6 },
    { id: 'd', code: 'DIPLOMA', name: 'Diploma', educationOrder: 7 },
    { id: 'g', code: 'PG', name: "Master's", educationOrder: 4 },
    { id: 'f', code: 'FOUNDATION', name: 'Foundation Program', educationOrder: 1 },
    { id: 'm', code: 'MBA', name: 'MBA', educationOrder: 5 },
    /* Without an education order, its display order ranks it. */
    { id: 'u', code: 'UG', name: "Bachelor's", educationOrder: null, displayOrder: 3 },
    { id: 'p', code: 'PATHWAY', name: 'Pathway Program', educationOrder: 2 },
  ];

  it('adds the six as empty levels, in the order a student climbs them', () => {
    const all = everyLevel([group('PG', "Master's", 4)], catalogue)!;
    expect(all.map((row) => [row.level.code, row.count])).toEqual([
      ['FOUNDATION', 0],
      ['PATHWAY', 0],
      ['UG', 0],
      ['PG', 4],
      ['MBA', 0],
      ['PHD', 0],
    ]);
    /* The listed level keeps its own courses. */
    expect(all[3]!.courses).toHaveLength(4);
  });

  it('shows any other level only where something is listed at it', () => {
    expect(everyLevel([], catalogue)!.map((row) => row.level.code)).not.toContain('DIPLOMA');
    expect(
      everyLevel([group('DIPLOMA', 'Diploma', 2)], catalogue)!.map((row) => row.level.code),
    ).toEqual(['FOUNDATION', 'PATHWAY', 'UG', 'PG', 'MBA', 'PHD', 'DIPLOMA']);
  });

  it('shows all six on a catalogue with nothing listed yet', () => {
    expect(everyLevel([], catalogue)).toHaveLength(6);
  });

  it('knows nothing when the grouped read failed, and adds nothing', () => {
    expect(everyLevel(null, catalogue)).toBeNull();
  });

  it('keeps the groups as they came without the list of levels', () => {
    const groups = [group('PG', "Master's", 4)];
    expect(everyLevel(groups, null)).toBe(groups);
  });

  it('draws an empty level as its name and "0 courses", with no sentence and no link to an empty list', () => {
    const html = renderToStaticMarkup(
      <CourseLevels
        groups={everyLevel([group('PG', "Master's", 2)], catalogue)!}
        allHref={(level) => `/courses?subject=agriculture&level=${level}`}
      />,
    );
    expect(sections(html)).toEqual([
      'level-foundation',
      'level-pathway',
      'level-ug',
      'level-pg',
      'level-mba',
      'level-phd',
    ]);
    const empty = /<section class="coursegroup coursegroup--empty[^"]*" id="level-foundation".*?<\/section>/.exec(html)?.[0] ?? '';
    expect(empty).toContain('Foundation Program');
    expect(empty).toContain('0 courses');
    expect(empty).not.toContain('<p');
    expect(empty).not.toContain('href=');
    expect(html).toContain('href="/courses?subject=agriculture&amp;level=PG"');
    expect(html).not.toContain('level=FOUNDATION');
    /* The chip bar names every level, the empty ones marked as such. */
    expect(html).toMatch(/<a class="chipbtn chipbtn--none" href="#level-foundation">/);
    expect(html).toMatch(/<a class="chipbtn" href="#level-pg">/);
  });

  it('has no chip bar when nothing is listed at any level', () => {
    const html = renderToStaticMarkup(
      <CourseLevels groups={everyLevel([], catalogue)!} allHref={() => '/courses'} />,
    );
    expect(sections(html)).toHaveLength(6);
    expect(html).not.toContain('levelbar');
    expect(html).not.toContain('href=');
  });
});
