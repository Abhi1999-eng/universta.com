'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';

/** Auth screens. One job per screen, errors next to the field that caused
 * them, and copy that says what happens next. */

function useApiError() {
  const [error, setError] = useState<string | null>(null);
  const report = (cause: unknown) => {
    const message =
      cause instanceof Error ? cause.message : 'Something went wrong';
    setError(message);
  };
  return { error, setError, report };
}

function AuthCard({
  title,
  lede,
  children,
  foot,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="stu">
      <div className="stu-auth">
        <div className="stu-auth-card">
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
          {children}
          {foot ? <div className="stu-auth-foot">{foot}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function StudentLogin() {
  const { signIn, status } = useStudentSession();
  const router = useRouter();
  const { error, report, setError } = useApiError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/student');
  }, [status, router]);

  return (
    <AuthCard
      title="Welcome back"
      lede="Sign in to continue building your study profile."
      foot={
        <>
          New here? <Link href="/student/register">Create an account</Link>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setBusy(true);
          void signIn(email.trim(), password)
            .then(() => router.replace('/student'))
            .catch(report)
            .finally(() => setBusy(false));
        }}
      >
        {error ? (
          <p className="stu-alert error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="stu-field">
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="stu-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button className="stu-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ marginTop: 14, fontSize: 14.5 }}>
          <Link href="/student/forgot-password">Forgotten your password?</Link>
        </p>
      </form>
    </AuthCard>
  );
}

export function StudentRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error, report, setError } = useApiError();
  const [fields, setFields] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  if (done) {
    return (
      <AuthCard
        title="Check your email"
        lede="We have sent a link to confirm your address. You can sign in now and confirm later."
        foot={<Link href="/student/login">Go to sign in</Link>}
      >
        <p className="stu-alert ok" role="status">
          Your account is ready.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      lede="It takes a minute. You can fill in the rest of your profile whenever you like."
      foot={
        <>
          Already have an account? <Link href="/student/login">Sign in</Link>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (fields.password !== fields.confirmPassword) {
            setMismatch(true);
            return;
          }
          setMismatch(false);
          setBusy(true);
          void fetch('/api/student/auth/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              firstName: fields.firstName.trim(),
              lastName: fields.lastName.trim() || undefined,
              email: fields.email.trim(),
              password: fields.password,
              referralCode: searchParams.get('ref') ?? undefined,
            }),
          })
            .then(async (response) => {
              const body: unknown = await response.json();
              if (!response.ok) {
                throw new Error(
                  (body as { error?: { message?: string } })?.error?.message ??
                    'We could not create your account',
                );
              }
              setDone(true);
              router.prefetch('/student/login');
            })
            .catch(report)
            .finally(() => setBusy(false));
        }}
      >
        {error ? (
          <p className="stu-alert error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="stu-grid">
          <div className="stu-field">
            <label htmlFor="reg-first">First name</label>
            <input
              id="reg-first"
              autoComplete="given-name"
              required
              value={fields.firstName}
              onChange={(event) => set('firstName')(event.target.value)}
            />
          </div>
          <div className="stu-field">
            <label htmlFor="reg-last">Last name (optional)</label>
            <input
              id="reg-last"
              autoComplete="family-name"
              value={fields.lastName}
              onChange={(event) => set('lastName')(event.target.value)}
            />
          </div>
        </div>
        <div className="stu-field">
          <label htmlFor="reg-email">Email address</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={fields.email}
            onChange={(event) => set('email')(event.target.value)}
          />
        </div>
        <div className="stu-field">
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={fields.password}
            onChange={(event) => set('password')(event.target.value)}
          />
          <span className="hint">
            At least 12 characters, with an uppercase letter, a lowercase letter
            and a number.
          </span>
        </div>
        <div className="stu-field">
          <label htmlFor="reg-confirm">Confirm password</label>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'reg-confirm-error' : undefined}
            value={fields.confirmPassword}
            onChange={(event) => set('confirmPassword')(event.target.value)}
          />
          {mismatch ? (
            <span className="err" id="reg-confirm-error">
              Both passwords need to match.
            </span>
          ) : null}
        </div>
        <button className="stu-btn" type="submit" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}

