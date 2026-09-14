'use client';

import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The closing invitation to start the assessment. Shared by the directory and
 * every country guide, so the copy and the entry point stay in one place.
 */
export function PlanBand({
  heading = 'Not sure which country is right for you?',
  body = "Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover.",
  countrySlug,
  countryName,
  secondary,
}: {
  heading?: string;
  body?: string;
  countrySlug?: string;
  countryName?: string;
  secondary?: { href: string; label: string };
}) {
  const { openAssessment } = useStudyAbroadShell();

  return (
    <section className="sec sec--navy" id="plan">
      <div className="wrap final">
        <p className="eyebrow eyebrow--plain" style={{ justifyContent: 'center' }}>
          Next step
        </p>
        <h2 className="final__h">{heading}</h2>
        <p className="final__s">{body}</p>

        <div className="btn-row final__actions">
          <button
            className="btn btn--onnavy btn--lg"
            type="button"
            onClick={() => openAssessment({ countrySlug, countryName, intent: 'plan-band' })}
            data-testid="plan-band-assessment"
          >
            Build My Study Plan{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
          <a
            className="btn btn--onnavy-ghost btn--lg"
            href={secondary?.href ?? '#directory'}
          >
            {secondary?.label ?? 'Browse the directory'}
          </a>
        </div>

        <p className="final__micro">
          <span>
            <i aria-hidden="true" />
            Free assessment
          </span>
          <span>
            <i aria-hidden="true" />
            Personalised guidance
          </span>
          <span>
            <i aria-hidden="true" />
            No obligation
          </span>
        </p>
      </div>
    </section>
  );
}
