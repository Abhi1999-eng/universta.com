'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { CounsellingOptions } from '@/lib/counselling';

export interface CounsellingContext {
  sourceType: 'general' | 'country' | 'subject' | 'specialization' | 'course';
  sourceCountrySlug?: string;
  sourceSubjectSlug?: string;
  sourceSpecializationSlug?: string;
  sourceCourseSlug?: string;
  sourcePagePath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

type Fields = {
  fullName: string;
  email: string;
  phoneNumber: string;
  countrySlug: string;
  studyLevelCode: string;
  intakeSlug: string;
  message: string;
  consent: boolean;
  companyWebsite: string;
};

type FieldName = keyof Fields;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialFields = (countrySlug = ''): Fields => ({
  fullName: '',
  email: '',
  phoneNumber: '',
  countrySlug,
  studyLevelCode: '',
  intakeSlug: '',
  message: '',
  consent: false,
  companyWebsite: '',
});

function clientErrors(fields: Fields): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  const phone = fields.phoneNumber.replace(/\D/g, '');
  if (phone.length < 7 || phone.length > 15) {
    errors.phoneNumber = 'Enter a valid international phone number.';
  }
  if (!fields.countrySlug) errors.countrySlug = 'Choose an interested country.';
  if (!fields.studyLevelCode) errors.studyLevelCode = 'Choose a study level.';
  if (!fields.intakeSlug) errors.intakeSlug = 'Choose an intended intake.';
  if (fields.message.length > 2000) {
    errors.message = 'Keep your message within 2,000 characters.';
  }
  if (!fields.consent) {
    errors.consent = 'Consent is required before we can contact you.';
  }
  return errors;
}

function contextLabel(context: CounsellingContext): string {
  const detail = {
    general: undefined,
    country: context.sourceCountrySlug,
    subject: context.sourceSubjectSlug,
    specialization:
      context.sourceSpecializationSlug ?? context.sourceSubjectSlug,
    course: context.sourceCourseSlug,
  }[context.sourceType];
  if (context.sourceType === 'general' || !detail) return 'General counselling';
  const country =
    context.sourceType === 'course' && context.sourceCountrySlug
      ? ` · ${context.sourceCountrySlug.replace(/-/g, ' ')}`
      : '';
  return `${context.sourceType[0].toUpperCase()}${context.sourceType.slice(1)} · ${detail.replace(/-/g, ' ')}${country}`;
}

function sameOriginReferrer(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin
      ? referrer.pathname
      : undefined;
  } catch {
    return undefined;
  }
}