export function StudentForgotPassword() {
  const { error, report, setError } = useApiError();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        lede="If that address has an account, a reset link is on its way."
        foot={<Link href="/student/login">Back to sign in</Link>}
      >
        <p className="stu-alert ok" role="status">
          The link expires in 24 hours.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      lede="Tell us the address you signed up with."
      foot={<Link href="/student/login">Back to sign in</Link>}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setBusy(true);
          void fetch('/api/student/auth/forgot-password', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
          })
            .then(() => setSent(true))
            .catch(report)
            .finally(() => setBusy(false));
        }}
      >
        {error ? (
          <p className="stu-alert error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="stu-field">
          <label htmlFor="forgot-email">Email address</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button className="stu-btn" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthCard>
  );
}

export function StudentResetPassword() {
  const params = useSearchParams();
  const router = useRouter();
  const { error, report, setError } = useApiError();
  const linkToken = params.get('token') ?? '';
  const [typedToken, setTypedToken] = useState('');
  const token = linkToken || typedToken;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AuthCard
        title="Password changed"
        lede="You have been signed out everywhere else. Sign in with your new password."
        foot={<Link href="/student/login">Go to sign in</Link>}
      >
        <p className="stu-alert ok" role="status">
          All set.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (password !== confirm) {
            setMismatch(true);
            return;
          }
          setMismatch(false);
          setBusy(true);
          void fetch('/api/student/auth/reset-password', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token, password }),
          })
            .then(async (response) => {
              const body: unknown = await response.json();
              if (!response.ok) {
                throw new Error(
                  (body as { error?: { message?: string } })?.error?.message ??
                    'This link is no longer valid',
                );
              }
              setDone(true);
              router.prefetch('/student/login');
            })
            .catch(report)
            .finally(() => setBusy(false));
        }}
      >
        {error ? (
          <p className="stu-alert error" role="alert">
            {error}
          </p>
        ) : null}
        {!linkToken ? (
          <div className="stu-field">
            <label htmlFor="reset-token">Reset code</label>
            <input
              id="reset-token"
              required
              value={typedToken}
              onChange={(event) => setTypedToken(event.target.value)}
            />
            <span className="hint">Paste the code from your reset email.</span>
          </div>
        ) : null}
        <div className="stu-field">
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="hint">
            At least 12 characters, with an uppercase letter, a lowercase letter
            and a number.
          </span>
        </div>
        <div className="stu-field">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'reset-confirm-error' : undefined}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {mismatch ? (
            <span className="err" id="reset-confirm-error">
              Both passwords need to match.
            </span>
          ) : null}
        </div>
        <button className="stu-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthCard>
  );
}

export function StudentVerifyEmail() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'failed'>(
    token ? 'working' : 'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetch('/api/student/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            (body as { error?: { message?: string } })?.error?.message ??
              'This link is no longer valid',
          );
        }
        if (!cancelled) setState('ok');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setMessage(cause instanceof Error ? cause.message : null);
        setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthCard
      title={state === 'ok' ? 'Email confirmed' : 'Confirm your email'}
      lede={
        state === 'ok'
          ? 'Thanks — your address is verified.'
          : 'Open the link we emailed you to confirm this address.'
      }
      foot={<Link href="/student">Go to your portal</Link>}
    >
      {state === 'working' ? (
        <p className="stu-alert info" role="status">
          Confirming…
        </p>
      ) : null}
      {state === 'ok' ? (
        <p className="stu-alert ok" role="status">
          You can close this page.
        </p>
      ) : null}
      {state === 'failed' ? (
        <p className="stu-alert error" role="alert">
          {message ?? 'This link is no longer valid.'}
        </p>
      ) : null}
    </AuthCard>
  );
}
