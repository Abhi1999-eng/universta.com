import Link from "next/link";
import { ExperimentCta } from "./ExperimentCta";
import { ContactForm } from "./ContactForm";
import type { AnyRecord } from "./PhaseOneViews";
import { phaseList } from "@/lib/phase1";
import { getCountries } from "@/lib/countries";
import { getCourses } from "@/lib/catalog";
import { resolveHref } from "@/lib/internal-links";
import {
  applyPicks,
  directoryQuery,
  type DirectoryItem,
  type DirectorySettings,
} from "./page-section-data";
/* Section media can come from approved external asset hosts, same as elsewhere in this app. */
/* eslint-disable @next/next/no-img-element */

type SectionRow = {
  label?: string;
  value?: string;
  description?: string;
  url?: string;
};
type SectionBody = {
  paragraphs?: string[];
  supportingText?: string;
  caption?: string;
  imagePosition?: "left" | "right";
  items?: SectionRow[];
  limit?: number;
  dataMode?: "automatic" | "manual";
  filters?: { q?: string; country?: string };
  sort?: string;
  picks?: string[];
};

function body(section: AnyRecord): SectionBody {
  const data = section.bodyJson;
  return data && typeof data === "object" ? (data as SectionBody) : {};
}
function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function media(section: AnyRecord) {
  const record = section.media;
  if (!record) return null;
  const url = record.publicUrl || record.url || "";
  if (!url) return null;
  return { url, alt: record.altText || record.title || "" };
}

const DIRECTORY_RESOURCE: Record<string, string> = {
  UNIVERSITY_DIRECTORY: "universities",
  SCHOLARSHIP_DIRECTORY: "scholarships",
  CONSULTANT_DIRECTORY: "consultants",
  TESTIMONIALS: "testimonials",
  SUCCESS_STORIES: "success-stories",
};
const DIRECTORY_HREF_PREFIX: Record<string, string> = {
  UNIVERSITY_DIRECTORY: "/universities",
  SCHOLARSHIP_DIRECTORY: "/scholarships",
  CONSULTANT_DIRECTORY: "/study-abroad-consultants",
};

async function fetchDirectoryItems(
  sectionType: string,
  settings: DirectorySettings,
): Promise<DirectoryItem[]> {
  const take = String(Math.min(Math.max(settings.limit || 6, 1), 12));
  const query = directoryQuery(settings, take);
  try {
    let items: DirectoryItem[] = [];
    if (sectionType === "COUNTRY_DIRECTORY") {
      const result = await getCountries(query);
      items = result.data.map((item) => ({
        slug: item.slug,
        title: item.name,
        description: item.shortDescription ?? "",
        href: `/countries/${item.slug}`,
      }));
    } else if (sectionType === "COURSE_DIRECTORY") {
      const result = await getCourses(query);
      items = result.data.map((item) => ({
        slug: item.slug,
        title: item.name,
        description: item.shortDescription ?? "",
        href: `/courses/${item.slug}`,
      }));
    } else {
      const resource = DIRECTORY_RESOURCE[sectionType];
      if (!resource) return [];
      const result = await phaseList<AnyRecord>(resource, query);
      const prefix = DIRECTORY_HREF_PREFIX[sectionType];
      items = result.data.map((item) => ({
        slug: string(item.slug),
        title: string(item.name) || string(item.title),
        description:
          string(item.shortDescription) ||
          string(item.quote) ||
          string(item.journey) ||
          string(item.summary),
        href: prefix && item.slug ? `${prefix}/${item.slug}` : null,
      }));
    }
    return applyPicks(items, settings).slice(0, Number(take));
  } catch {
    return [];
  }
}

