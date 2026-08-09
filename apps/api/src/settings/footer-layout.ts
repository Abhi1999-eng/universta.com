import { BadRequestException } from '@nestjs/common';

/** The Global Footer's row/block document.
 *
 * The footer used to be a fixed set of fields, which meant an admin could
 * change the wording of the three columns but never add a row, a paragraph or
 * a second call to action. This describes a footer the admin composes instead.
 *
 * It is stored as a versioned document inside the existing `footer` settings
 * group rather than in new tables: the footer is read as one blob on every
 * page render, is edited as one document, and has no rows worth querying
 * across. `version` is what lets the shape change later without guessing at
 * what an old record meant.
 *
 * An absent or empty document is meaningful: the public footer keeps its
 * original fixed layout, so every existing site renders exactly as before
 * until someone opens the builder. */

export const FOOTER_LAYOUT_VERSION = 1;

/** Approved row shapes. Admins pick one of these rather than writing grid
 * CSS, which is what keeps a composed footer inside the design system and
 * stacking predictably on small screens. */
export const FOOTER_ROW_LAYOUTS = [
  'one-column',
  'two-equal',
  'one-third-two-thirds',
  'three-columns',
  'four-columns',
  'brand-plus-three',
  'centered',
] as const;
export type FooterRowLayout = (typeof FOOTER_ROW_LAYOUTS)[number];

/** How many drop areas each layout offers. A block whose area index is past
 * the end is placed in the last area rather than disappearing, so narrowing a
 * row's layout never silently loses content. */
export const FOOTER_LAYOUT_AREAS: Record<FooterRowLayout, number> = {
  'one-column': 1,
  'two-equal': 2,
  'one-third-two-thirds': 2,
  'three-columns': 3,
  'four-columns': 4,
  'brand-plus-three': 4,
  centered: 1,
};

export const FOOTER_BLOCK_TYPES = [
  'BRAND',
  'HEADING',
  'TEXT',
  'NAV_LINKS',
  'LINK_LIST',
  'CTA',
  'CONTACT',
  'SOCIAL',
  'IMAGE',
  'LEGAL_LINKS',
  'COPYRIGHT',
  'DIVIDER',
  'DISCLAIMER',
] as const;
export type FooterBlockType = (typeof FOOTER_BLOCK_TYPES)[number];

export type FooterLink = {
  label: string;
  /** Site-relative path or https URL; validated like every other admin URL. */
  url: string;
  newTab?: boolean;
};

export type FooterBlock = {
  id: string;
  type: FooterBlockType;
  /** Which drop area of the row this sits in. */
  area?: number;
  heading?: string;
  text?: string;
  /** NAV_LINKS renders a managed navigation menu; the rest use `links`. */
  menuKey?: string;
  links?: FooterLink[];
  ctaLabel?: string;
  ctaUrl?: string;
  mediaId?: string | null;
  visible?: boolean;
};

export type FooterRow = {
  id: string;
  layout: FooterRowLayout;
  blocks: FooterBlock[];
  visible?: boolean;
};

export type FooterLayout = {
  version: number;
  rows: FooterRow[];
};

const SAFE_URL = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;

function reject(message: string): never {
  throw new BadRequestException({
    code: 'INVALID_FOOTER_LAYOUT',
    message,
    details: null,
  });
}

function assertUrl(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') return;
  if (!SAFE_URL.test(value.trim()))
    reject(`${field} must be a site-relative path or an https:// URL`);
}

function text(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') reject(`${field} must be text`);
  const trimmed = (value as string).trim();
  if (trimmed.length > max) reject(`${field} must be ${max} characters or fewer`);
  return trimmed;
}

/** Validates and normalises a submitted footer document.
 *
 * Everything an admin can type is length-checked and every URL goes through
 * the same open-redirect guard the flat settings use, because these fields end
 * up in links on every page of the public site. Unknown block or layout names
 * are rejected rather than stored and silently skipped at render time. */
