import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/study-abroad-consultants/silverbeck',
  useSearchParams: () => new URLSearchParams(),
}));

import { ConsultantGuide, type ConsultantGuideProps } from './ConsultantGuide';

const props = (consultant: Partial<ConsultantGuideProps['consultant']> = {}): ConsultantGuideProps => ({
  consultant: {
    name: 'Silverbeck Admissions Collective',
    slug: 'silverbeck',
    shortDescription: 'Counsels students on studying abroad.',
    description: null,
    email: null,
    phone: null,
    websiteUrl: null,
    verified: true,
    verifiedAt: '2026-10-01T00:00:00.000Z',
    sourceReference: null,
    ...consultant,
  },
  countries: [],
  services: ['Visa documentation'],
  languages: ['English'],
  locations: [],
  guides: new Set(),
});

const render = (over: Partial<ConsultantGuideProps['consultant']> = {}) =>
  renderToStaticMarkup(<ConsultantGuide {...props(over)} />);

/** The Verification section's "Last verified" cell. */
const lastVerified = (html: string) =>
  html.match(/<span class="label">Last verified<\/span><b>([^<]*)<\/b>/)?.[1];

describe('a consultant profile\'s verification', () => {
  it('dates a verified consultant in the hero and the Verification section', () => {
    const html = render();
    expect(html).toContain('Verified Oct 1, 2026');
    expect(lastVerified(html)).toBe('Oct 1, 2026');
  });

  it('says a verified consultant\'s date was not recorded, never "Not verified"', () => {
    const html = render({ verifiedAt: null });
    expect(lastVerified(html)).toBe('Verified (date not recorded)');
    expect(html).not.toContain('dated the check');
    expect(html).toContain('The date of that check was not recorded.');
  });

  it('prints no date for a consultant that is not verified', () => {
    /* The page passes the record through consultantVerification, which
       drops the date; the guide holds the same rule on its own. */
    const html = render({ verified: false, verifiedAt: '2026-10-01T00:00:00.000Z' });
    expect(html).not.toContain('Oct 1, 2026');
    expect(lastVerified(html)).toBe('Not verified');
    expect(html).toContain('Not yet verified');
  });
});
