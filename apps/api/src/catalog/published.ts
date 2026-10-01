/**
 * What "published" means, in one place, for every catalogue record.
 *
 * It used to mean something slightly different on each page, and the pages
 * said so out loud: a subject's own page counted sixteen programmes under
 * it while /courses counted none of them, because the listing also demanded
 * that a course be mapped to a destination and the subject page did not.
 * Both called themselves the catalogue. The disagreement hid a real fault
 * for weeks -- one page kept insisting everything was fine.
 *
 * So the word now carries exactly one meaning, and it is the only one an
 * editor can act on: someone pressed publish, and nobody has deleted it.
 *
 * Whether a course has somewhere to study it is a different question with a
 * different answer, and it belongs in a filter the reader chooses -- pick a
 * destination and the list narrows to what is taught there. It is not part
 * of being published, and a catalogue that hides its own records until
 * somebody fills in a second table is not telling the truth about itself.
 */
export const PUBLISHED = { status: 'PUBLISHED', deletedAt: null } as const;

/** The same, for a relation: `subject: publishedRelation()`. */
export function publishedRelation() {
  return { ...PUBLISHED };
}
