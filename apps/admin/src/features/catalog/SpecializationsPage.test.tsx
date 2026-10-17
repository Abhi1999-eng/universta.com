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

  /* Publishing the subject publishes the subject alone, so a draft under a
     draft subject needs publishing on its own afterwards, and says so. */
  it('tells a draft under a draft subject that publishing the subject will not publish it', async () => {
    mocks.listSpecializations.mockResolvedValue({ data: [{ ...row('Marine Biology', 'marine-biology', 'DRAFT'), status: 'DRAFT' }, row('Oceanography', 'oceanography', 'DRAFT')], meta });
    render(<SpecializationsPage />);

    const draft = (await screen.findByRole('link', { name: 'Marine Biology' })).closest('tr') as HTMLElement;
    expect(within(draft).getByText('Subject is draft')).toHaveAttribute('title', expect.stringContaining('Publishing the subject does not publish this specialization'));
    const published = screen.getByRole('link', { name: 'Oceanography' }).closest('tr') as HTMLElement;
    expect(within(published).getByText('Subject is draft').getAttribute('title')).not.toContain('does not publish');
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

  /* The Levels column read only a specialization's own ticks, so one with
     published Bachelor's courses and no ticks read "—" here while the site
     listed it at Bachelor's. It shows the offered set now. */
  it('shows the levels the site offers each specialization at, and says where they come from', async () => {
    const ug = { id: 'lvl-ug', code: 'UG', name: "Bachelor's" };
    const pg = { id: 'lvl-pg', code: 'PG', name: "Master's" };
    mocks.listSpecializations.mockResolvedValue({
      data: [
        { ...row('Marine Biology', 'marine-biology', 'PUBLISHED'), courseLevels: [pg], offeredLevels: [ug, pg] },
        { ...row('Oceanography', 'oceanography', 'PUBLISHED'), courseLevels: [pg], offeredLevels: [] },
        { ...row('Hydrology', 'hydrology', 'PUBLISHED'), courseLevels: [pg] },
      ],
      meta: { ...meta, total: 3 },
    });
    render(<SpecializationsPage />);
    const offered = (await screen.findByRole('link', { name: 'Marine Biology' })).closest('tr') as HTMLElement;
    expect(within(offered).getByText("Bachelor's, Master's")).toBeInTheDocument();
    const none = screen.getByRole('link', { name: 'Oceanography' }).closest('tr') as HTMLElement;
    expect(within(none).getByText('—')).toBeInTheDocument();
    /* A row without the offered set still shows its ticks. */
    const ticked = screen.getByRole('link', { name: 'Hydrology' }).closest('tr') as HTMLElement;
    expect(within(ticked).getByText("Master's")).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Levels' }).querySelector('[title]')).toHaveAttribute('title', expect.stringMatching(/ticked on it and the levels of its published courses/));
  });
});
