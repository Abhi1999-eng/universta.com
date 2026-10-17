import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpecializationsPage } from './SpecializationsPage';

/**
 * A specialization's page needs its subject published as well. A published
 * specialization under a draft subject is not on the site, so its row offers
 * no "View on site" (it would open a 404) and says why instead.
 */

const mocks = vi.hoisted(() => ({
  deleteSubSubject: vi.fn(),
  listAllSubjects: vi.fn(),
  listSpecializations: vi.fn(),
  publishSubSubject: vi.fn(),
  unpublishSubSubject: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/specializations' }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const meta = { page: 1, limit: 12, total: 1, totalPages: 1 };
const row = (name: string, slug: string, subjectStatus?: string) => ({
  id: `spec-${slug}`,
  subject: { id: 'subject-1', name: 'Marine Sciences', slug: 'marine-sciences', ...(subjectStatus ? { status: subjectStatus } : {}) },
  name,
  slug,
  shortDescription: 'Life in the ocean.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  featured: false,
  displayOrder: 0,
  courseLevels: [],
  status: 'PUBLISHED',
  publishedAt: null,
  createdAt: 'c',
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  mocks.listAllSubjects.mockResolvedValue([]);
});

describe('specializations list', () => {
  it('flags a specialization whose subject is a draft, and offers no live link for it', async () => {
    mocks.listSpecializations.mockResolvedValue({ data: [row('Marine Biology', 'marine-biology', 'DRAFT'), row('Oceanography', 'oceanography', 'PUBLISHED')], meta });
    render(<SpecializationsPage />);

    const drafted = (await screen.findByRole('link', { name: 'Marine Biology' })).closest('tr') as HTMLElement;
    const chip = within(drafted).getByText('Subject is draft');
    expect(chip).toHaveAttribute('title', expect.stringContaining('Publish the subject first'));
    expect(within(drafted).queryByRole('link', { name: /View on site/ })).toBeNull();

    const live = screen.getByRole('link', { name: 'Oceanography' }).closest('tr') as HTMLElement;
    expect(within(live).queryByText('Subject is draft')).toBeNull();
    expect(within(live).getByRole('link', { name: /View on site/ }).getAttribute('href')).toMatch(/\/subjects\/marine-sciences\/oceanography$/);
  });

  it('treats a row without the subject’s status as live, as before', async () => {
    mocks.listSpecializations.mockResolvedValue({ data: [row('Marine Biology', 'marine-biology')], meta });
    render(<SpecializationsPage />);
    const tr = (await screen.findByRole('link', { name: 'Marine Biology' })).closest('tr') as HTMLElement;
    expect(within(tr).queryByText('Subject is draft')).toBeNull();
    expect(within(tr).getByRole('link', { name: /View on site/ })).toBeInTheDocument();
  });

  it('says a delete takes the level pages with it', async () => {
    mocks.listSpecializations.mockResolvedValue({ data: [row('Marine Biology', 'marine-biology', 'PUBLISHED')], meta });
    const user = userEvent.setup();
    render(<SpecializationsPage />);
    const tr = (await screen.findByRole('link', { name: 'Marine Biology' })).closest('tr') as HTMLElement;
    await user.click(within(tr).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('with its sections, FAQs and level pages');
  });
});
