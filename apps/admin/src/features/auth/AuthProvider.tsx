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

async function initializeSession(
  setStatus: (status: AuthStatus) => void,
  setUser: (user: AuthenticatedAdmin | null) => void,
): Promise<void> {
  const token = await refreshSession();
  if (!token) {
    setUser(null);
    setStatus('unauthenticated');
    return;
  }

  try {
    const user = await getCurrentUser(token);
    setUser(user);
    setStatus('authenticated');
  } catch {
    clearAuthenticatedSession();
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
    const token = await refreshSession();
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return false;
    }
    try {
      const currentUser = await getCurrentUser(token);
      setUser(currentUser);
      setStatus('authenticated');
      return true;
    } catch {
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
