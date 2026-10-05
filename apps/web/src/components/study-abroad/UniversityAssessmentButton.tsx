'use client';

import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The assessment, opened from a university's page.
 *
 * Opened from anywhere else on the site, the assessment starts with no
 * destination and files its lead under /study-abroad. A student reading
 * about one university has already told us both the country and the
 * institution, so this carries the two of them in: the destination step
 * arrives answered, and the lead is filed under the university's page so a
 * counsellor can see which institution it came from.
 */
export function UniversityAssessmentButton({
  className,
  intent,
  countrySlug,
  countryName,
  sourcePagePath,
  children,
}: {
  className: string;
  intent: string;
  countrySlug?: string;
  countryName?: string;
  sourcePagePath: string;
  children: React.ReactNode;
}) {
  const { openAssessment } = useStudyAbroadShell();
  return (
    <button
      className={className}
      type="button"
      onClick={() =>
        openAssessment({ intent, countrySlug, countryName, sourcePagePath })
      }
      data-testid={`university-assessment-${intent}`}
    >
      {children}
    </button>
  );
}
