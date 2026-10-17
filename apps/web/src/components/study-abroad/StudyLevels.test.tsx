import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StudyLevelPanel } from '@/lib/study-levels';

vi.mock('./LevelSwitch', () => ({
  LevelSwitch: ({ panels }: { panels: ReactNode[] }) => <div>{panels}</div>,
}));

const { StudyLevels } = await import('./StudyLevels');

const panel = (code: string, name: string): StudyLevelPanel => ({
  group: { level: { id: code.toLowerCase(), code, name, educationOrder: 1 }, count: 0, courses: [] },
  specializations: [],
});

/**
 * A level with nothing listed in a destination links to the field at that
 * level everywhere -- only where the field has a page at it.
 */
describe('a destination’s study levels', () => {
  const render = (href: (code: string) => string | null) =>
    renderToStaticMarkup(
      <StudyLevels
        panels={[panel('UG', "Bachelor's"), panel('DIPLOMA', 'Diploma')]}
        where="in Japan"
        allHref={(code) => `/courses?level=${code}`}
        courseHref={(course) => `/courses/${course.slug}`}
        elsewhere={{ href, label: (level) => `${level} in Computing, every destination` }}
      />,
    );

  it('links an empty level to its page everywhere', () => {
    const html = render((code) => `/subjects/computing/${code.toLowerCase()}`);
    expect(html.match(/class="studylevel__elsewhere"/g)).toHaveLength(2);
    expect(html).toContain('href="/subjects/computing/ug">Bachelor&#x27;s in Computing, every destination');
  });

  it('draws no link for a level the field has no page at', () => {
    const html = render((code) => (code === 'UG' ? '/subjects/computing/bachelors' : null));
    expect(html.match(/class="studylevel__elsewhere"/g)).toHaveLength(1);
    expect(html).not.toContain('Diploma in Computing, every destination');
  });
});
