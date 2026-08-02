'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAuthenticatedSession,
  getCurrentUser,
  getLoginGeneration,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
} from './auth-client';
import type { AuthClientError, AuthStatus, AuthenticatedAdmin } from './auth.types';
import { safeReturnTo } from './return-to';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedAdmin | null;
  login: (email: string, password: string, returnTo?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Resolves the session exactly once on mount.
 *
 * Every path out of here must set a terminal status. 'initializing' renders
 * the "Checking your admin session…" screen and nothing ever re-runs this
 * effect, so a step that neither resolves nor rejects leaves the console stuck
 * on that screen for good -- which is what an unbounded refresh request used
 * to do. The outer catch is the backstop for the same failure mode. */
async function initializeSession(
  setStatus: (status: AuthStatus) => void,
  setUser: (user: AuthenticatedAdmin | null) => void,
): Promise<void> {
  // This runs once, unconditionally, on the very first mount -- including on
  // the login screen, before any credentials exist. If a login lands while
  // that speculative refresh is still in flight (a fast Playwright script
  // reproduces this every time; a human can too), this call's eventual
  // verdict must not stomp on the fresh, authenticated state login() already
  // set. getLoginGeneration() is bumped only by a real login, never by a
  // clear -- so this call's own, entirely ordinary "there was no session"
  // outcome (which does call clearAuthenticatedSession) can never make its
  // own snapshot look stale to itself, the way reusing the session-rotation
  // generation counter did.
  const startGeneration = getLoginGeneration();
  const stale = () => getLoginGeneration() !== startGeneration;
  try {
    const token = await refreshSession();
    if (stale()) return;
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const user = await getCurrentUser(token);
      if (stale()) return;
      setUser(user);
      setStatus('authenticated');
    } catch {
      if (stale()) return;
      clearAuthenticatedSession();
      setUser(null);
      setStatus('unauthenticated');
    }
  } catch {
    // refreshSession is written to resolve rather than reject, but a spinner
    // that never ends is a worse failure than a trip through the login screen.
    if (stale()) return;
    setUser(null);
    setStatus('unauthenticated');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<AuthenticatedAdmin | null>(null);

  useEffect(() => {
    let active = true;
    void initializeSession(
      (nextStatus) => active && setStatus(nextStatus),
      (nextUser) => active && setUser(nextUser),
    );
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, returnTo?: string | null) => {
      const result = await loginRequest(email, password);
      setUser(result.user);
      setStatus('authenticated');
      router.replace(safeReturnTo(returnTo));
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      clearAuthenticatedSession();
    }
    setUser(null);
    setStatus('unauthenticated');
    router.replace('/login');
  }, [router]);

  const refresh = useCallback(async () => {
    const startGeneration = getLoginGeneration();
    const stale = () => getLoginGeneration() !== startGeneration;
    const token = await refreshSession();
    if (stale()) return true;
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return false;
    }
    try {
      const currentUser = await getCurrentUser(token);
      if (stale()) return true;
      setUser(currentUser);
      setStatus('authenticated');
      return true;
    } catch {
      if (stale()) return true;
      clearAuthenticatedSession();
      setUser(null);
      setStatus('unauthenticated');
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, refresh }),
    [login, logout, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

export function isAuthClientError(error: unknown): error is AuthClientError {
  return error instanceof Error && error.name === 'AuthClientError';
}

export function ProtectedBoundary({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const path =
        typeof window === 'undefined'
          ? '/dashboard'
          : `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?returnTo=${encodeURIComponent(safeReturnTo(path))}`);
    }
  }, [router, status]);

  if (status === 'initializing' || status === 'unauthenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFBFD] px-6">
        <p role="status" aria-live="polite" className="text-sm text-[#48505F]">
          Checking your admin session…
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
