import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, ProtectedBoundary } from './AuthProvider';

/** ISS-012. `initializeSession` awaited `refreshSession()` with nothing to
 * bound it and nothing to catch it. The auth `fetch` carried no signal, so a
 * connection that opened but was never answered left the promise pending: the
 * status stayed 'initializing', every admin page sat on "Checking your admin
 * session…" indefinitely, and because `refreshSession` shares one module-level
 * promise, every later caller was handed the same hung promise.
 *
 * Observed in production during Phase 1 acceptance: an editor URL held that
 * screen for the full 60s timeout instead of rendering its form.
 *
 * These pin that the boundary always reaches a terminal state. */

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const refreshSession = vi.fn();
const getCurrentUser = vi.fn();
vi.mock('./auth-client', () => ({
  refreshSession: (...args: unknown[]) => refreshSession(...args),
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
  clearAuthenticatedSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  AuthClientError: class extends Error {},
}));

function renderBoundary() {
  return render(
    <AuthProvider>
      <ProtectedBoundary>
        <p>Editor form</p>
      </ProtectedBoundary>
    </AuthProvider>,
  );
}

const checking = () => screen.queryByText(/Checking your admin session/);

describe('admin session initialisation', () => {
  it('renders the console once the session resolves', async () => {
    refreshSession.mockResolvedValue('token');
    getCurrentUser.mockResolvedValue({ id: '1', email: 'a@b.c', role: 'SUPER_ADMIN' });
    renderBoundary();
    expect(await screen.findByText('Editor form')).toBeInTheDocument();
  });

  it('leaves the checking screen when there is no session', async () => {
    refreshSession.mockResolvedValue(null);
    renderBoundary();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls.at(-1)?.[0]).toContain('/login');
  });

  it('does not stay on the checking screen when the refresh rejects', async () => {
    refreshSession.mockRejectedValue(new Error('TimeoutError'));
    renderBoundary();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls.at(-1)?.[0]).toContain('/login');
  });

  it('does not stay on the checking screen when the user lookup rejects', async () => {
    refreshSession.mockResolvedValue('token');
    getCurrentUser.mockRejectedValue(new Error('boom'));
    renderBoundary();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(checking()).not.toBeNull();
    expect(screen.queryByText('Editor form')).toBeNull();
  });
});
