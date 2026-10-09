// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, CourseFilterOptions } from '@/lib/catalog';
import { readGuideFilters } from '@/lib/courses-params';
import { CourseGuidesResults, type CourseGuidesResultsProps } from './CourseGuidesResults';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {} }),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = '/subjects/computer-science/software-engineering/levels/bachelors';
const scope = { subject: ['computer-science'], subSubject: ['software-engineering'], level: ['UG'] };
const guide: Course = {
  id: 'guide-1', name: 'BSc Software Engineering', slug: 'bsc-software-engineering',
  shortName: null, qualificationName: 'Bachelor of Science', shortDescription: null,
  subject: { id: 'subject-1', name: 'Computer Science', slug: 'computer-science' },
  subSubject: { id: 'specialization-1', name: 'Software Engineering', slug: 'software-engineering' },
  courseLevel: { id: 'level-1', name: "Bachelor's", code: 'UG' }, studyModes: [],
  duration: { min: '3', max: '3', unit: 'YEARS' }, credits: null,
  featuredMedia: null, featured: false, availableCountryCount: 1,
  selectedCountry: null, selectedTuition: null, selectedIntakes: [],
  scholarshipAvailable: null, displayOrder: 0,
};
const filterOptions: CourseFilterOptions = {
  levels: [{ value: 'UG', label: "Bachelor's", count: 1 }],
  countries: [{ value: 'united-kingdom', label: 'United Kingdom', count: 1, currencyCode: 'GBP' }],
  subjects: [{ value: 'computer-science', label: 'Computer Science', count: 1 }],
  subSubjects: [{ value: 'software-engineering', label: 'Software Engineering', count: 1,
    subject: { slug: 'computer-science', name: 'Computer Science' } }],
  studyModes: [{ value: 'FULL_TIME', label: 'Full time', count: 1 }],
  intakes: [{ value: 'september', label: 'September', count: 1, startMonth: 9, endMonth: 9 }],
  englishTests: [], extras: [], sorts: [{ value: 'featured', label: 'Recommended' }, { value: 'name', label: 'Alphabetical' }],
  tuition: { enabled: false, country: null, currencyCode: null },
};

