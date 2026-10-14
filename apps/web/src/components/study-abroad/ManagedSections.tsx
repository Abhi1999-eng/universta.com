import Link from 'next/link';
import { ExperimentCta } from '@/components/phase1/ExperimentCta';
import { fetchDirectoryItems, visibilityClass } from '@/components/phase1/PageSectionRenderer';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { formatNumber } from '@/lib/format';
import { resolveHref } from '@/lib/internal-links';

/**
 * A managed page's sections, drawn with the design's classes.
 *
 * The admin's Website Builder writes the same section types everywhere;
 * the older renderer draws them in the older template's classes. A page in
 * the approved design draws them here instead: prose as the zip's prose,
 * answers as its FAQ list, cards as its cards, figures as its stat strip,
 * links as its link list. Per-device visibility is honoured the same way.
 * Section media come from approved asset hosts, as elsewhere in this app. */
/* eslint-disable @next/next/no-img-element */

type Row = { label?: string; value?: string; description?: string; url?: string };
type Body = {
  paragraphs?: string[];
  supportingText?: string;
  caption?: string;
  imagePosition?: 'left' | 'right';
  items?: Row[];
  limit?: number;
  dataMode?: 'automatic' | 'manual';
  filters?: { q?: string; country?: string };
  sort?: string;
  picks?: string[];
};

const DIRECTORIES = new Set([
  'COUNTRY_DIRECTORY',
  'UNIVERSITY_DIRECTORY',
  'COURSE_DIRECTORY',
  'SCHOLARSHIP_DIRECTORY',
  'CONSULTANT_DIRECTORY',
  'TESTIMONIALS',
  'SUCCESS_STORIES',
]);

const text = (value: unknown) => (typeof value === 'string' ? value : '');

function media(section: AnyRecord) {
  const record = section.media as { publicUrl?: string; url?: string; altText?: string; title?: string } | null | undefined;
  const url = record?.publicUrl || record?.url || '';
  return url ? { url, alt: record?.altText || record?.title || '' } : null;
}

/** Every answer a page's FAQ groups hold, for a count and for structured data. */
export function managedFaqItems(sections: readonly AnyRecord[]) {
  return sections
    .filter((section) => section.sectionType === 'FAQ_GROUP')
    .flatMap((section) => ((section.bodyJson as Body | null)?.items ?? []) as Row[])
    .filter((item): item is { label: string; value: string } => Boolean(item?.label && item?.value));
}

