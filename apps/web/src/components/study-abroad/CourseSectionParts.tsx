import { RichText } from '@/components/phase1/RichText';
import type { Media } from '@/lib/catalog';
import {
  sectionItems,
  sectionParagraphs,
  type CourseSection,
} from '@/lib/course-sections';

/**
 * The pieces a course's content sections are drawn with, in the design's
 * classes, shared by the course guide and a programme's own page: the
 * numbered role list (`.careerlist`), the documents as pills (`.pillrow`),
 * a section's paragraphs and its picture.
 */

/** The picture an editor chose for a section, under its text. */
export function SectionMedia({ media }: { media?: Media | null }) {
  if (!media?.url) return null;
  return (
    <figure className="cg-media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt={media.alt ?? ''} loading="lazy" />
      {media.title?.trim() && media.title.trim() !== media.alt?.trim() ? (
        <figcaption>{media.title.trim()}</figcaption>
      ) : null}
    </figure>
  );
}

/** A section's paragraphs as the editor wrote them. */
export function SectionProse({ section }: { section: CourseSection }) {
  const paragraphs = sectionParagraphs(section);
  if (!paragraphs.length) return null;
  return (
    <div className="prose">
      {paragraphs.map((line, index) => (
        <RichText key={index} value={line} />
      ))}
    </div>
  );
}

/**
 * The design's numbered list of roles -- "01 Software engineer" -- in two
 * columns. Built only from the lines an editor saved; with none it draws
 * nothing, never a made-up role.
 */
export function CareerList({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <ol className="careerlist cg-list" aria-label={label}>
      {items.map((item, index) => (
        <li className="careerlist__item" key={`${index}-${item}`}>
          <span className="careerlist__n" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}

/** A list section's items, or its paragraphs when it was saved as text. */
export function SectionList({
  section,
  label,
}: {
  section: CourseSection;
  label: string;
}) {
  const items = sectionItems(section);
  return items.length ? (
    <CareerList items={items} label={label} />
  ) : (
    <SectionProse section={section} />
  );
}

/** A checklist that is not a run of roles -- what admission asks for --
 *  as a plain list, or its paragraphs when it was saved as text. */
export function SectionChecklist({ section }: { section: CourseSection }) {
  const items = sectionItems(section);
  if (!items.length) return <SectionProse section={section} />;
  return (
    <ul className="prose cg-checklist">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

/** The documents an application asks for, as the design's pill row. */
export function DocumentPills({ section }: { section: CourseSection }) {
  const items = sectionItems(section);
  if (!items.length) return <SectionProse section={section} />;
  return (
    <ul className="pillrow cg-pills" aria-label={section.heading ?? 'Documents'}>
      {items.map((item, index) => (
        <li className="pill pill--sm" key={`${index}-${item}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}
