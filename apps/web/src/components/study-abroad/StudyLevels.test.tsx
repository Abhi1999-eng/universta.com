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
 * Every level in a destination links to the field at that level everywhere
 * -- its level page -- only where the field has a page at it.
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

  it('links a level with courses here to its page everywhere too', () => {
    const listed: StudyLevelPanel = {
      group: { ...panel('PG', "Master's").group, count: 2 },
      specializations: [],
    };
    const html = renderToStaticMarkup(
      <StudyLevels
        panels={[listed]}
        where="in Japan"
        allHref={(code) => `/courses?level=${code}`}
        courseHref={(course) => `/courses/${course.slug}`}
        elsewhere={{
          href: () => '/subjects/computing/masters',
          label: (level) => `${level} in Computing, every destination`,
        }}
      />,
    );
    /* The level's own courses here first, then the level everywhere. */
    expect(html).toContain('href="/courses?level=PG"');
    expect(html).toContain(
      'href="/subjects/computing/masters">Master&#x27;s in Computing, every destination',
    );
    expect(html.indexOf('href="/courses?level=PG"')).toBeLessThan(
      html.indexOf('href="/subjects/computing/masters"'),
    );
  });
});
