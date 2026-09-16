import { RichText } from '@/components/phase1/RichText';
import type { Section } from '@/lib/countries';

/**
 * An editorial section, in whichever shape its author chose.
 *
 * The same five types the country editor already offers -- prose, a grid of
 * short facts, numbered steps, a set of cards, and a closing call to action --
 * rendered in the approved design's language. The section key decides where a
 * section sits on the page; this decides how it reads.
 *
 * A body that does not match its declared type renders nothing rather than
 * guessing, so a half-finished section is invisible rather than broken.
 */

type Item = Record<string, unknown>;

function itemsOf(body: Record<string, unknown> | null): Item[] {
  const items = body?.items;
  return Array.isArray(items) ? (items as Item[]) : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function EditorialSection({ section, alt }: { section: Section; alt: boolean }) {
  const body = section.bodyJson;
  const items = itemsOf(body);
  const paragraphs = Array.isArray(body?.paragraphs)
    ? (body.paragraphs as unknown[]).filter((entry): entry is string => typeof entry === 'string')
    : [];

  const type = section.sectionType;
  const hasContent =
    paragraphs.length > 0 || items.length > 0 || (type === 'CTA' && section.ctaUrl);
  if (!hasContent && !section.heading) return null;

  return (
    <section
      className={`sec ${alt ? 'sec--paper' : 'sec--white'}`}
      id={`country-${section.sectionKey}`}
    >
      <div className={type === 'RICH_TEXT' ? 'wrap wrap--narrow' : 'wrap'}>
        {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
        {section.heading ? <h2 className="sec-title">{section.heading}</h2> : null}
        {section.subheading ? <p className="sec-lead">{section.subheading}</p> : null}

        {type === 'RICH_TEXT' && paragraphs.length
          ? paragraphs.map((paragraph, index) => (
              <RichText key={index} value={paragraph} className="sec-lead" />
            ))
          : null}

        {type === 'FACT_GRID' && items.length ? (
          <div className="rulegrid rulegrid--3">
            {items.map((item, index) => (
              <div className="rulegrid__item" key={index}>
                <span className="rulegrid__n">{text(item.label) ?? ''}</span>
                <span className="rulegrid__t">{text(item.value) ?? ''}</span>
              </div>
            ))}
          </div>
        ) : null}

        {type === 'STEPS' && items.length ? (
          <div className="journey">
            {items.map((item, index) => (
              <article className="jstep" key={index}>
                <span className="jstep__dot" aria-hidden="true" />
                <span className="jstep__n">{text(item.step) ?? String(index + 1)}</span>
                {text(item.title) ? (
                  <h3 className="jstep__t">{item.title as string}</h3>
                ) : null}
                {text(item.description) ? (
                  <div className="jstep__b">
                    <RichText value={item.description as string} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {type === 'CARD_GRID' && items.length ? (
          <div className="routes">
            {items.map((item, index) => (
              <article className="route" key={index}>
                <span className="route__n">{String(index + 1).padStart(2, '0')}</span>
                {text(item.title) ? (
                  <h3 className="route__l">{item.title as string}</h3>
                ) : null}
                {text(item.description) ? (
                  <div className="route__d">
                    <RichText value={item.description as string} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {type === 'CTA' && section.ctaUrl ? (
          <a className="btn btn--lg" href={section.ctaUrl}>
            {section.ctaLabel ?? 'Find out more'}{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
