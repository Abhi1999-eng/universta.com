'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSESSMENT, bandFor, scoreFor } from '@/lib/study-abroad-assessment';
import type { Destination } from '@/lib/study-abroad';
import type { AssessmentContext } from './StudyAbroadShell';

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

type Phase = 'questions' | 'result' | 'capture' | 'done';

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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>('questions');
  const [form, setForm] = useState({ name: '', phone: '', email: '', companyWebsite: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* The country step offers the destinations that actually have a guide; the
   * design's own list is a mock-up. Pre-selected when the assessment was opened
   * from a country page. */
  const countryOptions = useMemo(
    () => (destinations ?? []).filter((entry) => entry.slug),
    [destinations],
  );

  useEffect(() => {
    if (context.countrySlug)
      setAnswers((current) => ({ ...current, destination: context.countrySlug! }));
  }, [context.countrySlug]);

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
  const answeredCount = Object.keys(answers).length;
  const score = scoreFor(answers);
  const band = bandFor(score);

  const choose = (value: string) => {
    const next = { ...answers, [step.id]: value };
    setAnswers(next);
    if (index + 1 < total) setIndex(index + 1);
    else setPhase('result');
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

  return (
    <div
      className="asm"
      data-open="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-title"
    >
      <div className="asm__scrim" onClick={onClose} />
      <div className="asm__panel" ref={panelRef}>
        <div className="asm__head">
          <div>
            <p className="asm__eyebrow">{ASSESSMENT.title}</p>
            <h2 className="asm__title" id="assessment-title" tabIndex={-1} ref={headingRef}>
              {phase === 'questions'
                ? step.question
                : phase === 'done'
                  ? ASSESSMENT.result.success.title
                  : ASSESSMENT.result.title}
            </h2>
          </div>
          <button className="asm__close" type="button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {phase === 'questions' ? (
          <>
            <div className="asm__progress" aria-hidden="true">
              <span style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>
            <p className="asm__step" aria-live="polite">
              Question {index + 1} of {total}
            </p>
            <p className="asm__help">{step.help}</p>

            <div className="asm__options" role="group" aria-label={step.question}>
              {step.type === 'country'
                ? countryOptions.map((entry) => (
                    <button
                      className="asm__opt"
                      type="button"
                      key={entry.slug}
                      aria-pressed={answers.destination === entry.slug}
                      onClick={() => choose(entry.slug!)}
                    >
                      <span className="asm__opt-l">{entry.name}</span>
                    </button>
                  ))
                : (step.options ?? []).map((option) => (
                    <button
                      className="asm__opt"
                      type="button"
                      key={option.value}
                      aria-pressed={answers[step.id] === option.value}
                      onClick={() => choose(option.value)}
                    >
                      <span className="asm__opt-l">{option.label}</span>
                      {option.note ? <span className="asm__opt-n">{option.note}</span> : null}
                    </button>
                  ))}
              {step.type === 'country' && countryOptions.length === 0 ? (
                <p className="asm__help">
                  No destinations are published yet. You can still continue and a counsellor
                  will talk the options through with you.
                </p>
              ) : null}
            </div>

            <div className="asm__foot">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => (index === 0 ? onClose() : setIndex(index - 1))}
              >
                {index === 0 ? 'Cancel' : 'Back'}
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => (index + 1 < total ? setIndex(index + 1) : setPhase('result'))}
              >
                Skip
              </button>
            </div>
          </>
        ) : null}

        {phase === 'result' ? (
          <>
            <p className="asm__lead">{ASSESSMENT.result.lead}</p>
            <div className="asm__band" data-band={band.id}>
              <span className="asm__band-l">{band.label}</span>
              <span className="asm__band-n">{band.note}</span>
            </div>
            <p className="asm__help">
              {answeredCount} of {total} questions answered.
            </p>
            <div className="asm__foot">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setPhase('questions')}
              >
                Review answers
              </button>
              <button className="btn btn--sm" type="button" onClick={() => setPhase('capture')}>
                {ASSESSMENT.result.capture.cta}
              </button>
            </div>
          </>
        ) : null}

        {phase === 'capture' ? (
          <form onSubmit={submit} noValidate>
            <p className="asm__lead">{ASSESSMENT.result.capture.note}</p>
            {ASSESSMENT.result.capture.fields.map((field) => {
              const key = field.id as 'name' | 'phone' | 'email';
              return (
                <label className="asm__field" key={field.id}>
                  <span>{field.label}</span>
                  <input
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
                    <span className="asm__err" id={`asm-err-${field.id}`} role="alert">
                      {errors[key]}
                    </span>
                  ) : null}
                </label>
              );
            })}

            {/* Bot trap. Left in the tab order out of a screen reader's way. */}
            <label className="asm__trap" aria-hidden="true">
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
              <p className="asm__err" role="alert">
                {failure}
              </p>
            ) : null}

            <div className="asm__foot">
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setPhase('result')}
              >
                Back
              </button>
              <button className="btn btn--sm" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : ASSESSMENT.result.capture.cta}
              </button>
            </div>
          </form>
        ) : null}

        {phase === 'done' ? (
          <>
            <p className="asm__lead">{ASSESSMENT.result.success.body}</p>
            <div className="asm__foot">
              <button className="btn btn--sm" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
