const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const monthOptions = MONTHS.map((label, index) => ({ value: index + 1, label }));

export function intakeRange(
  intake: { startMonth?: number | null; endMonth?: number | null; shortLabel?: string | null; name?: string | null },
): string {
  const start = intake.startMonth && MONTHS[intake.startMonth - 1];
  const end = intake.endMonth && MONTHS[intake.endMonth - 1];
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return intake.shortLabel ?? intake.name ?? 'Not published';
}
