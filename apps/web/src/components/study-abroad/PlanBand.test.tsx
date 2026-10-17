import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn() }),
}));

const { PlanBand } = await import('./PlanBand');

/** The ghost links beside the assessment button, in order. */
const ghosts = (html: string) =>
  [...html.matchAll(/<a class="btn btn--onnavy-ghost btn--lg" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => [match[1], match[2]]);

describe('the closing band', () => {
  it('offers the directory by default, or the way on it is given', () => {
    expect(ghosts(renderToStaticMarkup(<PlanBand />))).toEqual([['#directory', 'Browse the directory']]);
    expect(ghosts(renderToStaticMarkup(<PlanBand secondary={{ href: '/subjects/computing', label: 'View subject' }} />))).toEqual([
      ['/subjects/computing', 'View subject'],
    ]);
  });

  it('offers further ways on after it, in order and in the same style', () => {
    const html = renderToStaticMarkup(
      <PlanBand
        secondary={{ href: '/subjects/computing/ai', label: 'View specialization' }}
        more={[
          { href: '/subjects/computing', label: 'View subject' },
          { href: '/subjects', label: 'All subjects' },
        ]}
      />,
    );
    expect(ghosts(html)).toEqual([
      ['/subjects/computing/ai', 'View specialization'],
      ['/subjects/computing', 'View subject'],
      ['/subjects', 'All subjects'],
    ]);
    expect(html).toContain('data-testid="plan-band-assessment"');
  });
});
