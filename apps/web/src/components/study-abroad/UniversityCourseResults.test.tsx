// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The address as the router reports it, and its refresh, which the list
   asks for when it holds fewer pages than the address names. */
const address = { search: '' };
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(address.search),
}));

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  readCourseFilters,
  toCourseFacets,
  toOfferingCards,
} from '@/lib/university-courses';
import { UniversityCourseResults } from './UniversityCourseResults';

/**
 * "Load more courses" appends the next eighteen in place and writes how far
 * the list now goes into the address, so a reload or Back from a course
 * comes to the same place. The server reads that address as the first N
 * pages, which is also what the link standing in for the button without
 * script asks for.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const owner = { name: 'University of Oxford', slug: 'university-of-oxford', country: uk, city: 'Oxford' };
const base = '/study-abroad/united-kingdom/universities/university-of-oxford/courses';
const row = (index: number) => ({
  id: `o${index}`,
  name: `MSc Course ${index}`,
  slug: `university-of-oxford-msc-course-${index}`,
  genericCourse: { courseLevel: { code: 'PG', name: "Master's" } },
});
const cards = (from: number, count: number) =>
  toOfferingCards(Array.from({ length: count }, (_, index) => row(from + index)), owner);

let host: HTMLDivElement;
let root: Root;
const replaceState = vi.spyOn(window.history, 'replaceState');

beforeEach(() => {
  replaceState.mockClear();
  refresh.mockClear();
  address.search = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
      return new Response(
        JSON.stringify({
          cards: cards((page - 1) * 18, Math.min(18, 40 - (page - 1) * 18)),
          meta: { page },
        }),
      );
    }),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const results = (page = 1) => (
  <UniversityCourseResults
    base={base}
    universitySlug="university-of-oxford"
    universityName="University of Oxford"
    filters={readCourseFilters({ level: 'PG', page: String(page) })}
    facets={toCourseFacets({})}
    cards={cards(0, 18 * page)}
    meta={{ page, limit: 18, total: 40, totalPages: 3 }}
    catalogueTotal={40}
  />
);

describe('Load more courses', () => {
  it('appends the next page and writes the new depth into the address, filters kept', async () => {
    await act(async () => {
      root.render(results());
    });
    const button = () =>
      host.querySelector<HTMLButtonElement>('[data-testid="course-load-more"]');

    await act(async () => button()!.click());
    expect(host.querySelectorAll('.coursecard')).toHaveLength(36);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', `${base}?level=PG&page=2`);

    await act(async () => button()!.click());
    expect(host.querySelectorAll('.coursecard')).toHaveLength(40);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', `${base}?level=PG&page=3`);
    expect(button()).toBeNull();
    expect(host.textContent).toContain('Showing 40 of 40');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('asks the server again when Back brings the list back shorter than its address', async () => {
    address.search = 'level=PG&page=2';
    await act(async () => {
      root.render(results(1));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('leaves a list alone that already holds what its address names', async () => {
    address.search = 'level=PG&page=2';
    await act(async () => {
      root.render(results(2));
    });
    expect(host.querySelectorAll('.coursecard')).toHaveLength(36);
    expect(refresh).not.toHaveBeenCalled();
  });
});
