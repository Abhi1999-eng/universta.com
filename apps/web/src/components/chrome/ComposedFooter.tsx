import Link from 'next/link';
import type { SiteChrome } from '@/lib/site-chrome';

/** Renders a footer an admin composed out of rows and blocks.
 *
 * Layout comes from a fixed set of approved row shapes rather than anything
 * the admin can type, which is what keeps a composed footer inside the design
 * system: the classes below own the columns and the stacking, so a footer
 * built in the admin cannot break the page on a phone.
 *
 * Only used when the admin has actually built rows. With no document the
 * original fixed footer renders instead, so nothing changes for a site nobody
 * has edited. */

type FooterLink = { label: string; url: string; newTab?: boolean };
type FooterBlock = {
  id: string;
  type: string;
  area?: number;
  heading?: string;
  text?: string;
  menuKey?: string;
  links?: FooterLink[];
  ctaLabel?: string;
  ctaUrl?: string;
  visible?: boolean;
};
type FooterRow = {
  id: string;
  layout: string;
  blocks: FooterBlock[];
  visible?: boolean;
};
export type FooterLayoutDocument = { version?: number; rows?: FooterRow[] };

const AREAS: Record<string, number> = {
  'one-column': 1,
  'two-equal': 2,
  'one-third-two-thirds': 2,
  'three-columns': 3,
  'four-columns': 4,
  'brand-plus-three': 4,
  centered: 1,
};

function LinkList({ links }: { links: FooterLink[] }) {
  const usable = links.filter((link) => link.label && link.url);
  if (!usable.length) return null;
  return (
    <ul>
      {usable.map((link, index) => (
        <li key={`${link.url}-${index}`}>
          <Link
            href={link.url}
            {...(link.newTab
              ? { target: '_blank', rel: 'noreferrer noopener' }
              : {})}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Block({
  block,
  chrome,
}: {
  block: FooterBlock;
  chrome: SiteChrome;
}) {
  if (block.visible === false) return null;
  const { footer, contact, social, general } = chrome.settings;

  switch (block.type) {
    case 'BRAND':
      return (
        <div className="usta-footer-brand">
          <Link href="/" className="usta-logo">
            {general.siteName ?? 'Universta'}
            <span aria-hidden="true">.</span>
          </Link>
          {block.text ? <p>{block.text}</p> : null}
        </div>
      );
    case 'HEADING':
      return block.heading ? <h2>{block.heading}</h2> : null;
    case 'TEXT':
      return block.text ? <p>{block.text}</p> : null;
    case 'DISCLAIMER':
      return block.text ? <p className="usta-footer-small">{block.text}</p> : null;
    case 'NAV_LINKS': {
      // Reuses the managed navigation menu so footer columns stay in step with
      // the menus edited in Navigation rather than being retyped here.
      const column = chrome.footerMenu.find(
        (entry) => entry.id === block.menuKey || entry.label === block.menuKey,
      );
      if (!column) return null;
      return (
        <nav aria-label={column.label}>
          <h2>{block.heading?.trim() || column.label}</h2>
          <LinkList
            links={(column.children ?? []).map((item) => ({
              label: item.label,
              url: item.href ?? '',
            }))}
          />
        </nav>
      );
    }
    case 'LINK_LIST':
    case 'LEGAL_LINKS':
      return (
        <nav aria-label={block.heading?.trim() || 'Footer links'}>
          {block.heading ? <h2>{block.heading}</h2> : null}
          <LinkList links={block.links ?? []} />
        </nav>
      );
    case 'CTA':
      return block.ctaUrl && block.ctaLabel ? (
        <div>
          {block.heading ? <h2>{block.heading}</h2> : null}
          {block.text ? <p>{block.text}</p> : null}
          <Link href={block.ctaUrl} className="usta-cta">
            {block.ctaLabel}
          </Link>
        </div>
      ) : null;
    case 'CONTACT':
      return (
        <div className="usta-footer-contact">
          {block.heading ? <h2>{block.heading}</h2> : null}
          {contact?.email ? (
            <p>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          ) : null}
          {contact?.counsellingPhone ? (
            <p>
              <a href={`tel:${contact.counsellingPhone}`}>
                {contact.counsellingPhone}
              </a>
            </p>
          ) : null}
          {contact?.address ? <p>{contact.address}</p> : null}
        </div>
      );
    case 'SOCIAL': {
      const links = Object.entries(social ?? {})
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([name, value]) => ({ label: name, url: String(value) }));
      if (!links.length) return null;
      return (
        <nav aria-label="Social links">
          {block.heading ? <h2>{block.heading}</h2> : null}
          <LinkList links={links} />
        </nav>
      );
    }
    case 'COPYRIGHT':
      return <p>{block.text?.trim() || footer.copyrightText || ''}</p>;
    case 'DIVIDER':
      return <hr className="usta-footer-divider" />;
    default:
      return null;
  }
}

export function ComposedFooter({
  layout,
  chrome,
  className,
}: {
  layout: FooterLayoutDocument;
  chrome: SiteChrome;
  className: string;
}) {
  const rows = (layout.rows ?? []).filter((row) => row.visible !== false);
  if (!rows.length) return null;

  return (
    <footer className={className}>
      {rows.map((row) => {
        const areaCount = AREAS[row.layout] ?? 1;
        const areas = Array.from({ length: areaCount }, (_, index) =>
          row.blocks.filter((block) => (block.area ?? 0) === index),
        );
        return (
          <div
            key={row.id}
            className={`usta-footer-row usta-footer-row-${row.layout}`}
          >
            {areas.map((blocks, index) => (
              <div className="usta-footer-area" key={`${row.id}-${index}`}>
                {blocks.map((block) => (
                  <Block key={block.id} block={block} chrome={chrome} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </footer>
  );
}
