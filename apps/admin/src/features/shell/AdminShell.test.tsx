import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

const mockUseAuth = vi.fn();
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() }));

describe('AdminShell', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { firstName: 'Admin', lastName: null, email: 'admin@example.com', roles: ['SUPER_ADMIN'] },
      logout: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders the authenticated user, role, active dashboard, and page content', () => {
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    expect(screen.getByText('admin@example.com')).toBeVisible();
    expect(screen.getAllByText('SUPER_ADMIN').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Dashboard content')).toBeVisible();
  });

  it('groups every major Phase 1 resource under a labeled section with a real, non-placeholder link', () => {
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    // Group headings required by the client-specified nav structure.
    for (const group of [
      'Website Builder',
      'Content records',
      'Destinations',
      'Academics',
      'Universities',
      'Scholarships',
      'Consultants',
      'Enquiries and Counselling',
      'Careers and events',
      'Platform tools',
    ]) {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    }
    // A first-time admin must be able to find each of these without typing a URL.
    const expectedLinks: Array<[string, string]> = [
      // Website Builder must be reachable from the sidebar, not only by URL.
      ['Website Pages', '/website'],
      ['Global Header', '/website/header'],
      ['Global Footer', '/website/footer'],
      ['Navigation menus', '/phase1/navigation-menus'],
      ['Universities', '/phase1/universities'],
      ['University course offerings', '/phase1/offerings'],
      ['Consultants', '/phase1/consultants'],
      ['Consultant locations', '/consultant-locations'],
      ['Page templates', '/page-templates'],
      ['Media library', '/media'],
      ['SEO management', '/seo'],
      ['Redirects', '/redirects'],
      ['Bulk import / export', '/bulk-data'],
      ['Cities', '/locations?tab=cities'],
      ['States / provinces', '/locations?tab=states'],
      ['Scholarships', '/phase1/scholarships'],
      ['Jobs', '/phase1/jobs'],
      ['Events', '/phase1/events'],
      ['Success stories', '/phase1/success-stories'],
      ['Testimonials', '/phase1/testimonials'],
      ['Counselling leads', '/leads'],
      ['Contact enquiries', '/phase1/contact-inquiries'],
      ['Countries', '/countries'],
      ['Continents', '/continents'],
      ['Subjects', '/subjects'],
      ['Generic courses', '/courses'],
      ['University claim requests', '/university-claims'],
      ['A/B experiments', '/experiments'],
    ];
    for (const [name, href] of expectedLinks) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('opens the mobile drawer and closes it with Escape', () => {
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Admin navigation' })).not.toBeInTheDocument();
  });

  it('calls logout from a keyboard-accessible action', () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { firstName: 'Admin', lastName: null, email: 'admin@example.com', roles: ['SUPER_ADMIN'] },
      logout,
    });
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
