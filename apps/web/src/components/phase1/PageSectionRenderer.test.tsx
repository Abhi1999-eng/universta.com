// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/** What the public lists answer for each record type. */
const lists: Record<string, unknown[]> = {
  testimonials: [
    { id: 'q-1', quote: 'Clear advice at every step.', attribution: 'Aarti Nair', attributionNote: 'Master’s applicant', imageMedia: null },
    { id: 'q-2', quote: 'Unsigned words.', attribution: null, attributionNote: null },
  ],
  'success-stories': [
    {
      id: 's-1',
      slug: 'from-pune-to-tokyo',
      title: 'From Pune to Tokyo',
      journey: '<p>At {universityName} I learnt to apply early.</p>',
      university: { name: 'The University of Tokyo' },
    },
  ],
};
vi.mock('@/lib/phase1', () => ({
  phaseList: async (resource: string) => ({ data: lists[resource] ?? [], meta: { total: (lists[resource] ?? []).length } }),
}));
vi.mock('@/lib/countries', () => ({ getCountries: async () => ({ data: [] }) }));
vi.mock('@/lib/catalog', () => ({ getCourses: async () => ({ data: [] }) }));
vi.mock('@/lib/internal-links', () => ({ resolveHref: async (url: string) => url ?? null }));

const { PageSectionRenderer } = await import('./PageSectionRenderer');
const { Section } = await import('@/components/study-abroad/ManagedSections');

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const section = (sectionType: string, bodyJson: Record<string, unknown> = {}) => ({
  id: sectionType,
  sectionType,
  title: 'Section',
  bodyJson,
});

describe('a Website Builder Testimonials section (T-M2-web)', () => {
  it('draws the zip quote card with the student and role line on a managed page', async () => {
    const doc = parse(renderToStaticMarkup(await Section({ section: section('TESTIMONIALS') })));
    const cards = doc.querySelectorAll('.quotes figure.quote');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.quote__t')?.textContent).toBe('Clear advice at every step.');
    expect(cards[0].querySelector('.quote__n')?.textContent).toBe('Aarti Nair');
    expect(cards[0].querySelector('.quote__r')?.textContent).toBe('Master’s applicant');
    /* No empty name above an unsigned quote. */
    expect(doc.querySelectorAll('strong')).toHaveLength(0);
    expect(cards[1].querySelector('.quote__by')).toBeNull();
  });

  it('draws the same card in the older renderer, with no empty <cite>', async () => {
    const doc = parse(renderToStaticMarkup(await PageSectionRenderer({ section: section('TESTIMONIALS') })));
    expect(doc.querySelectorAll('figure.quote')).toHaveLength(2);
    expect(doc.querySelectorAll('cite')).toHaveLength(0);
    expect(doc.querySelector('.quote__n')?.textContent).toBe('Aarti Nair');
  });

  it('shows the testimonials an editor picked by id, in their order', async () => {
    const doc = parse(
      renderToStaticMarkup(await Section({ section: section('TESTIMONIALS', { dataMode: 'manual', picks: ['q-2', 'q-1'] }) })),
    );
    expect([...doc.querySelectorAll('.quote__t')].map((node) => node.textContent)).toEqual([
      'Unsigned words.',
      'Clear advice at every step.',
    ]);
  });
});

describe('a Website Builder Success stories section (SS-C7)', () => {
  it('links each story and shows a plain, resolved excerpt', async () => {
    const managed = parse(renderToStaticMarkup(await Section({ section: section('SUCCESS_STORIES') })));
    expect(managed.querySelector('.h-list a')?.getAttribute('href')).toBe('/success-stories/from-pune-to-tokyo');
    expect(managed.querySelector('.h-list span')?.textContent).toBe('At The University of Tokyo I learnt to apply early.');

    const older = renderToStaticMarkup(await PageSectionRenderer({ section: section('SUCCESS_STORIES') }));
    expect(older).toContain('href="/success-stories/from-pune-to-tokyo"');
    expect(older).not.toContain('&lt;p&gt;');
    expect(older).not.toContain('{universityName}');
  });
});
