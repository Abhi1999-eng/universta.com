import { describe, expect, it } from 'vitest';
import { aboutLine, decodeEntities, lengthAcross, levelFacts, modesAcross } from './level-panel-info';

const course = (min: string | null, max: string | null, unit: string | null, modes: string[] = ['Full time']) =>
  ({ duration: { min, max, unit }, studyModes: modes.map((name) => ({ id: name, code: name, name })) }) as never;
const group = (courses: never[], count = courses.length) =>
  ({ level: { id: 'pg', code: 'PG', name: "Master's", educationOrder: 4 }, count, courses }) as never;

describe('a level panel’s line about the level', () => {
  it('keeps the first two sentences of plain text', () => {
    expect(aboutLine('A Master’s takes one or two years. You go deeper. Most end with a thesis.')).toBe(
      'A Master’s takes one or two years. You go deeper.',
    );
    expect(aboutLine('  One   line  ')).toBe('One line');
    expect(aboutLine('')).toBeNull();
    expect(aboutLine(null)).toBeNull();
  });

  it('never cuts a sentence at a stop inside it', () => {
    expect(aboutLine('Programmes take 1.5 to 2 years. Most end with a thesis. A third.')).toBe(
      'Programmes take 1.5 to 2 years. Most end with a thesis.',
    );
    expect(aboutLine('A Ph.D. is a doctoral degree. It ends with a defence. More.')).toBe(
      'A Ph.D. is a doctoral degree. It ends with a defence.',
    );
    expect(aboutLine('Short courses, e.g. coding or language. Many are online.', 1)).toBe(
      'Short courses, e.g. coding or language.',
    );
    expect(aboutLine('Study in the U.S. or Japan. Learn Node.js too.', 1)).toBe('Study in the U.S. or Japan.');
    expect(aboutLine('No stop at all')).toBe('No stop at all');
  });

  it('reads a long run with no sentence break quickly', () => {
    const started = performance.now();
    expect(aboutLine(`${'a'.repeat(50000)}.b`)).toHaveLength(50002);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('reads character references as the characters, once', () => {
    expect(aboutLine('Computer Science &amp; IT takes two years.')).toBe('Computer Science & IT takes two years.');
    expect(decodeEntities('A&#x27;s &#39;b&#39; &lt;c&gt; &nbsp;d &unknown;')).toBe("A's 'b' <c>  d &unknown;");
    expect(decodeEntities('&amp;amp;')).toBe('&amp;');
  });
});

describe('a level panel’s facts', () => {
  it('gives the span of its courses’ length where they share a unit', () => {
    expect(lengthAcross([course('2.00', '2.00', 'YEARS')])).toBe('2 years');
    expect(lengthAcross([course('1', '1', 'YEARS'), course('2', '2', 'YEARS')])).toBe('1–2 years');
    expect(lengthAcross([course('1', null, 'YEARS')])).toBe('1 year');
    expect(lengthAcross([course('2', '2', 'YEARS'), course('18', '18', 'MONTHS')])).toBeNull();
    expect(lengthAcross([course(null, null, null)])).toBeNull();
    expect(lengthAcross([])).toBeNull();
  });

  it('names how its courses are taught, each mode once', () => {
    expect(modesAcross([course('2', '2', 'YEARS', ['Full time']), course('2', '2', 'YEARS', ['Full time', 'Part time'])])).toBe(
      'Full time, part time',
    );
    expect(modesAcross([course('2', '2', 'YEARS', [])])).toBeNull();
  });

  it('states only what is recorded, never a zero', () => {
    expect(levelFacts({ group: group([course('2', '2', 'YEARS')]), programmes: 3 })).toEqual([
      { label: 'Programmes at universities', value: '3' },
      { label: 'Typical length', value: '2 years' },
      { label: 'Study mode', value: 'Full time' },
    ]);
    expect(levelFacts({ group: group([]), programmes: 0 })).toEqual([]);
    /* More courses at the level than were read: its length and modes are
       not described by the first few. */
    expect(levelFacts({ group: group([course('2', '2', 'YEARS')], 40), programmes: 5 })).toEqual([
      { label: 'Programmes at universities', value: '5' },
    ]);
    expect(levelFacts({ group: group([course('1', '1', 'YEARS')]), programmes: 1 })).toEqual([
      { label: 'Programme at a university', value: '1' },
      { label: 'Typical length', value: '1 year' },
      { label: 'Study mode', value: 'Full time' },
    ]);
  });
});
