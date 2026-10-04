import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Country } from '@/lib/countries';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { CountrySubjects, SUBJECTS_SHOWN } = await import('./CountryLinkSections');
const { CountrySubjectGrid } = await import('./CountrySubjectGrid');
const { SubjectCount, SubjectSearchBox, SubjectSearchProvider } = await import(
  './CountrySubjectSearch'
);

/**
 * The guide shows six subjects and one button to the rest; the page behind
 * the button lists them all, with a search in its hero.
 *
 * Thirty cards made the section ten rows of a guide with fees, visas and
 * intakes still to come.
 */
const NAMES = [
  'Agriculture', 'Architecture', 'Arts', 'Business', 'Computing', 'Education',
  'Engineering', 'Law', 'Medicine', 'Science',
];
const country = (taught: string[] = []): Country =>
  ({
    id: 'c1',
    name: 'United Kingdom',
    slug: 'uk',
    iso2Code: 'GB',
    subjects: NAMES.map((name, index) => ({
      id: `s${index}`,
      name,
      slug: name.toLowerCase(),
      source: taught.includes(name) ? 'DERIVED' : 'EDITORIAL',
    })),
  }) as unknown as Country;

const cards = (html: string) =>
  [...html.matchAll(/<a class="h-card h-card--row" href="([^"]+)"/g)].map((m) => m[1]);

describe('the guide’s subject section', () => {
  it('shows six subjects, not all of them', () => {
    const html = renderToStaticMarkup(<CountrySubjects country={country()} alt />);
    expect(SUBJECTS_SHOWN).toBe(6);
    expect(cards(html)).toHaveLength(6);
    expect(cards(html)[0]).toBe('/study-abroad/uk/agriculture');
    expect(html).not.toContain('Engineering');
  });

  it('puts them in the three-across grid, so six make two rows', () => {
    const html = renderToStaticMarkup(<CountrySubjects country={country()} alt />);
    expect(html.match(/class="h-grid h-grid--wide"/g) ?? []).toHaveLength(1);
  });

  it('gives one button to the rest, under the cards, going to the subjects page', () => {
    const html = renderToStaticMarkup(<CountrySubjects country={country()} alt />);
    const links = [...html.matchAll(/<a class="btn" href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(links[0][1]).toBe('/study-abroad/uk/subjects');
    expect(links[0][2]).toContain('View all subjects');
    /* After the grid, not beside the heading. */
    expect(html.indexOf('View all subjects')).toBeGreaterThan(html.lastIndexOf('h-card--row'));
  });

  it('fills the six with the subjects that have programmes first', () => {
    const html = renderToStaticMarkup(
      <CountrySubjects country={country(['Science', 'Law'])} alt />,
    );
    expect(cards(html).slice(0, 2)).toEqual([
      '/study-abroad/uk/law',
      '/study-abroad/uk/science',
    ]);
    expect(cards(html)).toHaveLength(6);
    /* And says that the others shown have nothing behind them yet. */
    expect(html).toContain('no programme in the catalogue yet');
  });

  it('shows what there is when there are fewer than six, with the button still there', () => {
    const few = { ...country(), subjects: country().subjects!.slice(0, 2) } as Country;
    const html = renderToStaticMarkup(<CountrySubjects country={few} alt />);
    expect(cards(html)).toHaveLength(2);
    expect(html).toContain('View all subjects');
  });
});

const list = NAMES.map((name, index) => ({
  id: `s${index}`,
  name,
  slug: name.toLowerCase(),
  specializations: 3,
}));
const pageWith = (query: string) =>
  renderToStaticMarkup(
    <SubjectSearchProvider initialQuery={query}>
      <SubjectSearchBox countrySlug="uk" subjects={list} />
      <CountrySubjectGrid taught={[]} editorial={list} countrySlug="uk" />
    </SubjectSearchProvider>,
  );

describe('the page that lists every subject', () => {
  it('lists them all when nothing has been searched', () => {
    expect(cards(pageWith(''))).toHaveLength(NAMES.length);
  });

  it('has a search that is a real form to the same page, so it works before any script runs', () => {
    const html = pageWith('');
    const form = /<form[^>]*>/.exec(html)?.[0] ?? '';
    expect(form).toContain('role="search"');
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/study-abroad/uk/subjects"');
    const input = /<input[^>]*>/.exec(html)?.[0] ?? '';
    expect(input).toContain('type="search"');
    expect(input).toContain('name="q"');
    expect(html).toContain('Search subjects…');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Search<\/button>/);
  });

  it('opens already narrowed when the address carries a search', () => {
    const html = pageWith('eng');
    expect(cards(html)).toEqual(['/study-abroad/uk/engineering']);
    expect(html).toMatch(/aria-live="polite"[^>]*>1 match</);
  });

  it('matches the start of a word, not the middle of one', () => {
    expect(cards(pageWith('ing'))).toEqual([]);
    expect(cards(pageWith('sci'))).toEqual(['/study-abroad/uk/science']);
  });

  it('counts what is left under the heading, where it is in view while typing', () => {
    const count = (query: string) =>
      renderToStaticMarkup(
        <SubjectSearchProvider initialQuery={query}>
          <SubjectCount names={NAMES} />
        </SubjectSearchProvider>,
      );
    expect(count('')).toBe('10 subjects');
    expect(count('a')).toBe('3 of 10 subjects');
    expect(count('zzzz')).toBe('0 of 10 subjects');
  });

  it('says so, in the reference’s words, when nothing matches', () => {
    const html = pageWith('zzzz');
    expect(html).toContain('No subjects matched. Try a shorter word.');
    expect(html).toMatch(/aria-live="polite"[^>]*>0 matches</);
  });
});
