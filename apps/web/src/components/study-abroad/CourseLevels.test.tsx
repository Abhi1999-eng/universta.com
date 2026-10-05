import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Course, CourseLevelGroup } from '@/lib/catalog';
import { LEVEL_ROWS_SHOWN } from '@/lib/course-levels';
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
