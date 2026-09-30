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
      <main className="p-auth__main">
        <p role="status" aria-live="polite" className="p-sub">
          Checking your admin session…
        </p>
      </main>
    );
  }

  return (
    <main className="p-auth">
        <section className="p-auth__side">
          <div>
            <BrandMark inverse />
            <p className="p-eyebrow">
              Admin workspace
            </p>
            <h1 className="p-h1">
              Make every destination feel within reach.
            </h1>
            <p className="p-sub">
              A focused workspace for the people shaping Universta’s next chapter.
            </p>
          </div>
          <p className="p-auth__fine">Secure access for authorized Universta administrators.</p>
        </section>

        <section className="p-auth__main">
          <div className="p-auth__card">
            <div className="mb-12 lg:hidden">
              <BrandMark />
            </div>
            <div className="mb-9">
              <p className="p-eyebrow">Super Admin</p>
              <h2 className="p-h2">
                Welcome back.
              </h2>
              <p className="p-sub">
                Sign in to manage the Universta admin workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="email" className="p-label">
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
                  className="p-input"
                  placeholder="you@universta.com"
                />
                {emailError ? <p id="email-error" className="mt-2 p-danger">{emailError}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="p-label">
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
                    className="p-input" style={{ paddingRight: 84 }}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="p-btn p-btn--text p-btn--sm" style={{ position: 'absolute', right: 6, top: 5 }}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordError ? <p id="password-error" className="mt-2 p-danger">{passwordError}</p> : null}
              </div>

              <div role="alert" aria-live="polite" className="p-danger" style={{ minHeight: 24 }}>
                {error}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="p-btn p-btn--primary p-btn--block"
              >
                {submitting ? 'Signing in…' : 'Sign in securely'}
              </button>
            </form>

            <p className="p-auth__alt">
              This area is restricted to authorized Universta administrators.
            </p>
          </div>
        </section>
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
