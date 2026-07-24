import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContinentsPage } from './ContinentsPage';
import { CountriesPage } from './CountriesPage';

const mocks = vi.hoisted(() => ({
  listContinents: vi.fn(),
  listCountries: vi.fn(),
  createContinent: vi.fn(),
  updateContinent: vi.fn(),
  deleteContinent: vi.fn(),
}));
vi.mock('./catalog-client', () => mocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));

const meta = { page: 1, limit: 12, total: 0, totalPages: 0 };
const continent = { id: 'continent-1', name: 'Europe', slug: 'europe', code: 'EU', description: null, displayOrder: 1, countriesCount: 0, status: 'ACTIVE', updatedAt: new Date().toISOString() };
const country = { id: 'country-1', name: 'Canada', slug: 'canada', pageHeading: 'Study in Canada', shortDescription: 'Core record', continent: { id: 'continent-1', name: 'North America', slug: 'north-america' }, flag: null, featured: false, displayOrder: 1, statistics: null, iso2Code: 'CA', iso3Code: 'CAN', status: 'DRAFT', updatedAt: new Date().toISOString() };

describe('catalog admin screens', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listContinents.mockResolvedValue({ data: [continent], meta }); mocks.listCountries.mockResolvedValue({ data: [country], meta }); });

  it('renders continent data and countries data with real management links', async () => {
    render(<><ContinentsPage /><CountriesPage /></>);
    await waitFor(() => expect(screen.getByText('Europe')).toBeVisible());
    await waitFor(() => expect(screen.getByText('Canada')).toBeVisible());
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/countries/country-1');
  });

  it('renders an explicit empty state', async () => {
    mocks.listCountries.mockResolvedValue({ data: [], meta });
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByText('No countries found')).toBeVisible());
  });

  it('renders retryable API errors', async () => {
    mocks.listCountries.mockRejectedValue(new Error('Catalog unavailable'));
    render(<CountriesPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Catalog unavailable'));
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
