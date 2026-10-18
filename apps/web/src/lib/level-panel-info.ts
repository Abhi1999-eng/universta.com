import type { CourseLevelGroup } from './catalog';

/**
 * What a level's panel on a field's own page says about the level before
 * its courses: a line about it, then a few facts, so the panel reads as a
 * short preview of the level's own page rather than only a list.
 *
 * The line is the level page's own intro where an editor wrote one, else
 * the catalogue's description of the level (Admin, Study levels), else none.
 * Only facts that are recorded are stated; none is ever a zero.
 */
export type LevelFact = { label: string; value: string };

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Character references read once as the characters they stand for: the
 *  rich-text helper's plain text keeps "&amp;", and React would print it. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/** At most two sentences of plain text: the panel is a preview. */
export function aboutLine(text: string | null | undefined, sentences = 2): string | null {
  const plain = decodeEntities(text ?? '').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  /* Split where a sentence ends -- its stop, a space, then a capital, a
     figure or an opening quote -- so "1.5 years", "Ph.D. in" and "e.g. a"
     stay whole, and nothing is ever dropped. Linear in the text's length. */
  const parts = plain.split(/(?<=[.!?]["”’)]*)\s+(?=[A-Z0-9“"‘(])/);
  return parts.slice(0, sentences).join(' ');
}

/** "2 years", "1–2 years", "18 months": the span of the level's courses,
 *  where they share a unit. */
export function lengthAcross(courses: CourseLevelGroup['courses']): string | null {
  const units = new Set<string>();
  let low = Infinity;
  let high = -Infinity;
  for (const course of courses) {
    const min = Number(course.duration?.min ?? course.duration?.max);
    const max = Number(course.duration?.max ?? course.duration?.min);
    const unit = course.duration?.unit?.toLowerCase();
    if (!unit || !Number.isFinite(min) || !Number.isFinite(max) || min <= 0) continue;
    units.add(unit);
    low = Math.min(low, min);
    high = Math.max(high, max);
  }
  if (units.size !== 1 || !Number.isFinite(low)) return null;
  const [plural] = [...units];
  const amount = low === high ? String(low) : `${low}–${high}`;
  return `${amount} ${amount === '1' ? plural.replace(/s$/, '') : plural}`;
}

/** "Full time", "Full time, part time": how the level's courses are taught. */
export function modesAcross(courses: CourseLevelGroup['courses']): string | null {
  const names: string[] = [];
  for (const course of courses)
    for (const mode of course.studyModes ?? [])
      if (mode?.name && !names.includes(mode.name)) names.push(mode.name);
  if (!names.length) return null;
  return names.map((name, index) => (index ? name.toLowerCase() : name)).join(', ');
}

/* The specializations taught at a level are not a fact here: the panel
   names them, as chips, straight after these. */
export function levelFacts({
  group,
  programmes,
}: {
  group: CourseLevelGroup;
  /** The universities' programmes at this level, where they were counted. */
  programmes?: number | null;
}): LevelFact[] {
  const facts: LevelFact[] = [];
  if (programmes) facts.push({ label: programmes === 1 ? 'Programme at a university' : 'Programmes at universities', value: String(programmes) });
  /* The length and the modes are read off the level's courses, so only
     where the page holds all of them: a level with more than were read
     would be described by its first few. */
  if (group.courses.length >= group.count) {
    const length = lengthAcross(group.courses);
    if (length) facts.push({ label: 'Typical length', value: length });
    const modes = modesAcross(group.courses);
    if (modes) facts.push({ label: 'Study mode', value: modes });
  }
  return facts;
}
