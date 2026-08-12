/**
 * Profile completion, decided in one place on the server.
 *
 * Sections are equally weighted on purpose. A student reads the number as
 * "how much of this is left", and unequal weights make that lie: filling a
 * section and watching the bar move by 3% is worse than no bar at all. When
 * business rules eventually say passport matters more than work history, the
 * weight belongs here as data, not scattered through the UI.
 *
 * The frontend renders this result and never recomputes it, so the number a
 * student sees on Home and the number used anywhere else cannot disagree.
 */

export const PROFILE_SECTIONS = [
  'PERSONAL_INFORMATION',
  'STUDY_PREFERENCES',
  'ACADEMIC_HISTORY',
  'ENGLISH_TEST',
  'PASSPORT',
  'RESUME',
  'STATEMENT_OF_PURPOSE',
  'RECOMMENDATION_LETTER',
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** What a student is told to do next, in their words. */
export const SECTION_LABELS: Record<ProfileSection, string> = {
  PERSONAL_INFORMATION: 'Personal details',
  STUDY_PREFERENCES: 'Study preferences',
  ACADEMIC_HISTORY: 'Education',
  ENGLISH_TEST: 'English test score',
  PASSPORT: 'Passport',
  RESUME: 'Resume',
  STATEMENT_OF_PURPOSE: 'Statement of purpose',
  RECOMMENDATION_LETTER: 'Letter of recommendation',
};

/** The order the onboarding walks, which is also the order we suggest next
 * steps in: identity first, then what they want, then evidence. */
export const SECTION_ORDER: ProfileSection[] = [...PROFILE_SECTIONS];

export interface CompletionInput {
  dateOfBirth: Date | null;
  nationalityCountryId: string | null;
  currentCountryId: string | null;
  preferredSubjectId: string | null;
  preferredCourseLevelId: string | null;
  preferredCountryCount: number;
  academicRecordCount: number;
  englishTestCount: number;
  hasPassport: boolean;
  documentTypes: string[];
}

export interface CompletionResult {
  percentage: number;
  completedSections: ProfileSection[];
  missingSections: ProfileSection[];
  /** The single thing worth doing next, or null when nothing is left. */
  nextSection: ProfileSection | null;
  nextSectionLabel: string | null;
}

function isComplete(section: ProfileSection, input: CompletionInput): boolean {
  const has = (type: string) => input.documentTypes.includes(type);
  switch (section) {
    case 'PERSONAL_INFORMATION':
      // Enough to address someone and know where they are applying from.
      return (
        input.dateOfBirth !== null &&
        input.nationalityCountryId !== null &&
        input.currentCountryId !== null
      );
    case 'STUDY_PREFERENCES':
      return (
        input.preferredSubjectId !== null &&
        input.preferredCourseLevelId !== null &&
        input.preferredCountryCount > 0
      );
    case 'ACADEMIC_HISTORY':
      return input.academicRecordCount > 0;
    case 'ENGLISH_TEST':
      return input.englishTestCount > 0;
    case 'PASSPORT':
      return input.hasPassport;
    case 'RESUME':
      return has('RESUME');
    case 'STATEMENT_OF_PURPOSE':
      return has('SOP');
    case 'RECOMMENDATION_LETTER':
      return has('LOR');
  }
}

export function calculateProfileCompletion(
  input: CompletionInput,
): CompletionResult {
  const completedSections = SECTION_ORDER.filter((section) =>
    isComplete(section, input),
  );
  const missingSections = SECTION_ORDER.filter(
    (section) => !completedSections.includes(section),
  );
  const percentage = Math.round(
    (completedSections.length / SECTION_ORDER.length) * 100,
  );
  const nextSection = missingSections[0] ?? null;

  return {
    percentage,
    completedSections,
    missingSections,
    nextSection,
    nextSectionLabel: nextSection ? SECTION_LABELS[nextSection] : null,
  };
}
