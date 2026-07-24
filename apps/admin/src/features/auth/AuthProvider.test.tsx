import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const authMocks = vi.hoisted(() => ({
  clearAuthenticatedSession: vi.fn(),
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}));
const routerReplace = vi.fn();

vi.mock('./auth-client', () => authMocks);
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerReplace }) }));

const user = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: null,
  roles: ['SUPER_ADMIN'],
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="email">{auth.user?.email}</span>
      <button type="button" onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.refreshSession.mockResolvedValue('access-token');
    authMocks.getCurrentUser.mockResolvedValue(user);
    authMocks.logout.mockResolvedValue(undefined);
  });

  it('refreshes then calls /me before marking the session authenticated', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(authMocks.getCurrentUser).toHaveBeenCalledWith('access-token');
    expect(screen.getByTestId('email')).toHaveTextContent('admin@example.com');
  });

  it('marks the session unauthenticated when initial refresh fails', async () => {
    authMocks.refreshSession.mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(authMocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it('clears state when /me rejects after refresh', async () => {
    authMocks.getCurrentUser.mockRejectedValue(new Error('expired'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(authMocks.clearAuthenticatedSession).toHaveBeenCalled();
  });

  it('clears state and redirects after logout', async () => {
    const userEventInstance = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await userEventInstance.click(screen.getByRole('button', { name: 'logout' }));
    expect(authMocks.logout).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith('/login');
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });
});