function Paragraphs({ body: b }: { body: SectionBody }) {
  const paragraphs = (b.paragraphs ?? []).filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="editorial-copy">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
      ))}
    </div>
  );
}
function CardGrid({ items }: { items: SectionRow[] }) {
  if (!items.length) return null;
  return (
    <div className="catalog-card-grid">
      {items.map((item, index) => {
        const card = (
          <div className="catalog-card-body">
            <h3>{item.label}</h3>
            {item.description ? <p>{item.description}</p> : null}
          </div>
        );
        return item.url ? (
          <Link className="catalog-card" href={item.url} key={`${item.label}-${index}`}>
            {card}
          </Link>
        ) : (
          <div className="catalog-card" key={`${item.label}-${index}`}>
            {card}
          </div>
        );
      })}
    </div>
  );
}
function FaqGroup({ items }: { items: SectionRow[] }) {
  if (!items.length) return null;
  return (
    <div className="editorial-faq-group">
      {items.map((item, index) => (
        <details key={`${item.label}-${index}`}>
          <summary>{item.label}</summary>
          <p>{item.value}</p>
        </details>
      ))}
    </div>
  );
}
function Stats({ items }: { items: SectionRow[] }) {
  if (!items.length) return null;
  return (
    <div className="editorial-stats">
      {items.map((item, index) => (
        <div className="editorial-stat" key={`${item.label}-${index}`}>
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
async function RelatedLinks({ items }: { items: SectionRow[] }) {
  if (!items.length) return null;
  const resolved = await Promise.all(
    items.map((item) => resolveHref(item.url)),
  );
  const visible = items
    .map((item, index) => ({ item, href: resolved[index] }))
    .filter((row): row is { item: SectionRow; href: string } => Boolean(row.href));
  if (!visible.length) return null;
  return (
    <ul className="editorial-related-links">
      {visible.map(({ item, href }, index) => (
        <li key={`${item.label}-${index}`}>
          <Link href={href}>{item.label} →</Link>
        </li>
      ))}
    </ul>
  );
}
function Directory({ items }: { items: DirectoryItem[] }) {
  if (!items.length) return null;
  return (
    <div className="catalog-card-grid">
      {items.map((item, index) =>
        item.href ? (
          <Link className="catalog-card" href={item.href} key={`${item.title}-${index}`}>
            <div className="catalog-card-body">
              <h3>{item.title}</h3>
              {item.description ? <p>{item.description}</p> : null}
            </div>
          </Link>
        ) : (
          <blockquote className="catalog-card" key={`${item.title}-${index}`}>
            <p>&ldquo;{item.description}&rdquo;</p>
            <cite>{item.title}</cite>
          </blockquote>
        ),
      )}
    </div>
  );
}


/** Admin-configured per-device visibility, stored on the section's
 * configurationJson. Absent configuration means visible everywhere, so
 * sections that pre-date this feature keep rendering unchanged.
 *
 * Hiding is done with `display:none` at the matching breakpoint rather than by
 * omitting the markup, so a single server-rendered HTML payload is correct at
 * every viewport (no hydration mismatch, no per-device caching) and a hidden
 * section leaves no empty spacing behind. */
export function visibilityClass(section: AnyRecord): string {
  const config = section.configurationJson as
    | { visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean } }
    | null
    | undefined;
  const visibility = config?.visibility;
  if (!visibility) return '';
  const classes: string[] = [];
  if (visibility.desktop === false) classes.push('usta-hide-desktop');
  if (visibility.tablet === false) classes.push('usta-hide-tablet');
  if (visibility.mobile === false) classes.push('usta-hide-mobile');
  return classes.length ? ` ${classes.join(' ')}` : '';
}

export async function PageSectionRenderer({ section }: { section: AnyRecord }) {
  const type = section.sectionType || "CUSTOM";
  const b = body(section);
  const heading = string(section.title) || section.heading || section.sectionKey;
  const eyebrow = section.eyebrow ?? "Universta";
  const ctaHref = section.ctaPrimaryUrl
    ? await resolveHref(section.ctaPrimaryUrl)
    : null;
  const cta =
    ctaHref && section.ctaPrimaryLabel ? (
      <ExperimentCta
        className="text-link"
        href={ctaHref}
        experimentKey={section.experimentKey}
      >
        {section.ctaPrimaryLabel} →
      </ExperimentCta>
    ) : null;
  const sectionMedia = media(section);

  let content: React.ReactNode = null;
  if (type === "RICH_TEXT") {
    content = <Paragraphs body={b} />;
  } else if (type === "CTA") {
    content = b.supportingText ? <p>{b.supportingText}</p> : null;
  } else if (type === "IMAGE") {
    content = sectionMedia ? (
      <figure className="editorial-image">
        <img src={sectionMedia.url} alt={sectionMedia.alt || heading || ""} />
        {b.caption ? <figcaption>{b.caption}</figcaption> : null}
      </figure>
    ) : null;
  } else if (type === "IMAGE_TEXT") {
    content = (
      <div className={`editorial-image-text position-${b.imagePosition ?? "left"}`}>
        {sectionMedia ? (
          <img src={sectionMedia.url} alt={sectionMedia.alt || heading || ""} />
        ) : null}
        <div>
          {section.subheading ? <p>{section.subheading}</p> : null}
          {b.caption ? <p className="editorial-caption">{b.caption}</p> : null}
        </div>
      </div>
    );
  } else if (type === "CARD_GRID") {
    content = <CardGrid items={b.items ?? []} />;
  } else if (type === "FAQ_GROUP") {
    content = <FaqGroup items={b.items ?? []} />;
  } else if (type === "STATS") {
    content = <Stats items={b.items ?? []} />;
  } else if (type === "RELATED_LINKS") {
    content = <RelatedLinks items={b.items ?? []} />;
  } else if (type === "LEAD_GENERATION") {
    content = <ContactForm />;
  } else if (
    type === "COUNTRY_DIRECTORY" ||
    type === "UNIVERSITY_DIRECTORY" ||
    type === "COURSE_DIRECTORY" ||
    type === "SCHOLARSHIP_DIRECTORY" ||
    type === "CONSULTANT_DIRECTORY" ||
    type === "TESTIMONIALS" ||
    type === "SUCCESS_STORIES"
  ) {
    const items = await fetchDirectoryItems(type, b);
    content = <Directory items={items} />;
  } else {
    content = section.subheading ? <p>{section.subheading}</p> : null;
  }

  return (
    <article
      className={`editorial-section section-type-${type.toLowerCase()}${visibilityClass(section)}`}
      key={section.id}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2>{heading}</h2>
      {type !== "IMAGE_TEXT" && section.subheading && type !== "CTA" ? (
        <p>{section.subheading}</p>
      ) : null}
      {content}
      {cta}
    </article>
  );
}
