import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const authMocks = vi.hoisted(() => ({
  clearAuthenticatedSession: vi.fn(),
  getCurrentUser: vi.fn(),
  getLoginGeneration: vi.fn(() => 0),
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
      <button type="button" onClick={() => void auth.login('admin@example.com', 'password')}>login</button>
    </div>
  );
}

describe('AuthProvider lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.refreshSession.mockResolvedValue('access-token');
    authMocks.getCurrentUser.mockResolvedValue(user);
    authMocks.logout.mockResolvedValue(undefined);
    authMocks.getLoginGeneration.mockReturnValue(0);
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

  it('does not revert a login that lands while the initial mount refresh is still pending', async () => {
    // Reproduces the hosted "login bounce": the mount effect fires a
    // speculative refresh before any credentials exist (there's nothing to
    // await here -- it's a real network round trip in production). If a
    // login lands and resolves first, the refresh's late, definitive "no
    // session" must not undo it.
    let resolveRefresh: ((token: string | null) => void) | undefined;
    authMocks.refreshSession.mockReturnValue(
      new Promise((resolve) => { resolveRefresh = resolve; }),
    );
    authMocks.login.mockImplementation(async () => {
      // setAuthenticatedSession() bumps the login generation as part of a
      // real login; this mock stands in for that side effect.
      authMocks.getLoginGeneration.mockReturnValue(1);
      return { accessToken: 'login-token', tokenType: 'Bearer', expiresIn: 900, user };
    });

    const userEventInstance = userEvent.setup();
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('initializing');

    await userEventInstance.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('admin@example.com');

    resolveRefresh?.(null);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('email')).toHaveTextContent('admin@example.com');
  });

  it('still resolves unauthenticated normally when no login ever happens', async () => {
    // Guards against a fix that swallows every "no session" verdict: this is
    // the ordinary case (a stale tab, or first ever visit) with no race and
    // no intervening login -- clearAuthenticatedSession() runs as usual and
    // getAuthenticatedUser() genuinely stays null, so the status must still
    // resolve to 'unauthenticated'.
    authMocks.refreshSession.mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
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
