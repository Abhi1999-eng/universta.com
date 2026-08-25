import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The directory is a client component that reads the router to build filter
// links; static rendering only needs those hooks to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/study-abroad-consultants',
  useSearchParams: () => new URLSearchParams(),
}));
import {
  ConsultantsReference,
  type ConsultantsReferenceProps,
} from './ConsultantsReference';

/**
 * The consultants directory used to catch any Phase 1 list failure and render
 * the ordinary empty directory: "0 consultants", "No consultants match these
 * filters". A visitor could not tell an outage from a directory that genuinely
 * has nothing in it, and neither could anyone watching the page. These cover
 * the three states separately, plus the metric strip that used to render four
 * cards containing only an em dash.
 */

function build(over: Partial<ConsultantsReferenceProps> = {}): ConsultantsReferenceProps {
  return {
    rows: [],
    meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    filters: {},
    facets: { countries: [], services: [], languages: [], locations: [] },
    managed: null,
    ...over,
  } as ConsultantsReferenceProps;
}

const render = (props: ConsultantsReferenceProps) => renderToStaticMarkup(<ConsultantsReference {...props} />);

describe('consultants directory states', () => {
  it('says the directory could not be loaded, and never claims zero', () => {
    const html = render(build({ loadFailed: true }));
    expect(html).toContain('Consultants could not be loaded');
    expect(html).toContain('Directory unavailable');
    // The dangerous regression: an outage reported as a factual count.
    expect(html).not.toContain('No consultants match these filters');
    expect(html).not.toMatch(/<b>0<\/b>\s*consultant/);
  });

  it('reports a genuinely empty directory as published-yet, not as a filter miss', () => {
    const html = render(build());
    expect(html).toContain('No consultants published yet');
    expect(html).not.toContain('Consultants could not be loaded');
    expect(html).not.toContain('No consultants match these filters');
  });

  it('reports a filtered miss as a filter miss', () => {
    const html = render(build({ filters: { country: 'canada' } }));
    expect(html).toContain('No consultants match these filters');
    expect(html).toContain('Clear filters');
  });

  it('hides the metric strip when there is not a single figure to show', () => {
    const html = render(build());
    // Four cards reading "—" is chrome without information.
    expect(html).not.toContain('Destinations covered');
    expect(html).not.toContain('hstat');
  });

  it('shows the metric strip once a figure exists', () => {
    const html = render(
      build({
        meta: { page: 1, limit: 12, total: 3, totalPages: 1 },
        facets: {
          countries: [{ value: 'canada', label: 'Canada' }],
          services: [],
          languages: [],
          locations: [],
        },
      }),
    );
    expect(html).toContain('hstat');
    expect(html).toContain('Consultants');
    expect(html).toContain('Destinations covered');
    // A card with no figure of its own still stays out.
    expect(html).not.toContain('Languages</span>');
  });

  it('never offers "Show 0 results" as the primary action', () => {
    expect(render(build())).not.toMatch(/Show\s*0\s*result/);
    expect(render(build({ filters: { country: 'canada' } }))).not.toMatch(/Show\s*0\s*result/);
  });
});
