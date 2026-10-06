// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The address the block reads, and the router it would ask to draw the
   page again, are the test's to set and to watch. */
const nav = vi.hoisted(() => ({ search: new URLSearchParams(), refreshed: 0 }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {
      nav.refreshed += 1;
    },
  }),
  usePathname: () => '/',
  useSearchParams: () => nav.search,
}));

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  readCourseFilters,
  toCourseFacets,
  toOfferingCards,
} from '@/lib/university-courses';
import { ProgrammeResults, type ProgrammeResultsProps } from './ProgrammeResults';

/**
 * The programme results block, as the course finder, a destination's
 * subject pages and a university's list all draw it. What a list is fixed
 * to never shows as a choice; a long group keeps a ticked value in view and
 * finds the rest with its own search; fees are offered only inside one
 * country; and the way out of an empty list is always on the page, its
 * links kept out of the index.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const universities = Array.from({ length: 12 }, (_, index) => ({
  value: `university-${String.fromCharCode(97 + index)}`,
  label: `University ${String.fromCharCode(65 + index)}`,
  count: 12 - index,
}));
const facets = toCourseFacets({
  countries: [
    { value: 'japan', label: 'Japan', count: 30 },
    { value: 'united-kingdom', label: 'United Kingdom', count: 40 },
  ],
  universities,
  levels: [
    { value: 'UG', label: "Bachelor's", count: 30 },
    { value: 'PG', label: "Master's", count: 40 },
  ],
  englishTests: [{ value: 'IELTS', label: 'IELTS', count: 2 }],
  extras: [{ value: 'scholarship', label: 'With scholarships', count: 3 }],
});
const row = (index: number) => ({
  id: `o${index}`,
  name: `MSc Course ${index}`,
  slug: `msc-course-${index}`,
  university: {
    name: 'University of Warwick',
    slug: 'university-of-warwick',
    country: uk,
    campuses: [{ city: 'Coventry' }],
  },
});

function props(over: Partial<ProgrammeResultsProps> = {}): ProgrammeResultsProps {
  return {
    base: '/courses',
    filters: readCourseFilters({}),
    facets,
    cards: toOfferingCards(Array.from({ length: 18 }, (_, index) => row(index))),
    meta: { page: 1, limit: 18, total: 70, totalPages: 4 },
    catalogueTotal: 70,
    ...over,
  };
}

const render = (over: Partial<ProgrammeResultsProps> = {}) =>
  renderToStaticMarkup(<ProgrammeResults {...props(over)} />);
const parseHtml = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('the programme results block', () => {
  it('names each card’s university, and searches across universities', () => {
    const html = render();
    expect(html).toContain('<b>University of Warwick</b>');
    expect(html).toContain('Search courses, universities, specializations or cities');
    expect(html).toContain('70 programmes');
    expect(html).toContain('Load more programmes');
  });

  it('never offers or chips what the list is fixed to, nor writes it into links', () => {
    const html = render({
      scope: { country: ['united-kingdom'] },
      filters: readCourseFilters({ country: 'japan', level: 'PG' }),
      meta: { page: 1, limit: 18, total: 40, totalPages: 3 },
    });
    expect(html).not.toContain('name="country"');
    expect(html).not.toContain('Remove Japan');
    expect(html).toContain('aria-label="Remove Master&#x27;s"');
    expect(html).not.toMatch(/href="\/courses\?[^"]*country=/);
    /* Its other filters are offered as usual. */
    expect(html).toContain('name="level" value="UG"');
  });

  it('keeps a ticked value beyond the first few in view, and the rest behind “Show all”', () => {
    const html = render({
      filters: readCourseFilters({ university: 'university-k' }),
    });
    const ticked = html.indexOf('name="university" checked="" value="university-k"');
    expect(ticked).toBeGreaterThan(-1);
    expect(ticked).toBeLessThan(html.indexOf('<details class="fgroup__more">'));
    expect(html).toContain('Show all 12');
    /* Once, not twice. */
    expect(
      html.match(/type="checkbox" name="university"[^>]*value="university-k"/g),
    ).toHaveLength(1);
  });

  it('gives a long group a search of its own, and none to a short one', () => {
    const html = render();
    expect(html).toContain('placeholder="Find a university"');
    expect(html).not.toContain('placeholder="Find a degree level"');
  });

  it('offers the fee range and “Lowest tuition” only inside one country', () => {
    const across = render();
    expect(across).not.toContain('Annual tuition');
    expect(across).not.toContain('>Lowest tuition</option>');
    expect(across).toContain('>Recently added</option>');

    const inside = render({
      filters: readCourseFilters({ country: 'united-kingdom' }),
      facets: { ...facets, tuition: { currencyCode: 'GBP', count: 4 } },
    });
    expect(inside).toContain('Annual tuition');
    expect(inside).toContain('Amounts in GBP');
    expect(inside).toContain('>Lowest tuition</option>');

    /* A list that sits inside one country -- a university's own -- offers
       the order whatever is chosen. */
    expect(render({ oneCurrency: true })).toContain('>Lowest tuition</option>');
  });

  it('offers a score for the tests programmes list, and the extras with counts', () => {
    const html = render();
    expect(html).toContain('My English score');
    expect(html).toContain('name="ielts"');
    expect(html).not.toContain('name="toefl"');
    expect(html).toContain('without a listed requirement are left out');
    expect(html).toContain('name="scholarship" value="true"');
  });

  it('says what matched nothing, keeps the chips, and adds what the page says under it', () => {
    const html = render({
      filters: readCourseFilters({ country: 'atlantis' }),
      cards: [],
      meta: { page: 1, limit: 18, total: 0, totalPages: 0 },
      empty: <p>3 course guides match</p>,
    });
    expect(html).toContain('No programme matches these filters. Remove a filter to see more.');
    expect(html).toContain('3 course guides match');
    expect(html).toContain('aria-label="Remove Atlantis"');
    /* A value nothing carries is still a box to untick. */
    expect(html).toContain('name="country" checked="" value="atlantis"');
  });

  it('suggests as the reader types when told where to ask, and still searches without script', () => {
    const html = render({
      suggestions: '/api/courses/suggestions?with=programmes',
      filters: readCourseFilters({ level: 'PG' }),
    });
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Search programmes"');
    /* Without script the form still submits the search to the list, with
       the filters already in force. */
    const form = parseHtml(html).querySelector('form.searchwrap')!;
    expect(form.getAttribute('action')).toBe('/courses');
    expect(form.querySelector('input[role=combobox]')?.getAttribute('name')).toBe('q');
    expect(form.querySelector('input[type=hidden][name=level]')?.getAttribute('value')).toBe('PG');

    /* A list that does not ask keeps its plain field. */
    const plain = render();
    expect(plain).not.toContain('role="combobox"');
    expect(plain).toContain('type="search"');
  });

  it('keeps its chips and “Clear all” out of the index', () => {
    const html = render({
      filters: readCourseFilters({ level: 'PG', q: 'data' }),
    });
    const chips = html.match(/<a class="activechip[^"]*"[^>]*>/g) ?? [];
    expect(chips.length).toBe(3);
    for (const chip of chips) expect(chip).toContain('rel="nofollow"');
    expect(html).toContain('<a class="linkbtn" rel="nofollow" href="/courses?q=data">Clear all</a>');
  });
});

