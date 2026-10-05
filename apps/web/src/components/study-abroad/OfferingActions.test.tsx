// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* What the buttons hand the assessment is the point here, so the shell's
   opener is a spy; the student portal's buttons read the router. */
const openAssessment = vi.fn();
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment, openSelector: () => {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toOfferingDetail } from '@/lib/offering-detail';
import { OfferingGuide } from './OfferingGuide';

/**
 * The course page's controls that need a browser: "Check my eligibility",
 * which files its lead under the course page, and the "Is this course right
 * for you?" bar, which shows once the hero has gone and stands down again
 * when the reader reaches the footer, rather than covering it.
 */

/* React reports updates outside act() unless told it is under test. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const href =
  '/study-abroad/united-kingdom/universities/university-of-oxford/courses/university-of-oxford-msc-computer-science';

const detail = toOfferingDetail({
  id: 'o1',
  name: 'MSc Computer Science',
  slug: 'university-of-oxford-msc-computer-science',
  genericCourse: {
    slug: 'msc-computer-science',
    subject: { name: 'Computer Science', slug: 'computer-science' },
    courseLevel: { code: 'PG', name: "Master's" },
  },
  university: {
    name: 'University of Oxford',
    slug: 'university-of-oxford',
    country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
    campuses: [{ city: 'Oxford' }],
  },
  intakes: [],
  requirements: [],
  moreAtUniversity: { total: 1, rows: [] },
  related: [],
  elsewhere: [],
})!;

let host: HTMLDivElement;
let root: Root;

/** Where the hero and the footer sit on the screen, as the browser would say. */
function place(id: string | null, selector: string | null, box: { top: number; bottom: number }) {
  const element = id ? document.getElementById(id) : document.querySelector(selector!);
  element!.getBoundingClientRect = () => ({ ...box, left: 0, right: 0, width: 0, height: box.bottom - box.top, x: 0, y: box.top, toJSON: () => ({}) });
}

beforeEach(async () => {
  openAssessment.mockClear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <>
        <OfferingGuide detail={detail} />
        <footer className="footer">© Universta</footer>
      </>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const sticky = () => host.querySelector('.coursesticky')!;
const scroll = async () => {
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
  });
};

describe('Check my eligibility on a course page', () => {
  it('files the lead under the course page, from the section and from the sticky bar', async () => {
    for (const intent of ['course-eligibility', 'course-sticky']) {
      await act(async () => {
        host
          .querySelector<HTMLButtonElement>(`[data-testid="assessment-cta-${intent}"]`)!
          .click();
      });
    }
    expect(openAssessment).toHaveBeenCalledTimes(2);
    for (const [context] of openAssessment.mock.calls)
      expect(context).toMatchObject({ countrySlug: 'united-kingdom', sourcePagePath: href });
  });
});

describe('the “Is this course right for you?” bar', () => {
  it('shows once the hero has gone, and stands down when the footer comes into view', async () => {
    expect(sticky().getAttribute('data-show')).toBe('false');

    place('course-hero', null, { top: -900, bottom: -10 });
    place(null, 'footer.footer', { top: 4000, bottom: 4400 });
    await scroll();
    expect(sticky().getAttribute('data-show')).toBe('true');

    /* The foot of the page: the footer is on screen, and the bar would sit
       over its last line. */
    place(null, 'footer.footer', { top: window.innerHeight - 200, bottom: window.innerHeight + 200 });
    await scroll();
    expect(sticky().getAttribute('data-show')).toBe('false');

    place(null, 'footer.footer', { top: 4000, bottom: 4400 });
    await scroll();
    expect(sticky().getAttribute('data-show')).toBe('true');

    place('course-hero', null, { top: 0, bottom: 600 });
    await scroll();
    expect(sticky().getAttribute('data-show')).toBe('false');
  });
});