export function sanitizeFooterLayout(value: unknown): FooterLayout | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value))
    reject('Footer layout must be an object');

  const input = value as Record<string, unknown>;
  const rawRows = input.rows;
  if (rawRows === undefined) return { version: FOOTER_LAYOUT_VERSION, rows: [] };
  if (!Array.isArray(rawRows)) reject('Footer rows must be a list');
  if (rawRows.length > 12) reject('A footer can have at most 12 rows');

  const rows: FooterRow[] = rawRows.map((rawRow, rowIndex) => {
    if (typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow))
      reject(`Row ${rowIndex + 1} is not valid`);
    const row = rawRow as Record<string, unknown>;
    const layout = row.layout as FooterRowLayout;
    if (!FOOTER_ROW_LAYOUTS.includes(layout))
      reject(`Row ${rowIndex + 1} has an unknown layout`);

    const rawBlocks = row.blocks ?? [];
    if (!Array.isArray(rawBlocks)) reject(`Row ${rowIndex + 1} blocks must be a list`);
    if (rawBlocks.length > 12)
      reject(`Row ${rowIndex + 1} can have at most 12 blocks`);

    const areas = FOOTER_LAYOUT_AREAS[layout];
    const blocks: FooterBlock[] = rawBlocks.map((rawBlock, blockIndex) => {
      if (
        typeof rawBlock !== 'object' ||
        rawBlock === null ||
        Array.isArray(rawBlock)
      )
        reject(`Row ${rowIndex + 1} block ${blockIndex + 1} is not valid`);
      const block = rawBlock as Record<string, unknown>;
      const type = block.type as FooterBlockType;
      if (!FOOTER_BLOCK_TYPES.includes(type))
        reject(`Row ${rowIndex + 1} block ${blockIndex + 1} has an unknown type`);

      const where = `Row ${rowIndex + 1} block ${blockIndex + 1}`;
      assertUrl(block.ctaUrl, `${where} button link`);

      const rawLinks = block.links ?? [];
      if (!Array.isArray(rawLinks)) reject(`${where} links must be a list`);
      if (rawLinks.length > 20) reject(`${where} can have at most 20 links`);
      const links: FooterLink[] = rawLinks.map((rawLink, linkIndex) => {
        if (
          typeof rawLink !== 'object' ||
          rawLink === null ||
          Array.isArray(rawLink)
        )
          reject(`${where} link ${linkIndex + 1} is not valid`);
        const link = rawLink as Record<string, unknown>;
        assertUrl(link.url, `${where} link ${linkIndex + 1}`);
        return {
          label: text(link.label, `${where} link ${linkIndex + 1} label`, 120) ?? '',
          url: typeof link.url === 'string' ? link.url.trim() : '',
          newTab: link.newTab === true,
        };
      });

      // Clamp rather than drop: narrowing a row's layout must not lose a block.
      const rawArea = Number(block.area ?? 0);
      const area = Number.isFinite(rawArea)
        ? Math.min(Math.max(Math.trunc(rawArea), 0), areas - 1)
        : 0;

      return {
        id: text(block.id, `${where} id`, 64) || `block-${rowIndex}-${blockIndex}`,
        type,
        area,
        heading: text(block.heading, `${where} heading`, 200),
        text: text(block.text, `${where} text`, 2000),
        menuKey: text(block.menuKey, `${where} menu`, 100),
        links,
        ctaLabel: text(block.ctaLabel, `${where} button label`, 120),
        ctaUrl:
          typeof block.ctaUrl === 'string' ? block.ctaUrl.trim() : undefined,
        mediaId:
          typeof block.mediaId === 'string' && block.mediaId.trim()
            ? block.mediaId.trim()
            : null,
        visible: block.visible !== false,
      };
    });

    return {
      id: text(row.id, `Row ${rowIndex + 1} id`, 64) || `row-${rowIndex}`,
      layout,
      blocks,
      visible: row.visible !== false,
    };
  });

  return { version: FOOTER_LAYOUT_VERSION, rows };
}
