import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CountriesPage } from './CountriesPage';
import { clearFlash, queueFlash } from '@/features/shared/Flash';

/**
 * Eleven columns held the table to a 1180px floor, so on a normal desktop the
 * Actions cell sat past the right edge and Edit could only be reached by
 * scrolling the table sideways. The list keeps the six columns it is scanned
 * for; ISO, tags, linked records, featured and order are still edited in the
 * country editor, so nothing is lost.
 */

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listCountries: vi.fn(),
  listSubjects: vi.fn(),
  listAllSubjects: vi.fn(),
  listCountryTags: vi.fn(),
  publishCountry: vi.fn(),
  unpublishCountry: vi.fn(),
  deleteCountry: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const meta = { page: 1, limit: 12, total: 1, totalPages: 1 };
const country = {
  id: 'country-1',
  name: 'Malta',
  slug: 'malta',
  pageHeading: 'Study in Malta',
  shortDescription: 'Core record',
  continent: { id: 'continent-1', name: 'Europe', slug: 'europe' },
  flag: null,
  featured: true,
  displayOrder: 18,
  statistics: null,
  iso2Code: 'MT',
  iso3Code: 'MLT',
  subjects: [{ id: 's1', name: 'Computer Science', slug: 'computer-science' }],
  tags: [{ id: 't1', name: 'English Taught', slug: 'english-taught' }],
  linkedCounts: { universities: 1, courses: 1, scholarships: 0 },
  status: 'DRAFT',
  updatedAt: new Date('2026-09-05T00:00:00Z').toISOString(),
};

const KEPT = ['Country', 'Continent', 'Subjects', 'Status', 'Updated', 'Actions'];
const REMOVED = ['ISO', 'Tags', 'Linked records', 'Featured', 'Order'];

describe('countries list is compact enough to reach its actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFlash();
    mocks.listContinents.mockResolvedValue({ data: [], meta });
    mocks.listCountries.mockResolvedValue({ data: [country], meta });
    mocks.listAllSubjects.mockResolvedValue([]);
    mocks.listCountryTags.mockResolvedValue({ data: [], meta });
  });

  it('keeps exactly the six scannable columns', async () => {
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Malta')).toBeVisible());

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim());
    expect(headers).toEqual(KEPT);
    for (const removed of REMOVED) expect(headers).not.toContain(removed);
  });

  it('drops the forced wide layout that pushed Actions off screen', async () => {
    const { container } = render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Malta')).toBeVisible());

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.className).not.toContain('min-w-');
  });

  it('renders every row action in the row, not off the end of it', async () => {
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Malta')).toBeVisible());

    const row = screen.getByText('Malta').closest('tr');
    expect(row).not.toBeNull();
    const actions = within(row as HTMLElement);
    expect(actions.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/countries/country-1',
    );
    expect(actions.getByRole('button', { name: 'Publish' })).toBeVisible();
    expect(actions.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  it('still surfaces the data the dropped columns carried, one level in', async () => {
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Malta')).toBeVisible());
    /* The editor link is the route to ISO, tags, featured and order -- the
     * values are not gone, only off the list. */
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/countries/country-1',
    );
  });

  it('shows a publish confirmation handed over by the country editor', async () => {
    queueFlash({ tone: 'success', message: 'Malta published successfully.' });
    render(<CountriesPage />);

    const banner = await screen.findByText('Malta published successfully.');
    expect(banner.closest('[data-flash-tone]')).toHaveAttribute('data-flash-tone', 'success');
  });

  it('shows a handed-over confirmation once, not again on the next visit', async () => {
    queueFlash({ tone: 'success', message: 'Malta published successfully.' });
    const first = render(<CountriesPage />);
    await screen.findByText('Malta published successfully.');
    first.unmount();

    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('Malta')).toBeVisible());
    expect(screen.queryByText('Malta published successfully.')).toBeNull();
  });
});
