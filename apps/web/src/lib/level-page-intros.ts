import { getLevelPageIndex, getSubjectLevelPage } from './catalog';

/**
 * The intros editors wrote on a field's level pages, by level code ("PG" ->
 * its intro's HTML), so the field's own page can say a line about each
 * level before it links there. Only published pages; one read for the
 * list of them, then one per published page, which is usually none or two.
 *
 * Empty when the list could not be read; a page that fails to load is left
 * out on its own. Neither stops the page: its level panels simply say less.
 */
export async function levelPageIntros(field: {
  subject: string;
  specialization?: string;
}): Promise<Record<string, string>> {
  try {
    const index = await getLevelPageIndex();
    /* Every published page of the field: the index lists only those. Not
       only the search-ready ones (`hasOwnContent` asks for three FAQs too),
       since the page itself shows any published intro; one with no intro
       is left out below. */
    const subject = field.subject.toLowerCase();
    const specialization = field.specialization?.toLowerCase() ?? null;
    const written = index.rows.filter(
      (row) =>
        row.subjectSlug.toLowerCase() === subject &&
        (row.specializationSlug?.toLowerCase() ?? null) === specialization,
    );
    const intros = await Promise.all(
      written.map((row) =>
        getSubjectLevelPage({ ...field, level: row.levelSlug })
          .then((page) => {
            const intro = page.content?.intro?.trim();
            return intro ? ([row.levelCode.toUpperCase(), intro] as const) : null;
          })
          .catch(() => null),
      ),
    );
    return Object.fromEntries(intros.filter((entry) => entry !== null));
  } catch {
    return {};
  }
}
