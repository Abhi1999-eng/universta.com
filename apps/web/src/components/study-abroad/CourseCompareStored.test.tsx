// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The bare /compare/courses with a shortlist on this device: it used to say
   "No courses selected yet" and, under that, that two courses were on the
   shortlist. It now opens them, as the design's compare page does. */
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace }),
  usePathname: () => '/compare/courses',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  replace.mockReset();
  window.localStorage.clear();
  vi.resetModules();
});

async function mount(requested: string[]) {
  const { CourseComparePage } = await import('./CourseComparePage');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <CourseComparePage requested={requested} columns={[]} invalid={[]} options={[]} />,
    ),
  );
  return host;
}

describe('the bare comparison address', () => {
  it('opens the shortlist kept on this device, replacing the address', async () => {
    window.localStorage.setItem(
      'universta.compare.courses',
      JSON.stringify([
        { slug: 'mist-at-the-university-of-tokyo', name: 'MIST · University of Tokyo' },
        { slug: 'meng-civil-at-the-university-of-tokyo', name: 'MEng Civil · University of Tokyo' },
      ]),
    );
    const page = await mount([]);
    expect(replace).toHaveBeenCalledWith(
      '/compare/courses?items=mist-at-the-university-of-tokyo,meng-civil-at-the-university-of-tokyo',
    );
    /* The link stays as the way there without script. */
    expect(page.querySelector('.compare-stored a')?.getAttribute('href')).toBe(
      '/compare/courses?items=mist-at-the-university-of-tokyo,meng-civil-at-the-university-of-tokyo',
    );
  });

  it('stays put with nothing on this device', async () => {
    const page = await mount([]);
    expect(replace).not.toHaveBeenCalled();
    expect(page.textContent).toContain('No courses selected yet.');
  });

  it('leaves an address that names programmes to answer for itself', async () => {
    window.localStorage.setItem(
      'universta.compare.courses',
      JSON.stringify([{ slug: 'a', name: 'A' }]),
    );
    await mount(['gone-programme']);
    expect(replace).not.toHaveBeenCalled();
  });
});
