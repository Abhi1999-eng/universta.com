'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth, isAuthClientError } from './AuthProvider';
import { safeReturnTo } from './return-to';

const GENERIC_ERROR = 'Unable to sign in. Check your details or try again shortly.';

export function LoginScreen({ returnTo }: { returnTo: string }) {
  const { status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      window.location.replace(safeReturnTo(returnTo));
    }
  }, [returnTo, status]);

  function validate(): boolean {
    const nextEmail = email.trim();
    const nextEmailError = !nextEmail
      ? 'Enter your email address.'
      : !/^\S+@\S+\.\S+$/.test(nextEmail)
        ? 'Enter a valid email address.'
        : null;
    const nextPasswordError = password ? null : 'Enter your password.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError) {
      emailRef.current?.focus();
      return false;
    }
    if (nextPasswordError) {
      passwordRef.current?.focus();
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) {
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password, returnTo);
    } catch (reason) {
      setError(isAuthClientError(reason) ? reason.message : GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'initializing' || status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFBFD] px-6">
        <p role="status" aria-live="polite" className="text-sm text-[#48505F]">
          Checking your admin session…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFBFD] text-[#0D1524]">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[minmax(360px,0.82fr)_minmax(520px,1.18fr)]">
        <section className="relative hidden overflow-hidden bg-[#0D1524] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full bg-[#1657CF]/40 blur-3xl" />
          <div className="relative">
            <BrandMark inverse />
            <p className="mt-24 max-w-sm text-sm font-medium uppercase tracking-[0.24em] text-white/55">
              Admin workspace
            </p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.04em]">
              Make every destination feel within reach.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/65">
              A focused workspace for the people shaping Universta’s next chapter.
            </p>
          </div>
          <p className="relative text-xs text-white/45">Secure access for authorized Universta administrators.</p>
        </section>

        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-[470px]">
            <div className="mb-12 lg:hidden">
              <BrandMark />
            </div>
            <div className="mb-9">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1657CF]">Super Admin</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#0D1524] sm:text-4xl">
                Welcome back.
              </h2>
              <p className="mt-3 text-base leading-7 text-[#48505F]">
                Sign in to manage the Universta admin workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#0D1524]">
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  className="h-13 w-full rounded-xl border border-[#DCE2EC] bg-white px-4 text-base text-[#0D1524] outline-none transition placeholder:text-[#9AA3B2] focus:border-[#1657CF] focus:ring-4 focus:ring-[#1657CF]/10"
                  placeholder="you@universta.com"
                />
                {emailError ? <p id="email-error" className="mt-2 text-sm text-[#B42318]">{emailError}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#0D1524]">
                  Password
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? 'password-error' : undefined}
                    className="h-13 w-full rounded-xl border border-[#DCE2EC] bg-white px-4 pr-24 text-base text-[#0D1524] outline-none transition placeholder:text-[#9AA3B2] focus:border-[#1657CF] focus:ring-4 focus:ring-[#1657CF]/10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#48505F] hover:bg-[#F0F4FA] focus:outline-none focus:ring-2 focus:ring-[#1657CF]"
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordError ? <p id="password-error" className="mt-2 text-sm text-[#B42318]">{passwordError}</p> : null}
              </div>

              <div role="alert" aria-live="polite" className="min-h-6 text-sm text-[#B42318]">
                {error}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-13 w-full items-center justify-center rounded-xl bg-[#1657CF] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(22,87,207,0.2)] transition hover:bg-[#1049B2] focus:outline-none focus:ring-4 focus:ring-[#1657CF]/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in securely'}
              </button>
            </form>

            <p className="mt-9 text-center text-xs leading-5 text-[#828B9B]">
              This area is restricted to authorized Universta administrators.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Universta">
      <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg font-bold ${inverse ? 'bg-white text-[#1657CF]' : 'bg-[#1657CF] text-white'}`}>
        U
      </span>
      <span className={`text-xl font-bold tracking-[-0.04em] ${inverse ? 'text-white' : 'text-[#0D1524]'}`}>Universta</span>
    </div>
  );
}
