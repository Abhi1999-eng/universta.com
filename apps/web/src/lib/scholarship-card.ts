import { richTextToPlainText } from '@/components/phase1/RichText';

/**
 * A scholarship reduced to the lines a card can print.
 *
 * Every public surface that mentions funding -- the country guide, the
 * subject guide, a university, a course -- showed a title and a link, and
 * four pages reduced the same API row four different ways. A scholarship
 * record carries what it is worth, who it is for and when it closes, and
 * none of that reached a reader who had not gone to the finder.
 *
 * So the reduction lives here once, with the decisions it makes pinned by
 * tests, and the card component renders what comes out of it.
 */
export interface ScholarshipCard {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  provider: string | null;
  /** "Full tuition", "Living stipend" -- free text, not a fixed list. */
  benefit: string | null;
  /** "EUR 12,000". Null when no figure is recorded. */
  award: string | null;
  /** The stored closing date, formatted. Null when none is published. */
  deadline: string | null;
  eligibility: string | null;
  countries: Array<{ name: string; slug: string; iso2: string | null }>;
  universities: Array<{ name: string; slug: string }>;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** "PARTIAL_TUITION" -> "Partial tuition". The column is free text. */
export function benefitLabel(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const words = raw.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * What the award is worth.
 *
 * An amount of zero is not an award of nothing, it is a field nobody filled
 * in -- the same reading the course fee range takes of a range whose ends
 * are both zero. A scholarship with no cash figure still says what it covers
 * through its benefit type, so dropping the line loses nothing.
 *
 * The currency code prefixes the figure where the record has one. Where it
 * does not, the figure still prints: a number without its unit is thin, but
 * it is what the record says, and hiding it would be thinner.
 */
export function awardLabel(amount: unknown, currencyCode: unknown): string | null {
  const value =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string' && amount.trim()
        ? Number(amount)
        : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return null;
  const figure = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 2,
  }).format(value);
  const code = text(currencyCode);
  return code ? `${code.toUpperCase()} ${figure}` : figure;
}

/**
 * The closing date as the record stores it.
 *
 * Deliberately never compared against the clock. Whether a deadline has
 * passed is the finder's "Only open deadlines" filter, and deriving it
 * during render would make the server's HTML and the client's hydration
 * disagree on any page that crosses midnight.
 */
export function deadlineLabel(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The opening words of the eligibility the provider published.
 *
 * Authored as rich text, so the markup comes off first. Cut at a word
 * boundary: a card that ends mid-word reads as broken rather than
 * abbreviated, and the award's own page carries the whole of it.
 */
export function eligibilitySnippet(value: unknown, limit = 180): string | null {
  const raw = text(value);
  if (!raw) return null;
  const words = richTextToPlainText(raw);
  if (!words) return null;
  if (words.length <= limit) return words;
  const cut = words.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/, '')}…`;
}

function named(rows: unknown): Array<Record<string, unknown>> {
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

/**
 * One API row, or null when it is not a scholarship this page can link to.
 *
 * A row without a slug has no page to send a reader to, so it is dropped
 * rather than rendered as a card that goes nowhere.
 */
export function toScholarshipCard(row: unknown): ScholarshipCard | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const slug = text(record.slug);
  const title = text(record.title) ?? text(record.name);
  if (!slug || !title) return null;
  const provider = record.provider as Record<string, unknown> | null | undefined;
  return {
    id: text(record.id) ?? slug,
    title,
    slug,
    summary: text(record.summary),
    provider: text(provider?.name),
    benefit: benefitLabel(record.benefitType),
    award: awardLabel(record.amount, record.currencyCode),
    deadline: deadlineLabel(record.deadline),
    eligibility: eligibilitySnippet(record.eligibility),
    countries: named(record.countries).flatMap((link) => {
      const country = link.country as Record<string, unknown> | undefined;
      const name = text(country?.name);
      return name
        ? [
            {
              name,
              slug: text(country?.slug) ?? '',
              iso2: text(country?.iso2Code),
            },
          ]
        : [];
    }),
    universities: named(record.universities).flatMap((link) => {
      const university = link.university as Record<string, unknown> | undefined;
      const name = text(university?.name);
      return name ? [{ name, slug: text(university?.slug) ?? '' }] : [];
    }),
  };
}

/** Every row a list endpoint returned, as cards, dropping the unlinkable. */
export function toScholarshipCards(rows: unknown): ScholarshipCard[] {
  return named(rows).flatMap((row) => {
    const card = toScholarshipCard(row);
    return card ? [card] : [];
  });
}
