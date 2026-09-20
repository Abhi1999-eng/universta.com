'use client';

import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The assessment entry point, wherever the homepage offers it.
 *
 * The assessment itself lives in the route family's shell, so every entry
 * point opens the same dialog and reports where it was opened from. This is
 * the only part of the homepage's funnel that needs the client, which is why
 * it is a component of its own rather than the whole section.
 */
export function AssessmentCta({
  className,
  intent,
  children,
  arrow = true,
}: {
  className: string;
  intent: string;
  children: React.ReactNode;
  arrow?: boolean;
}) {
  const { openAssessment } = useStudyAbroadShell();

  return (
    <button
      className={className}
      type="button"
      onClick={() => openAssessment({ intent })}
      data-testid={`assessment-cta-${intent}`}
    >
      {children}
      {arrow ? (
        <span className="linkcta__arrow" aria-hidden="true">
          →
        </span>
      ) : null}
    </button>
  );
}