export function CounsellingForm({
  initialOptions,
  context,
}: {
  initialOptions: CounsellingOptions | null;
  context: CounsellingContext;
}) {
  const prefilledCountry =
    context.sourceCountrySlug &&
    initialOptions?.countries.some(
      (country) => country.slug === context.sourceCountrySlug,
    )
      ? context.sourceCountrySlug
      : '';
  const [options, setOptions] = useState(initialOptions);
  const [fields, setFields] = useState<Fields>(
    initialFields(prefilledCountry),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [optionsState, setOptionsState] = useState<
    'loading' | 'ready' | 'error'
  >(initialOptions ? 'ready' : 'loading');
  const [submitState, setSubmitState] = useState<
    'idle' | 'submitting' | 'error' | 'success'
  >('idle');
  const [failureMessage, setFailureMessage] = useState('');
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const confirmationRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const errorEntries = useMemo(
    () => Object.entries(errors) as Array<[FieldName, string]>,
    [errors],
  );

  const loadOptions = useCallback(async () => {
    setOptionsState('loading');
    try {
      const response = await fetch('/api/counselling-leads', {
        cache: 'no-store',
      });
      const body = (await response.json()) as {
        data?: CounsellingOptions;
        error?: { message?: string } | null;
      };
      if (!response.ok || !body.data) throw new Error('options unavailable');
      setOptions(body.data);
      setOptionsState('ready');
      if (
        context.sourceCountrySlug &&
        body.data.countries.some(
          (country) => country.slug === context.sourceCountrySlug,
        )
      ) {
        setFields((current) => ({
          ...current,
          countrySlug: current.countrySlug || context.sourceCountrySlug || '',
        }));
      }
    } catch {
      setOptionsState('error');
    }
  }, [context.sourceCountrySlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!initialOptions) void loadOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialOptions, loadOptions]);

  useEffect(() => {
    if (submitState === 'success') confirmationRef.current?.focus();
  }, [submitState]);

  function update<K extends FieldName>(name: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function focusFirstError(nextErrors: FieldErrors) {
    const first = (Object.keys(nextErrors) as FieldName[])[0];
    window.requestAnimationFrame(() => {
      errorSummaryRef.current?.focus();
      fieldRefs.current[first]?.focus();
    });
  }

  function applyServerErrors(details: unknown): boolean {
    if (!Array.isArray(details)) return false;
    const next: FieldErrors = {};
    for (const item of details) {
      if (!item || typeof item !== 'object') continue;
      const property = (item as { property?: unknown }).property;
      const message = (item as { message?: unknown }).message;
      if (
        typeof property === 'string' &&
        property in fields &&
        typeof message === 'string'
      ) {
        next[property as FieldName] = message;
      }
    }
    if (!Object.keys(next).length) return false;
    setErrors(next);
    focusFirstError(next);
    return true;
  }

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (submitState === 'submitting') return;
    const nextErrors = clientErrors(fields);
    setErrors(nextErrors);
    setFailureMessage('');
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }
    setSubmitState('submitting');
    try {
      const response = await fetch('/api/counselling-leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          ...fields,
          fullName: fields.fullName.trim(),
          email: fields.email.trim().toLowerCase(),
          message: fields.message.trim() || undefined,
          ...context,
          referringPath: sameOriginReferrer(),
          landingPagePath: window.location.pathname,
        }),
      });
      const body = (await response.json()) as {
        data?: { received?: boolean } | null;
        error?: { message?: string; details?: unknown } | null;
      };
      if (!response.ok || body.error || !body.data?.received) {
        if (applyServerErrors(body.error?.details)) {
          setSubmitState('idle');
          return;
        }
        throw new Error(
          body.error?.message ?? 'We could not submit your request.',
        );
      }
      setSubmitState('success');
    } catch (error) {
      setSubmitState('error');
      setFailureMessage(
        error instanceof Error
          ? error.message
          : 'We could not submit your request.',
      );
    }
  }

  if (submitState === 'success') {
    return (
      <div
        className="counselling-confirmation"
        role="status"
        aria-live="polite"
        tabIndex={-1}
        ref={confirmationRef}
      >
        <span className="eyebrow">Request received</span>
        <h2>Thank you. We’ll help you plan your next step.</h2>
        <p>
          Your counselling request has been received. A Universta team member
          can contact you using the details you provided.
        </p>
        <Link className="btn btn-primary" href="/countries">
          Continue exploring
        </Link>
      </div>
    );
  }

  return (
    <div className="counselling-form-card">
      <div className="counselling-form-heading">
        <span className="eyebrow">Your study goals</span>
        <h2>Tell us where you want to go.</h2>
        <p>
          All fields marked with <span aria-hidden="true">*</span> are required.
        </p>
        <span className="source-context">Started from: {contextLabel(context)}</span>
      </div>
      {optionsState === 'loading' ? (
        <p className="form-notice" role="status">
          Loading current countries, levels and intakes…
        </p>
      ) : null}
      {optionsState === 'error' ? (
        <div className="form-notice error" role="alert">
          <p>Current counselling options could not be loaded.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadOptions()}>
            Retry loading options
          </button>
        </div>
      ) : null}
      {errorEntries.length ? (
        <div
          className="form-error-summary"
          role="alert"
          tabIndex={-1}
          ref={errorSummaryRef}
        >
          <h3>Please check the form</h3>
          <ul>
            {errorEntries.map(([name, message]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => fieldRefs.current[name]?.focus()}
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {submitState === 'error' ? (
        <div className="form-notice error" role="alert">
          <p>{failureMessage}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void submit()}>
            Try again
          </button>
        </div>
      ) : null}
      <form className="counselling-form" noValidate onSubmit={submit}>
        <div className="counselling-grid">
          <Field label="Full name" name="fullName" error={errors.fullName}>
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={fields.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              ref={(node) => {
                fieldRefs.current.fullName = node;
              }}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            />
          </Field>
          <Field label="Email address" name="email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={(event) => update('email', event.target.value)}
              ref={(node) => {
                fieldRefs.current.email = node;
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </Field>
          <Field
            label="Phone number"
            name="phoneNumber"
            error={errors.phoneNumber}
          >
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91 90000 00000"
              value={fields.phoneNumber}
              onChange={(event) => update('phoneNumber', event.target.value)}
              ref={(node) => {
                fieldRefs.current.phoneNumber = node;
              }}
              aria-invalid={Boolean(errors.phoneNumber)}
              aria-describedby={
                errors.phoneNumber ? 'phoneNumber-error' : undefined
              }
            />
          </Field>
          <Field
            label="Interested country"
            name="countrySlug"
            error={errors.countrySlug}
          >
            <select
              id="countrySlug"
              name="countrySlug"
              value={fields.countrySlug}
              disabled={optionsState !== 'ready'}
              onChange={(event) => update('countrySlug', event.target.value)}
              ref={(node) => {
                fieldRefs.current.countrySlug = node;
              }}
              aria-invalid={Boolean(errors.countrySlug)}
              aria-describedby={
                errors.countrySlug ? 'countrySlug-error' : undefined
              }
            >
              <option value="">Choose a country</option>
              {options?.countries.map((country) => (
                <option value={country.slug} key={country.slug}>
                  {country.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Study level"
            name="studyLevelCode"
            error={errors.studyLevelCode}
          >
            <select
              id="studyLevelCode"
              name="studyLevelCode"
              value={fields.studyLevelCode}
              disabled={optionsState !== 'ready'}
              onChange={(event) => update('studyLevelCode', event.target.value)}
              ref={(node) => {
                fieldRefs.current.studyLevelCode = node;
              }}
              aria-invalid={Boolean(errors.studyLevelCode)}
              aria-describedby={
                errors.studyLevelCode ? 'studyLevelCode-error' : undefined
              }
            >
              <option value="">Choose a level</option>
              {options?.courseLevels.map((level) => (
                <option value={level.code} key={level.code}>
                  {level.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Intended intake"
            name="intakeSlug"
            error={errors.intakeSlug}
          >
            <select
              id="intakeSlug"
              name="intakeSlug"
              value={fields.intakeSlug}
              disabled={optionsState !== 'ready'}
              onChange={(event) => update('intakeSlug', event.target.value)}
              ref={(node) => {
                fieldRefs.current.intakeSlug = node;
              }}
              aria-invalid={Boolean(errors.intakeSlug)}
              aria-describedby={
                errors.intakeSlug ? 'intakeSlug-error' : undefined
              }
            >
              <option value="">Choose an intake</option>
              {options?.intakes.map((intake) => (
                <option value={intake.slug} key={intake.slug}>
                  {intake.shortLabel ?? intake.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Message (optional)" name="message" error={errors.message} optional>
          <textarea
            id="message"
            name="message"
            rows={5}
            maxLength={2000}
            value={fields.message}
            onChange={(event) => update('message', event.target.value)}
            ref={(node) => {
              fieldRefs.current.message = node;
            }}
            aria-invalid={Boolean(errors.message)}
            aria-describedby="message-help"
          />
          <span className="field-help" id="message-help">
            {fields.message.length}/2,000 characters
          </span>
        </Field>
        <div className="counselling-honeypot" aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input
            id="companyWebsite"
            name="companyWebsite"
            tabIndex={-1}
            autoComplete="off"
            value={fields.companyWebsite}
            onChange={(event) => update('companyWebsite', event.target.value)}
          />
        </div>
        <div className="consent-field">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            checked={fields.consent}
            onChange={(event) => update('consent', event.target.checked)}
            ref={(node) => {
              fieldRefs.current.consent = node;
            }}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? 'consent-error' : 'consent-help'}
          />
          <div>
            <label htmlFor="consent">
              I agree to be contacted about study abroad counselling.
            </label>
            <p id="consent-help">
              Consent text version 1.0 · You can ask us not to contact you
              again at any time.
            </p>
            {errors.consent ? (
              <p className="field-error" id="consent-error">
                {errors.consent}
              </p>
            ) : null}
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg counselling-submit"
          type="submit"
          disabled={submitState === 'submitting' || optionsState !== 'ready'}
        >
          {submitState === 'submitting'
            ? 'Sending your request…'
            : 'Request free counselling'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  optional = false,
  children,
}: {
  label: string;
  name: FieldName;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`counselling-field${error ? ' has-error' : ''}`}>
      <label htmlFor={name}>
        {label} {!optional ? <span aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