function props(raw: Record<string, string> = {}, over: Partial<CourseGuidesResultsProps> = {}): CourseGuidesResultsProps {
  return {
    courses: [guide], meta: { page: 1, limit: 12, total: 25, totalPages: 3 },
    filterOptions, filters: readGuideFilters(raw), unknown: {}, paged: false,
    viewParam: true, programmes: true, taught: [guide.slug], ...over,
  };
}
function page(value: CourseGuidesResultsProps) {
  return new DOMParser().parseFromString(renderToStaticMarkup(<CourseGuidesResults {...value} />), 'text/html');
}
function link(container: ParentNode, text: string) {
  return [...container.querySelectorAll('a')].find((item) => item.textContent?.trim() === text)!;
}
function url(anchor: Element) {
  return new URL(anchor.getAttribute('href')!, 'https://example.test');
}
let root: Root | null = null;
let host: HTMLDivElement | null = null;
function mount(value: CourseGuidesResultsProps) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<CourseGuidesResults {...value} />));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove(); root = null; host = null;
  push.mockReset(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('course guides in a fixed subject level', () => {
  it('preserves ordinary /courses filter groups and existing compare and detail addresses', () => {
    const doc = page(props({ subject: 'computer-science', level: 'UG', subSubject: 'software-engineering' }));
    expect(doc.querySelector('[data-testid=course-guide-form]')?.getAttribute('action')).toBe('/courses');
    expect(doc.querySelector('form.searchwrap')?.getAttribute('action')).toBe('/courses');
    for (const key of ['subject', 'subSubject', 'level'])
      expect(doc.querySelector(`input[name="${key}"][type=checkbox]`)).not.toBeNull();
    expect(link(doc, 'Compare programmes').getAttribute('href')).toBe('/courses?course=bsc-software-engineering#discovery');
    expect(doc.querySelector('.coursecard__name a')?.getAttribute('href')).toBe('/courses/bsc-software-engineering');
  });

  it('removes fixed groups, chips and query fields even when callers include fixed values in filters', () => {
    const doc = page(props({ subject: 'computer-science', subSubject: 'software-engineering', level: 'UG', country: 'united-kingdom' }, { base, scope }));
    for (const key of ['subject', 'subSubject', 'level']) {
      expect(doc.querySelector(`[id="guide-filter-${key}"]`)).toBeNull();
      expect(doc.querySelector(`input[name="${key}"]`)).toBeNull();
    }
    const chips = [...doc.querySelectorAll('.activechips a')];
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('aria-label')).toBe('Remove United Kingdom');
    expect(doc.querySelector('[data-testid=course-guide-form]')?.getAttribute('action')).toBe(base);
    expect(doc.querySelector('form.searchwrap')?.getAttribute('action')).toBe(base);
  });

  it('keeps clear, chip removal and progressive reveal inside the scoped guides view', () => {
    const doc = page(props({ country: 'united-kingdom', studyMode: 'FULL_TIME', sort: 'name' }, { base, scope }));
    const clears = [...doc.querySelectorAll('a')].filter((item) => item.textContent?.trim() === 'Clear all');
    expect(clears).toHaveLength(2);
    for (const anchor of clears) {
      const clear = url(anchor);
      expect(clear.pathname).toBe(base);
      expect([...clear.searchParams]).toEqual([['view', 'guides'], ['sort', 'name']]);
      expect(clear.hash).toBe('#discovery');
    }
    const chip = url(doc.querySelector('a[aria-label="Remove United Kingdom"]')!);
    expect(chip.pathname).toBe(base);
    expect(chip.searchParams.get('country')).toBeNull();
    expect(chip.searchParams.get('studyMode')).toBe('FULL_TIME');
    const reveal = url(link(doc, 'Show more courses'));
    expect(reveal.pathname).toBe(base);
    expect(reveal.searchParams.get('view')).toBe('guides');
    expect(reveal.searchParams.get('country')).toBe('united-kingdom');
    expect(reveal.searchParams.get('pageSize')).toBe('24');
  });

  it('switches a taught guide to scoped programmes, retaining applicable filters and existing detail links', () => {
    const doc = page(props({ q: 'soft', country: 'united-kingdom', studyMode: 'FULL_TIME', sort: 'name' }, { base, scope }));
    const compare = url(link(doc, 'Compare programmes'));
    expect(compare.pathname).toBe(base);
    expect(compare.searchParams.get('course')).toBe(guide.slug);
    expect(compare.searchParams.get('country')).toBe('united-kingdom');
    expect(compare.searchParams.get('studyMode')).toBe('FULL_TIME');
    expect(compare.searchParams.get('sort')).toBe('name');
    for (const key of ['view', 'q', 'subject', 'specialization', 'level']) expect(compare.searchParams.has(key)).toBe(false);
    expect(compare.hash).toBe('#discovery');
    expect(doc.querySelector('.coursecard__name a')?.getAttribute('href')).toBe('/courses/bsc-software-engineering');
    expect(doc.querySelector('.coursecard__uni')?.getAttribute('href')).toBe('/subjects/computer-science');
    expect(doc.querySelector('.coursecard__tags a')?.getAttribute('href')).toBe('/subjects/computer-science/software-engineering');
  });

  it('submits a staged filter choice and sort on the scoped path without leaking the fixed dimensions', () => {
    const container = mount(props({}, { base, scope }));
    const checkbox = container.querySelector<HTMLInputElement>('input[name=country]')!;
    act(() => checkbox.click());
    expect(push).not.toHaveBeenCalled();
    act(() => container.querySelector('form[data-testid=course-guide-form]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const applied = new URL(push.mock.calls[0][0], 'https://example.test');
    expect(applied.pathname).toBe(base);
    expect([...applied.searchParams]).toEqual([['view', 'guides'], ['country', 'united-kingdom']]);
    expect(applied.hash).toBe('#discovery');
    const sort = container.querySelector<HTMLSelectElement>('select[aria-label="Sort courses"]')!;
    act(() => { sort.value = 'name'; sort.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(push.mock.calls[1][0]).toBe(`${base}?view=guides&sort=name#discovery`);
  });

  it('keeps explicit paging and a submitted search on the scoped path', () => {
    const container = mount(props({ q: 'software', country: 'united-kingdom', page: '2' }, {
      base, scope, paged: true, meta: { page: 2, limit: 12, total: 25, totalPages: 3 },
    }));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Next results page"]')!.click());
    const next = new URL(push.mock.calls[0][0], 'https://example.test');
    expect(next.pathname).toBe(base);
    expect(next.searchParams.get('page')).toBe('3');
    expect(next.searchParams.get('q')).toBe('software');
    expect(next.searchParams.get('country')).toBe('united-kingdom');
    act(() => container.querySelector('form.searchwrap')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const searched = new URL(push.mock.calls[1][0], 'https://example.test');
    expect(searched.pathname).toBe(base);
    expect(searched.searchParams.has('page')).toBe(false);
    expect(searched.searchParams.get('q')).toBe('software');
    expect(searched.searchParams.get('country')).toBe('united-kingdom');
    const hidden = [...container.querySelectorAll<HTMLInputElement>('form.searchwrap input[type=hidden]')];
    expect(hidden.map((field) => [field.name, field.value])).toEqual([['view', 'guides'], ['country', 'united-kingdom']]);
  });

  it.each([
    { kind: 'university', index: 0, expected: `${base}?university=university-of-warwick#discovery` },
    { kind: 'programme', index: 1, expected: '/study-abroad/united-kingdom/universities/university-of-warwick/courses/msc-software-engineering' },
  ])('sends fixed scope to suggestions and follows a $kind correctly', async ({ index, expected }) => {
    vi.useFakeTimers();
    const universityHref = `${base}?university=university-of-warwick`;
    const programmeHref = '/study-abroad/united-kingdom/universities/university-of-warwick/courses/msc-software-engineering';
    const fetched: string[] = [];
    const fetch = vi.fn(async (input: string) => {
      fetched.push(input);
      return new Response(JSON.stringify({ data: [
        { name: 'University of Warwick', kind: 'university', href: universityHref },
        { name: 'MSc Software Engineering', kind: 'programme', href: programmeHref },
      ] }));
    });
    vi.stubGlobal('fetch', fetch);
    const container = mount(props({ q: 'war' }, { base, scope }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    const endpoint = new URL(fetched[0], 'https://example.test');
    expect(endpoint.pathname).toBe('/api/courses/suggestions');
    expect(Object.fromEntries(endpoint.searchParams)).toEqual({
      with: 'programmes', subject: 'computer-science', subSubject: 'software-engineering', level: 'UG', q: 'war',
    });
    const options = container.querySelectorAll('[role=option]');
    act(() => options[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(push).toHaveBeenLastCalledWith(expected);
  });
});
