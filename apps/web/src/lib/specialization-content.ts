/**
 * A specialization's own content -- the sections an editor wrote and how
 * each reads -- shared by its page and its page in a destination, so the
 * two cannot drift apart in what a section says or what it is called.
 */

export type ContentSection = {
  sectionKey: string;
  sectionType: string;
  bodyJson: { paragraphs?: unknown; items?: unknown; steps?: unknown } | null;
};

/** The lines a section holds: a checklist's items, a run of steps, or its
 * paragraphs. Blank lines are not lines. */
export function sectionLines(section: Pick<ContentSection, 'sectionType' | 'bodyJson'>): string[] {
  const body = section.bodyJson;
  if (!body) return [];
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string' && line.trim() !== '') : [];
  if (section.sectionType === 'CHECKLIST' && strings(body.items).length) return strings(body.items);
  if (section.sectionType === 'STEPS' && Array.isArray(body.steps))
    return body.steps
      .map((step) => (step && typeof step === 'object' ? (step as { text?: unknown }).text : step))
      .filter((line): line is string => typeof line === 'string' && line.trim() !== '');
  return strings(body.paragraphs);
}

/** The small label over each kind of section. */
export const SECTION_EYEBROWS: Record<string, string> = {
  'what-you-study': 'What you study',
  curriculum: 'Curriculum',
  skills: 'Skills',
  'career-outcomes': 'Careers',
  'admission-requirements': 'Admission',
  documents: 'Documents',
  'application-process': 'Applying',
  'why-choose': 'Why choose it',
  'top-destinations': 'Destinations',
};

/** A section's title when the editor gave it no heading: its key, read out. */
export function sectionTitle(key: string) {
  const words = key.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
