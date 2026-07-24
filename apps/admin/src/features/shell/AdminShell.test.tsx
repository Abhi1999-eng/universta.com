import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

const mockUseAuth = vi.fn();
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

describe('AdminShell', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { firstName: 'Admin', lastName: null, email: 'admin@example.com', roles: ['SUPER_ADMIN'] },
      logout: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders the authenticated user, role, active dashboard, and truthful empty state', () => {
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    expect(screen.getByText('admin@example.com')).toBeVisible();
    expect(screen.getAllByText('SUPER_ADMIN').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Dashboard content')).toBeVisible();
  });

  it('keeps future navigation items disabled and out of the link set', () => {
    render(<AdminShell><p>Dashboard content</p></AdminShell>);
    const countries = screen.getAllByRole('button', { name: /Countries/ })[0];
    expect(countries).toBeDisabled();
    expect(countries).not.toHaveAttribute('href');
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
