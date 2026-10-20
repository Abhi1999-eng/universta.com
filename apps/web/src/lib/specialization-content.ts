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

/** "<p><strong>Name</strong>: line</p>" paragraphs, read as named cards; null
 *  unless every paragraph reads that way and there are at least two -- a
 *  destinations section written country by country. */
export function namedParagraphs(lines: string[]): Array<{ name: string; line: string }> | null {
  const cards = lines.map((line) => {
    const match = line
      .trim()
      .match(/^<p>\s*<(strong|b)>([^<:]{2,60}?):?<\/\1>\s*[:\u2013\u2014-]?\s*([\s\S]+?)\s*<\/p>$/);
    return match && match[3].replace(/<[^>]+>/g, '').trim() ? { name: match[2].trim(), line: match[3].trim() } : null;
  });
  return cards.length >= 2 && cards.every(Boolean) ? (cards as Array<{ name: string; line: string }>) : null;
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