describe('a long group’s own search', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('finds any option in the group, the ones behind “Show all” included', async () => {
    await act(async () => {
      root.render(<ProgrammeResults {...props()} />);
    });
    const search = host.querySelector<HTMLInputElement>('input[placeholder="Find a university"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(search, 'university l');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const group = search.closest('.fgroup')!;
    const shown = [...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map(
      (box) => box.value,
    );
    expect(shown).toEqual(['university-l']);
    expect(group.querySelector('details')).toBeNull();
  });
});

describe('the phone’s filter sheet', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('dims the page behind it, and closes on Escape or a tap on the page', async () => {
    await act(async () => {
      root.render(<ProgrammeResults {...props()} />);
    });
    const panel = () => host.querySelector('#course-filters')!;
    const open = async () =>
      act(async () => host.querySelector<HTMLButtonElement>('.filters-toggle')!.click());

    expect(host.querySelector('.cref-overlay')).toBeNull();
    await open();
    expect(panel().getAttribute('data-open')).toBe('true');
    expect(host.querySelector('.cref-overlay')).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(panel().getAttribute('data-open')).toBe('false');
    expect(host.querySelector('.cref-overlay')).toBeNull();

    await open();
    await act(async () => host.querySelector<HTMLButtonElement>('.cref-overlay')!.click());
    expect(panel().getAttribute('data-open')).toBe('false');
  });
});

