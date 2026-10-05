/**
 * Words the structured editor shows for things it builds from field keys.
 *
 * A repeated row's fields are named by their keys ("city", "minimumScore"),
 * and the button under a list is named from the list's title. Printed as
 * they were, editors read "minimum Score" and "Add Campuse".
 */

/** "minimumScore" -> "Minimum score", "city" -> "City". */
export function rowFieldLabel(field: string): string {
  const words = field.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Campuses" -> "Campus", "Accreditations" -> "Accreditation". Only the
 * endings that take "-es" lose it; "Courses" stays "Course". */
export function singularTitle(title: string): string {
  if (/(us|ss|sh|ch|x)es$/i.test(title)) return title.slice(0, -2);
  return title.replace(/s$/i, '');
}

/**
 * The unit a course's duration is saved with.
 *
 * The field shows "YEARS" until an editor types something else, but that
 * shown value was never part of the form's state, so a duration entered
 * without touching the unit was saved with no unit at all -- "3", three of
 * nothing, on the public course page. With a duration and no unit chosen,
 * the unit is the one the field showed.
 */
export function offeringDurationUnit(values: Record<string, string | undefined>): string | undefined {
  const chosen = values.durationUnit?.trim();
  if (chosen) return chosen;
  return values.durationMin?.trim() || values.durationMax?.trim() ? 'YEARS' : undefined;
}
