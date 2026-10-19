// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  value: null as null | { status: string; api: (path: string) => Promise<unknown> },
}));
vi.mock('@/components/student/StudentSession', () => ({
  useStudentSessionIfAny: () => session.value,
}));

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { SavedCourses, SavedCoursesBand, toSavedCourses } from './SavedCourses';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The design's "My saved courses" under the comparison: the programmes a
 * student saved with the heart, each with "Add to comparison"; signed out,
 * where the list comes from and the way to sign in.
 */

const saved = [
  {
    id: 's1',
    offering: {
      id: 'o1',
      name: 'MSc Computer Science at University of Warwick',
      slug: 'warwick-msc-cs',
      status: 'PUBLISHED',
      university: { name: 'University of Warwick', slug: 'university-of-warwick' },
    },
  },
  {
    id: 's2',
    offering: {
      id: 'o2',
      name: 'MIST',
      slug: 'utokyo-mist',
      status: 'PUBLISHED',
      university: { name: 'The University of Tokyo', slug: 'university-of-tokyo' },
    },
  },
  {
    id: 's3',
    offering: { id: 'o3', name: 'Old course', slug: 'old', status: 'ARCHIVED', university: null },
  },
];

describe('the saved courses as the band reads them', () => {
  it('takes the programme’s name without its university, and marks one no longer listed', () => {
    expect(toSavedCourses(saved)).toEqual([
      { slug: 'warwick-msc-cs', name: 'MSc Computer Science', university: 'University of Warwick', live: true },
      { slug: 'utokyo-mist', name: 'MIST', university: 'The University of Tokyo', live: true },
      { slug: 'old', name: 'Old course', university: null, live: false },
    ]);
  });

  it('ignores a malformed answer', () => {
    expect(toSavedCourses(null)).toEqual([]);
    expect(toSavedCourses([{ offering: null }, {}])).toEqual([]);
  });
});

describe('the band', () => {
  const band = (state: Parameters<typeof SavedCoursesBand>[0]['state'], picked: string[] = []) =>
    renderToStaticMarkup(
      <SavedCoursesBand state={state} picked={picked} returnTo="/compare/courses?items=a" />,
    );

  it('offers each saved programme to the comparison, one step from it', () => {
    const html = band({ kind: 'ready', rows: toSavedCourses(saved) }, ['a']);
    expect(html).toContain('My saved courses');
    expect(html).toContain('<b>MSc Computer Science</b><em>University of Warwick</em>');
    expect(html).toContain('href="/compare/courses?items=a,warwick-msc-cs"');
    expect(html).toContain('Add to comparison');
    expect(html).toContain('No longer listed');
  });

  it('says which are already compared, and when the comparison is full', () => {
    const rows = toSavedCourses(saved);
    expect(band({ kind: 'ready', rows }, ['warwick-msc-cs'])).toContain('In the comparison');
    const full = band({ kind: 'ready', rows }, ['a', 'b', 'c', 'd']);
    expect(full).not.toContain('Add to comparison');
    expect(full).toContain('remove one to add this');
  });

  it('signed out, says where the list comes from and offers the sign-in back to this comparison', () => {
    const html = band({ kind: 'signed-out' });
    expect(html).toContain('/student/login?returnTo=%2Fcompare%2Fcourses%3Fitems%3Da');
    expect(html).toContain('heart on a course card');
  });

  it('says so when nothing is saved yet', () => {
    const html = band({ kind: 'ready', rows: [] });
    expect(html).toContain('You have not saved a course yet.');
    /* In our own words, not the reference build's empty line. */
    expect(html).not.toContain('Use the heart on any course card');
  });
});

describe('reading the student’s account', () => {
  const mount = async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<SavedCourses picked={[]} />);
    });
    await act(async () => {});
    return { host, done: () => act(() => root.unmount()) };
  };

  it('lists what a signed-in student saved', async () => {
    const api = vi.fn(async () => ({ offerings: saved }));
    session.value = { status: 'authenticated', api };
    const { host, done } = await mount();
    expect(api).toHaveBeenCalledWith('/saved');
    expect(host.textContent).toContain('MSc Computer Science');
    done();
  });

  it('asks nothing of the account when signed out', async () => {
    const api = vi.fn();
    session.value = { status: 'anonymous', api };
    const { host, done } = await mount();
    expect(api).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Sign in to see them');
    done();
  });

  it('says so when the account cannot be read', async () => {
    session.value = { status: 'authenticated', api: async () => Promise.reject(new Error('down')) };
    const { host, done } = await mount();
    expect(host.textContent).toContain('could not be loaded');
    done();
  });
});