describe('the way back to a list loaded further', () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetched: string[];
  let scrolledTo: Array<[number, number]>;
  /* The cards of one page of eighteen, as the endpoint answers them. */
  const pageOf = (page: number) =>
    toOfferingCards(Array.from({ length: 18 }, (_, index) => row((page - 1) * 18 + index)));
  /* Lets the list's requests answer and what they bring be drawn. */
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    fetched = [];
    scrolledTo = [];
    nav.refreshed = 0;
    window.history.replaceState(null, '', '/courses');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetched.push(url);
        const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
        return new Response(JSON.stringify({ cards: pageOf(page), meta: { page } }));
      }),
    );
    vi.spyOn(window, 'scrollTo').mockImplementation(((x: number, y: number) => {
      scrolledTo.push([x, y]);
    }) as typeof window.scrollTo);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    nav.search = new URLSearchParams();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('appends the pages Back left out, and puts the reader back where they were', async () => {
    /* Back from a course: the address names two pages, the list as the
       server first drew it holds one, and the entry kept the reader's
       place. */
    nav.search = new URLSearchParams('page=2');
    window.history.replaceState({ programmeListScroll: 4321 }, '', '/courses?page=2');
    await act(async () => {
      root.render(<ProgrammeResults {...props()} />);
    });
    await settle();
    expect(fetched).toEqual(['/api/programmes?limit=18&page=2']);
    expect(host.querySelectorAll('.coursecard')).toHaveLength(36);
    expect(scrolledTo).toEqual([[0, 4321]]);
    /* Not by drawing the whole page again, which lost the reader's place. */
    expect(nav.refreshed).toBe(0);
  });

  it('asks for no page past the most the server draws for an address', async () => {
    nav.search = new URLSearchParams('page=25');
    await act(async () => {
      root.render(
        <ProgrammeResults
          {...props({ meta: { page: 20, limit: 18, total: 1155, totalPages: 65 } })}
        />,
      );
    });
    await settle();
    expect(fetched).toEqual([]);
    expect(nav.refreshed).toBe(0);
  });

  it('keeps the reader’s place on its history entry as they load more and as they open a course', async () => {
    Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true });
    await act(async () => {
      root.render(<ProgrammeResults {...props()} />);
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid=course-load-more]')!.click());
    await settle();
    expect(window.location.search).toBe('?page=2');
    expect(window.history.state).toMatchObject({ programmeListScroll: 1500 });
    expect(host.querySelectorAll('.coursecard')).toHaveLength(36);

    /* Opening a course from further down keeps that place instead. The
       browser's own following of the link is stopped here. */
    Object.defineProperty(window, 'scrollY', { value: 2468, configurable: true });
    const stop = (event: Event) => event.preventDefault();
    window.addEventListener('click', stop, true);
    try {
      host
        .querySelectorAll<HTMLAnchorElement>('.coursecard__name a')[30]!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } finally {
      window.removeEventListener('click', stop, true);
    }
    expect(window.history.state).toMatchObject({ programmeListScroll: 2468 });
    expect(window.location.search).toBe('?page=2');
  });
});
