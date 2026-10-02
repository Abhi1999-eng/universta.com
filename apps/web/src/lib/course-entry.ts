import type { CourseAvailability } from './catalog';

/**
 * What one destination asks of an applicant, reduced to the rows a page can
 * print.
 *
 * The catalogue has carried this per country-course mapping all along --
 * grade floors, English scores, work experience, application fees,
 * deadlines -- and nothing rendered it, so a reader comparing two
 * destinations for the same course saw only their names. The hard part is
 * not the markup, it is deciding what counts as "recorded", and that is
 * what lives here.
 *
 * A missing figure is missing, not zero. A destination that has not set a
 * CGPA floor has not set one to 0.0, and printing a dash for every unset
 * field turns a short honest panel into a long misleading one.
 */
export type EntryRow = { label: string; value: string };

const has = (value: unknown): value is string | number =>
  value !== null && value !== undefined && value !== '';

const score = (value: string | number | null | undefined) =>
  has(value) ? String(Number(value)) : null;

/** The money a destination asks for, as one line or none. */
export function feeRange(
  range: { min?: string | null; max?: string | null; currencyCode?: string | null } | null | undefined,
): string | null {
  if (!range) return null;
  const min = has(range.min) ? Number(range.min) : null;
  const max = has(range.max) ? Number(range.max) : null;
  if (min === null && max === null) return null;
  const code = range.currencyCode ? `${range.currencyCode} ` : '';
  const money = (value: number) => value.toLocaleString('en-GB');
  if (min !== null && max !== null)
    /* One figure when both ends agree: "0 – 0" reads as a range that was
       never set rather than as a course that is free. */
    return min === max ? `${code}${money(min)}` : `${code}${money(min)} – ${money(max)}`;
  return `${code}${money((min ?? max)!)}`;
}

/** The academic bar, as the catalogue records it. */
export function academicRows(row: CourseAvailability): EntryRow[] {
  const out: EntryRow[] = [];
  const percentage = score(row.academicRequirements?.percentage);
  const cgpa = score(row.academicRequirements?.cgpa);
  if (percentage) out.push({ label: 'Academic minimum', value: `${percentage}%` });
  if (cgpa) out.push({ label: 'Minimum CGPA', value: cgpa });
  if (has(row.workExperienceMonths)) {
    const months = Number(row.workExperienceMonths);
    out.push({
      label: 'Work experience',
      value: months === 1 ? '1 month' : `${months} months`,
    });
  }
  return out;
}

/** The English tests this destination names a number for. */
export function englishRows(row: CourseAvailability): EntryRow[] {
  const tests: Array<[string, string | null | undefined]> = [
    ['IELTS', row.englishRequirements?.ielts],
    ['TOEFL', row.englishRequirements?.toefl],
    ['PTE', row.englishRequirements?.pte],
    ['Duolingo', row.englishRequirements?.duolingo],
  ];
  return tests
    .map(([label, value]) => ({ label, value: score(value) }))
    .filter((row): row is EntryRow => row.value !== null);
}

export type IntakeRow = { id: string; name: string; deadline: string | null; notes: string | null };

/**
 * The intakes a destination opens, with the deadline where one is known.
 *
 * An intake with no deadline is still worth printing -- knowing a course
 * starts in September is useful even when nobody has recorded the closing
 * date -- so the row stays and the deadline cell says what it is.
 */
export function intakeRows(row: CourseAvailability): IntakeRow[] {
  return (row.intakes ?? [])
    .filter((entry) => entry.status !== 'INACTIVE')
    .map((entry) => ({
      id: entry.id,
      /* An empty name is as absent as a missing one, and `??` would let
         it through to print a blank cell. */
      name:
        entry.intake?.name?.trim() ||
        entry.intake?.shortLabel?.trim() ||
        'Intake',
      deadline: entry.applicationDeadline
        ? new Date(entry.applicationDeadline).toISOString().slice(0, 10)
        : null,
      notes: entry.deadlineNotes?.trim() || null,
    }));
}

/** Whether a destination has anything to say beyond its own name. */
export function hasEntryDetail(row: CourseAvailability): boolean {
  return Boolean(
    feeRange(row.tuition) ||
      feeRange(row.applicationFee) ||
      academicRows(row).length ||
      englishRows(row).length ||
      intakeRows(row).length ||
      row.admissionRequirements?.trim() ||
      row.englishRequirementsText?.trim() ||
      row.applicationNotes?.trim(),
  );
}
