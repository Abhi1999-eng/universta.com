import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadsPage } from './LeadsPage';

const mocks = vi.hoisted(() => ({
  listLeads: vi.fn(),
  getLeadOptions: vi.fn(),
  push: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock('./leads-client', () => ({
  listLeads: mocks.listLeads,
  getLeadOptions: mocks.getLeadOptions,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/leads',
  useSearchParams: () => mocks.search,
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href} {...props}>{children}</a>,
}));

const options = {
  statuses: ['NEW', 'CONTACTED'],
  sourceTypes: ['GENERAL', 'COUNTRY'],
  countries: [{ id: 'country-1', name: 'Canada' }],
  courseLevels: [{ id: 'level-1', name: 'Undergraduate', code: 'UG' }],
  intakes: [{ id: 'intake-1', name: 'September', shortLabel: 'Sep' }],
};
const lead = {
  id: 'lead-1',
  leadNumber: 'LD-TEST',
  formType: 'COUNSELLING',
  sourceType: 'COUNTRY',
  sourceEntityId: 'country-1',
  sourcePageUrl: '/countries/canada',
  firstName: 'Fictional',
  lastName: 'Student',
  email: 'fictional@example.invalid',
  phoneCountryCode: null,
  phoneNumber: '+15550102020',
  message: null,
  status: 'NEW',
  priority: 'NORMAL',
  privacyConsent: true,
  marketingConsent: false,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  referrerUrl: null,
  landingPageUrl: '/counselling',
  createdAt: '2026-07-26T08:00:00.000Z',
  updatedAt: '2026-07-26T08:00:00.000Z',
  preferredCountry: options.countries[0],
  preferredCourse: null,
  preferredSubject: null,
  preferredCourseLevel: options.courseLevels[0],
  preferredIntake: options.intakes[0],
};

describe('LeadsPage', () => {
  beforeEach(() => {
    mocks.search = new URLSearchParams();
    mocks.listLeads.mockResolvedValue({
      data: [lead],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    mocks.getLeadOptions.mockResolvedValue(options);
  });

  it('renders a responsive lead list and applies URL-backed filters', async () => {
    render(<LeadsPage />);
    await waitFor(() =>
      expect(screen.getAllByText('Fictional Student').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByRole('link', { name: 'View lead' })[0]).toHaveAttribute(
      'href',
      '/leads/lead-1',
    );
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'fictional@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(mocks.push).toHaveBeenCalledWith(
      '/leads?q=fictional%40example.invalid',
      { scroll: false },
    );
  });

  it('renders explicit empty and retryable error states', async () => {
    mocks.listLeads.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const { unmount } = render(<LeadsPage />);
    await waitFor(() => expect(screen.getByText('No leads found')).toBeVisible());
    unmount();

    mocks.listLeads.mockRejectedValueOnce(new Error('Lead API unavailable'));
    render(<LeadsPage />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Lead API unavailable'),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
