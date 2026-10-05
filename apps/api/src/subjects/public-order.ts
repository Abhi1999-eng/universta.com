/**
 * The orders a subject's and a specialization's public pages are read in.
 *
 * Both were left to the database. A destination link's own `displayOrder` is
 * 0 on every row, so "Where you can study Computer Science" opened on
 * Afghanistan, Albania and Algeria -- none of which teaches it -- while the
 * United Kingdom sat a hundred and eighty chips further down. Study levels
 * came back in whatever order the rows were grouped, so PhD led and
 * Foundation trailed. Each is put right here, once, as a plain function the
 * tests can hold without a database.
 */

export type DestinationCountry = {
  id: string;
  name: string;
  slug: string;
  iso2Code: string | null;
  /** The catalogue's own country order: the destinations directory's. */
  displayOrder?: number | null;
};

export type RankedDestination = {
  id: string;
  name: string;
  slug: string;
  iso2Code: string | null;
  /** Published programmes in this subject (or specialization) that are open
   *  to apply to in this country. 0 for a destination that lists it with
   *  nothing behind it yet. */
  courseCount: number;
};

/**
 * Every destination a subject or specialization is shown in, the ones that
 * teach it first.
 *
 * `linked` is the editorial list (what a country's editor ticked, and what the
 * page has always shown); `teaching` is the published programmes counted per
 * country. A country that teaches it without being linked is still a place
 * you can study it, so it joins the list rather than being lost. Within the
 * same count the catalogue's own country order decides -- the destinations
 * directory's, which puts Canada, the United States and the United Kingdom
 * near the top -- then the name.
 *
 * The link's own `displayOrder` is not used: it places the subject on the
 * country's page (it is indexed by country), so it says nothing about where
 * the country belongs on the subject's.
 */
export function rankDestinations(
  linked: Array<{ country: DestinationCountry }>,
  teaching: Map<string, number>,
  unlinked: DestinationCountry[] = [],
): RankedDestination[] {
  const seen = new Set<string>();
  const rows: DestinationCountry[] = [];
  for (const { country } of linked) {
    if (seen.has(country.id)) continue;
    seen.add(country.id);
    rows.push(country);
  }
  for (const country of unlinked) {
    if (seen.has(country.id) || !teaching.get(country.id)) continue;
    seen.add(country.id);
    rows.push(country);
  }
  const count = (id: string) => teaching.get(id) ?? 0;
  return rows
    .sort(
      (a, b) =>
        count(b.id) - count(a.id) ||
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .map((country) => ({
      id: country.id,
      name: country.name,
      slug: country.slug,
      iso2Code: country.iso2Code,
      courseCount: count(country.id),
    }));
}

export type OrderedLevel = {
  id?: string;
  code: string | null;
  name: string;
  educationOrder?: number | null;
  displayOrder?: number | null;
};

/**
 * Study levels in the order a student climbs them -- Foundation, Diploma,
 * Bachelor's, Master's, PhD -- which is the order the public course-levels
 * list already gives. Ties fall back to the levels' own display order and
 * then their names, so the result never depends on how rows were grouped.
 */
export function byEducationOrder<T extends OrderedLevel>(a: T, b: T): number {
  return (
    (a.educationOrder ?? 0) - (b.educationOrder ?? 0) ||
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

/** A level as the public payload has always carried it: no ordering keys. */
export function publicLevel(level: OrderedLevel & { id: string }) {
  return { id: level.id, name: level.name, code: level.code };
}
