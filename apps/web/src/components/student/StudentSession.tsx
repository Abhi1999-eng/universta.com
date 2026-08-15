'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

/**
 * The signed-in student, for the pages that need one.
 *
 * The access token is held in memory only. The long-lived credential is the
 * HttpOnly refresh cookie, which this code cannot read — so a script on the
 * page has nothing durable to steal. On load, and whenever a call comes back
 * 401, the session is re-established from that cookie.
 */

export interface StudentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
}

type Status = 'loading' | 'authenticated' | 'anonymous';

interface StudentSessionValue {
  status: Status;
  student: StudentUser | null;
  /** Calls the student API through the same-origin proxy, refreshing once if
   * the token has aged out. */
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  apiFile: (path: string) => Promise<Blob>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<StudentSessionValue | null>(null);

async function readEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = (body as { error?: { message?: string; details?: unknown } })
      ?.error;
    throw Object.assign(new Error(error?.message ?? 'Something went wrong'), {
      status: response.status,
      details: error?.details,
    });
  }
  return (body as { data: T })?.data;
}

export function StudentSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [student, setStudent] = useState<StudentUser | null>(null);
  const token = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    const response = await fetch('/api/student/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      token.current = null;
      return false;
    }
    const data = await readEnvelope<{ accessToken: string }>(response);
    token.current = data.accessToken;
    return true;
  }, []);

  const api = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const send = async () => {
        const headers = new Headers(init.headers);
        if (token.current) {
          headers.set('authorization', `Bearer ${token.current}`);
        }
        return fetch(`/api/student${path}`, {
          ...init,
          headers,
          credentials: 'same-origin',
        });
      };

      let response = await send();
      if (response.status === 401 && (await refresh())) {
        response = await send();
      }
      return readEnvelope<T>(response);
    },
    [refresh],
  );

  const apiFile = useCallback(async (path: string): Promise<Blob> => {
    const send = async () => fetch(`/api/student${path}`, {
      headers: token.current ? { authorization: `Bearer ${token.current}` } : undefined,
      credentials: 'same-origin',
    });
    let response = await send();
    if (response.status === 401 && (await refresh())) response = await send();
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? 'We could not download your offer letter');
    }
    return response.blob();
  }, [refresh]);

  const loadStudent = useCallback(async () => {
    try {
      const me = await api<StudentUser>('/auth/me');
      setStudent(me);
      setStatus('authenticated');
    } catch {
      setStudent(null);
      setStatus('anonymous');
    }
  }, [api]);

  useEffect(() => {
    void (async () => {
      await refresh();
      await loadStudent();
    })();
  }, [refresh, loadStudent]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await fetch('/api/student/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await readEnvelope<{
        accessToken: string;
        user: StudentUser;
      }>(response);
      token.current = data.accessToken;
      setStudent(data.user);
      setStatus('authenticated');
    },
    [],
  );

  const signOut = useCallback(async () => {
    await fetch('/api/student/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => undefined);
    token.current = null;
    setStudent(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ status, student, api, apiFile, signIn, signOut, reload: loadStudent }),
    [status, student, api, apiFile, signIn, signOut, loadStudent],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useStudentSession(): StudentSessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useStudentSession must be used inside the student portal');
  }
  return value;
}

/** Sends anonymous visitors to sign in. The API is the real gate; this only
 * saves them from staring at an empty page. */
export function useRequireStudent(): StudentSessionValue {
  const session = useStudentSession();
  const router = useRouter();
  useEffect(() => {
    if (session.status === 'anonymous') {
      router.replace('/student/login');
    }
  }, [session.status, router]);
  return session;
}
