'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSESSMENT, bandFor, profileFor, scoreFor } from '@/lib/study-abroad-assessment';
import { searchDestinations } from '@/lib/study-abroad-view';
import type { Destination } from '@/lib/study-abroad';
import type { AssessmentContext } from './StudyAbroadShell';
import { FlagMark } from './FlagMark';

/**
 * The assessment from the approved design.
 *
 * It submits to the existing lead system rather than keeping anything in the
 * browser: the design's export stored answers in localStorage and stopped
 * there, which is a demo, not a lead. The band shown here is computed locally
 * for the progress the design displays, and recomputed on the server before
 * anything is written -- the number below is what the student sees, not what
 * the record is trusted to say.
 */

type Phase = 'questions' | 'result' | 'done';

const ENDPOINT = '/api/study-abroad/assessment';

export function AssessmentDialog({
  context,
  destinations,
  onClose,
}: {
  context: AssessmentContext;
  destinations?: Destination[];
  onClose: () => void;
}) {
  const steps = ASSESSMENT.steps;
  const [index, setIndex] = useState(0);
  /* The dialog is mounted fresh each time it opens, so the country it was
     opened from is an initial value rather than something to synchronise. */
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    context.countrySlug ? { destination: context.countrySlug } : ({} as Record<string, string>),
  );
  const [phase, setPhase] = useState<Phase>('questions');
  const [form, setForm] = useState({ name: '', phone: '', email: '', companyWebsite: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [countryQuery, setCountryQuery] = useState('');

  /* The country step offers the destinations that actually have a guide; the
   * design's own list is a mock-up. Pre-selected when the assessment was opened
   * from a country page. */
  const countryOptions = useMemo(
    () => (destinations ?? []).filter((entry) => entry.slug),
    [destinations],
  );
  const countryMatches = useMemo(
    () => searchDestinations(countryOptions, countryQuery).slice(0, 40),
    [countryOptions, countryQuery],
  );

  /* Focus goes back to whatever opened the dialog when it closes. It is mounted
     fresh on every open, so the opener is whatever held focus at mount. */
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [index, phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      /* A modal keeps focus inside it. Without this, tabbing walks into the
         page behind and the dialog becomes a trap of the wrong kind. */
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const step = steps[index];
  const total = steps.length;
  const score = scoreFor(answers);
  const band = bandFor(score);
  const profile = profileFor(answers, countryOptions);

  const advance = () => (index + 1 < total ? setIndex(index + 1) : setPhase('result'));

  /* The pressed state shows for a beat before the next question replaces it,
     as in the design, so a tap visibly lands before the list changes. */
  const choose = (value: string) => {
    setAnswers((current) => ({ ...current, [step.id]: value }));
    window.setTimeout(advance, 160);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your name.';
    if (!/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim()))
      next.phone = 'Please enter a valid phone number.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      next.email = 'Please enter a valid email address.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    setFailure(null);
    /* The destination answer is the country slug; every other answer is a step
     * option. They travel separately because the server links one to a real
     * published country and validates the rest against its own list. */
    const { destination, ...rest } = answers;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: form.name.trim(),
          email: form.email.trim(),
          phoneNumber: form.phone.trim(),
          consent: true,
          companyWebsite: form.companyWebsite,
          countrySlug: destination ?? context.countrySlug,
          sourcePagePath: context.countrySlug
            ? `/study-abroad/${context.countrySlug}`
            : '/study-abroad',
          answers: rest,
        }),
      });
      if (!response.ok) throw new Error('submit failed');
      setPhase('done');
    } catch {
      setFailure('We could not send that just now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  const progress = phase === 'questions' ? Math.round((index / total) * 100) : 100;
  const optionsClass = (step.options?.length ?? 0) > 4 ? 'opts opts--2' : 'opts';

  return (
    <div
      className="modal"
      data-open="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-title"
    >
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__panel" ref={panelRef}>
        <div className="modal__head">
          <span className="brand__mark" aria-hidden="true">
            U
          </span>
          <span className="modal__title" id="assessment-title">
            {ASSESSMENT.title}
          </span>
          <button className="cs__close" type="button" onClick={onClose} aria-label="Close assessment">
            &times;
          </button>
        </div>

        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Assessment progress"
        >
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="modal__body">
          {phase === 'questions' ? (
            <>
              <p className="step__k">{step.id.replace(/-/g, ' ')}</p>
              <h2 className="step__q" tabIndex={-1} ref={headingRef}>
                {step.question}
              </h2>
              <p className="step__h">{step.help}</p>

              {step.type === 'country' ? (
                <>
                  <input
                    className="csearch"
                    type="search"
                    placeholder="Search a destination"
                    aria-label="Search a destination"
                    autoComplete="off"
                    value={countryQuery}
                    onChange={(event) => setCountryQuery(event.target.value)}
                  />
                  <div className="copts" role="group" aria-label={step.question}>
                    {countryMatches.map((entry) => (
                      <button
                        className="opt"
                        type="button"
                        key={entry.slug}
                        aria-pressed={answers.destination === entry.slug}
                        onClick={() => choose(entry.slug!)}
                      >
                        <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
                        <span>{entry.name}</span>
                      </button>
                    ))}
                    {countryOptions.length === 0 ? (
                      <p className="cs__empty">
                        No destinations are published yet. Skip this one and a counsellor will
                        talk the options through with you.
                      </p>
                    ) : countryMatches.length === 0 ? (
                      <p className="cs__empty">No destination matches that search.</p>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className={optionsClass} role="group" aria-label={step.question}>
                  {(step.options ?? []).map((option) => (
                    <button
                      className="opt"
                      type="button"
                      key={option.value}
                      aria-pressed={answers[step.id] === option.value}
                      onClick={() => choose(option.value)}
                    >
                      <span>{option.label}</span>
                      {option.note ? <span className="opt__note">{option.note}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {phase === 'result' ? (
            <>
              <h2 className="step__q" tabIndex={-1} ref={headingRef}>
                {ASSESSMENT.result.title}
              </h2>
              <p className="step__h">{ASSESSMENT.result.lead}</p>

              <div className="profile">
                <div className="profile__head">
                  <span className="profile__t">Your profile</span>
                  <span className="profile__band">{band.label}</span>
                </div>
                {profile.length ? (
                  <dl className="profile__rows">
                    {profile.map((row) => (
                      <div className="profile__row" key={row.id}>
                        <dt>{row.question}</dt>
                        <dd>{row.answer}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <div className="profile__locked">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  {/* The design says the matches are ready and waiting to be
                      unlocked. Nothing is computed until a counsellor reads the
                      profile, so this says what actually happens next. */}
                  <span>
                    A counsellor checks this profile against live programmes and sends your
                    shortlist: matched universities, realistic admission odds and an intake plan.
                  </span>
                </div>
              </div>

              <form onSubmit={submit} noValidate>
                {ASSESSMENT.result.capture.fields.map((field) => {
                  const key = field.id as 'name' | 'phone' | 'email';
                  return (
                    <div
                      className="field"
                      key={field.id}
                      data-invalid={errors[key] ? 'true' : undefined}
                    >
                      <label htmlFor={`asm-${field.id}`}>{field.label}</label>
                      <input
                        id={`asm-${field.id}`}
                        type={field.type}
                        value={form[key]}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, [key]: event.target.value }))
                        }
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={errors[key] ? `asm-err-${field.id}` : undefined}
                        autoComplete={
                          field.id === 'name' ? 'name' : field.id === 'email' ? 'email' : 'tel'
                        }
                      />
                      {errors[key] ? (
                        <span className="field__err" id={`asm-err-${field.id}`} role="alert">
                          {errors[key]}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {/* Bot trap. Hidden from sight, the tab order and screen readers. */}
                <label className="sr-only" aria-hidden="true">
                  Company website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.companyWebsite}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, companyWebsite: event.target.value }))
                    }
                  />
                </label>

                {failure ? (
                  <p className="formerr" role="alert">
                    {failure}
                  </p>
                ) : null}

                <button className="btn btn--block btn--lg" type="submit" disabled={submitting}>
                  {submitting ? 'Sending…' : ASSESSMENT.result.capture.cta}{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                <p className="formnote">{ASSESSMENT.result.capture.note}</p>
              </form>
            </>
          ) : null}

          {phase === 'done' ? (
            <div className="done">
              <div className="done__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </div>
              <h2 className="done__t" tabIndex={-1} ref={headingRef}>
                {ASSESSMENT.result.success.title}
              </h2>
              <p className="done__b">{ASSESSMENT.result.success.body}</p>
              <div className="btn-row done__actions">
                <button className="btn btn--ghost" type="button" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {phase === 'questions' ? (
          <div className="modal__foot">
            {index > 0 ? (
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setIndex(index - 1)}
              >
                &larr; Back
              </button>
            ) : (
              <span />
            )}
            <div className="btn-row">
              <span className="cs__count" aria-live="polite">
                Question {index + 1} of {total}
              </span>
              <button className="btn btn--ghost btn--sm" type="button" onClick={advance}>
                Skip
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'result' ? (
          <div className="modal__foot">
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                setIndex(total - 1);
                setPhase('questions');
              }}
            >
              &larr; Back
            </button>
            <span className="cs__count">Profile complete</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
