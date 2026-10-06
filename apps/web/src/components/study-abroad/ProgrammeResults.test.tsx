// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
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
    expect(html).toContain('aria-label="Remove atlantis"');
    /* A value nothing carries is still a box to untick. */
    expect(html).toContain('name="country" checked="" value="atlantis"');
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