async function Section({ section, pageTitle }: { section: AnyRecord; pageTitle?: string }) {
  const type = text(section.sectionType) || 'CUSTOM';
  const body = (section.bodyJson && typeof section.bodyJson === 'object' ? section.bodyJson : {}) as Body;
  /* An intro section often repeats the page's own title as its heading; the
     hero has just said it, so it is not said again. */
  const own = text(section.title) || text(section.heading) || text(section.sectionKey);
  const heading = pageTitle && own.trim().toLowerCase() === pageTitle.trim().toLowerCase() ? '' : own;
  const eyebrow = text(section.eyebrow);
  const subheading = text(section.subheading);
  const image = media(section);
  const items = (body.items ?? []).filter(Boolean);
  const ctaHref = section.ctaPrimaryUrl ? await resolveHref(String(section.ctaPrimaryUrl)) : null;

  let content: React.ReactNode = null;
  if (type === 'RICH_TEXT') {
    const paragraphs = (body.paragraphs ?? []).filter(Boolean);
    content = paragraphs.length ? (
      <div className="h-prose">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
        ))}
      </div>
    ) : null;
  } else if (type === 'FAQ_GROUP') {
    content = items.length ? (
      <div className="h-faqs">
        {items.map((item, index) => (
          <details className="h-faq" key={`${item.label}-${index}`}>
            <summary>{item.label}</summary>
            <p>{item.value}</p>
          </details>
        ))}
      </div>
    ) : null;
  } else if (type === 'CARD_GRID') {
    content = items.length ? (
      <div className="h-grid">
        {items.map((item, index) => {
          const card = (
            <>
              <strong className="h-card__t">{item.label}</strong>
              {item.description ? <span className="h-card__d">{item.description}</span> : null}
            </>
          );
          return item.url ? (
            <Link className="h-card" href={item.url} key={`${item.label}-${index}`}>
              {card}
            </Link>
          ) : (
            <div className="h-card" key={`${item.label}-${index}`}>
              {card}
            </div>
          );
        })}
      </div>
    ) : null;
  } else if (type === 'STATS') {
    content = items.length ? (
      <div className={`statstrip statstrip--${Math.min(items.length, 6)}`}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <b className="datum">{/^\d+$/.test(item.value ?? '') ? formatNumber(Number(item.value)) : item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    ) : null;
  } else if (type === 'RELATED_LINKS') {
    const resolved = await Promise.all(items.map((item) => resolveHref(item.url)));
    const links = items
      .map((item, index) => ({ item, href: resolved[index] }))
      .filter((row): row is { item: Row; href: string } => Boolean(row.href));
    content = links.length ? (
      <ul className="linklist">
        {links.map(({ item, href }, index) => (
          <li key={`${item.label}-${index}`}>
            <Link href={href}>{item.label}</Link>
          </li>
        ))}
      </ul>
    ) : null;
  } else if (type === 'CTA') {
    content = body.supportingText ? <p className="sec-lead">{body.supportingText}</p> : null;
  } else if (type === 'IMAGE') {
    content = image ? (
      <figure className="h-figure">
        <img src={image.url} alt={image.alt || heading} />
        {body.caption ? <figcaption>{body.caption}</figcaption> : null}
      </figure>
    ) : null;
  } else if (type === 'IMAGE_TEXT') {
    content = (
      <div className={`h-imgtext${body.imagePosition === 'right' ? ' h-imgtext--right' : ''}`}>
        {image ? <img src={image.url} alt={image.alt || heading} /> : null}
        <div className="h-prose">
          {subheading ? <p>{subheading}</p> : null}
          {body.caption ? <p className="h-note">{body.caption}</p> : null}
        </div>
      </div>
    );
  } else if (type === 'LEAD_GENERATION') {
    content = (
      <p className="h-more">
        <Link className="btn" href="/contact#support">
          Send a message to Universta
        </Link>
      </p>
    );
  } else if (DIRECTORIES.has(type)) {
    const rows = await fetchDirectoryItems(type, body);
    content = rows.length ? (
      <ul className="h-list">
        {rows.map((row, index) => (
          <li key={`${row.title}-${index}`}>
            {row.href ? <Link href={row.href}>{row.title}</Link> : <strong>{row.title}</strong>}
            {row.description ? <span>{row.description}</span> : null}
          </li>
        ))}
      </ul>
    ) : null;
  } else {
    content = subheading ? <p className="sec-lead">{subheading}</p> : null;
  }

  return (
    <article className={`h-msec${visibilityClass(section)}`} id={text(section.sectionKey) || undefined}>
      {eyebrow ? <p className="eyebrow eyebrow--plain">{eyebrow}</p> : null}
      {heading ? <h2 className="sec-title h-msec__t">{heading}</h2> : null}
      {subheading && type !== 'IMAGE_TEXT' && type !== 'CTA' ? <p className="sec-lead">{subheading}</p> : null}
      {content}
      {ctaHref && section.ctaPrimaryLabel ? (
        <p className="h-more">
          <ExperimentCta className="linkcta" href={ctaHref} experimentKey={section.experimentKey}>
            {String(section.ctaPrimaryLabel)} <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
          </ExperimentCta>
        </p>
      ) : null}
    </article>
  );
}

export function ManagedSections({
  sections,
  pageTitle,
}: {
  sections: readonly AnyRecord[];
  /** The page's title, so a section that merely repeats it shows no heading. */
  pageTitle?: string;
}) {
  return (
    <div className="h-msecs">
      {sections.map((section) => (
        <Section section={section} pageTitle={pageTitle} key={String(section.id)} />
      ))}
    </div>
  );
}
