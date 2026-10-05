import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CountryFieldHero,
  FiguresStrip,
  NothingListedHere,
  SpecializationChips,
} from './CountryFieldHero';

/**
 * The head of a subject's or a specialization's page in one destination,
 * drawn as the design draws it: the field's tile, the flag and the kind of
 * page in the eyebrow, the figures, and the specializations taught there.
 */

const uk = { iso2Code: 'GB' };

describe('the hero', () => {
  it('says what kind of page it is, and within what', () => {
    const html = renderToStaticMarkup(
      <CountryFieldHero country={uk} icon={null} kind="Specialization" detail="within Computer Science">
        <h1>Study Software Engineering in the United Kingdom</h1>
      </CountryFieldHero>,
    );
    expect(html).toContain('class="subjhero fieldhero"');
    expect(html).toContain('subjhero__icon');
    expect(html).toMatch(/hero__eyebrow fieldhero__eyebrow[^>]*>.*Specialization<b>·<\/b>within Computer Science/);
    expect(html).toContain('<h1>Study Software Engineering in the United Kingdom</h1>');
  });

  it("draws the field's own icon when it has one", () => {
    const html = renderToStaticMarkup(
      <CountryFieldHero
        country={uk}
        icon={{ url: '/media/cs.svg' } as never}
        kind="Subject"
      >
        <h1>Study Computer Science in the United Kingdom</h1>
      </CountryFieldHero>,
    );
    expect(html).toContain('src="/media/cs.svg"');
    expect(html).not.toContain('<b>·</b>');
  });
});

describe('the figures strip', () => {
  it('is not drawn with nothing to state', () => {
    expect(renderToStaticMarkup(<FiguresStrip figures={[]} />)).toBe('');
  });

  it('has as many columns as figures, and marks the counts as data', () => {
    const html = renderToStaticMarkup(
      <FiguresStrip
        figures={[
          { label: 'Programmes', value: '2' },
          { label: 'Universities', value: '4' },
          { label: 'Intakes', value: 'Sep' },
        ]}
      />,
    );
    expect(html).toContain('statstrip statstrip--field statstrip--n3');
    expect(html).toContain('<b class="datum">2</b><span>Programmes</span>');
    expect(html).toContain('<b>Sep</b><span>Intakes</span>');
  });
});

describe('the specializations taught here', () => {
  it("links each to itself in this destination, with this destination's count", () => {
    const html = renderToStaticMarkup(
      <SpecializationChips
        chips={[
          {
            id: 'se',
            name: 'Software Engineering',
            href: '/study-abroad/united-kingdom/computer-science/software-engineering',
            count: 2,
          },
        ]}
      />,
    );
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/computer-science/software-engineering"',
    );
    expect(html).toContain('Software Engineering<em>2</em>');
  });

  it('is not drawn where none is taught', () => {
    expect(renderToStaticMarkup(<SpecializationChips chips={[]} />)).toBe('');
  });
});

describe('nothing listed in a destination', () => {
  it('says so plainly, about the catalogue, and offers the ways on', () => {
    const html = renderToStaticMarkup(
      <NothingListedHere
        field="Computer Science"
        where="Afghanistan"
        links={[
          { href: '/subjects/computer-science#destinations', label: 'Computer Science in other destinations' },
          { href: '/study-abroad/afghanistan/subjects', label: 'Other subjects in Afghanistan' },
        ]}
      />,
    );
    expect(html).toContain('No Computer Science course in Afghanistan is listed on Universta yet.');
    expect(html).toContain('href="/subjects/computer-science#destinations"');
    expect(html).toContain('href="/study-abroad/afghanistan/subjects"');
  });
});
