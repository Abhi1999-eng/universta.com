import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page, { generateMetadata } from './page';

const reads = vi.hoisted(() => ({ compare: vi.fn(), options: vi.fn() }));
vi.mock('@/lib/phase1', () => ({ phaseCompare: reads.compare, phaseComparisonOptions: reads.options }));
vi.mock('@/lib/static-page-seo', () => ({ staticPageMetadata: async () => ({ title: 'Compare universities | Universta', robots: { index: false, follow: true } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const row = (slug: string) => ({ name: `University ${slug.toUpperCase()}`, slug, _count: { offerings: 2 }, campuses: [], accreditations: [] });
beforeEach(() => {
  reads.compare.mockReset();
  reads.options.mockReset().mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => ({ slug, name: row(slug).name })));
});
const html = async (items: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ items }) }));

describe('the five-column university comparison page', () => {
  it('requests five unique universities and renders the URL order even if the database answers in another order', async () => {
    reads.compare.mockResolvedValue({ items: ['e', 'd', 'c', 'b', 'a'].map(row), invalid: [] });
    const rendered = await html('A,b,a,c,d,e,f');
    expect(reads.compare).toHaveBeenCalledWith('universities', ['a', 'b', 'c', 'd', 'e']);
    const headers = rendered.slice(rendered.indexOf('<thead>'), rendered.indexOf('</thead>'));
    const positions = ['A', 'B', 'C', 'D', 'E'].map((letter) => headers.indexOf(`University ${letter}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(headers).not.toContain('University F');
  });

  it('reads the last two universities from an older API that only answered three', async () => {
    reads.compare.mockResolvedValueOnce({ items: ['a', 'b', 'c'].map(row), invalid: [] }).mockResolvedValueOnce({ items: ['d', 'e'].map(row), invalid: [] });
    const rendered = await html('a,b,c,d,e');
    expect(reads.compare).toHaveBeenNthCalledWith(2, 'universities', ['d', 'e']);
    expect(rendered).toContain('University E');
    expect(rendered).not.toContain('left out of the comparison');
  });

  it('keeps valid columns when picker options fail, and explains unpublished slugs', async () => {
    reads.compare.mockResolvedValue({ items: [row('a')], invalid: ['missing'] });
    reads.options.mockRejectedValue(new Error('options unavailable'));
    const rendered = await html('a,missing');
    expect(rendered).toContain('University A');
    expect(rendered).toContain('left out of the comparison: missing');
  });

  it('reports a failed read as unavailable and keeps the noindex SEO without a second title suffix', async () => {
    reads.compare.mockRejectedValue(new Error('comparison unavailable'));
    expect(await html('a')).toContain('could not be loaded');
    expect(await generateMetadata()).toEqual({ title: { absolute: 'Compare universities | Universta' }, robots: { index: false, follow: true } });
  });
});
