/** What an admin can put in the footer, described once.
 *
 * The counterpart to the page section registry: the block library, the
 * settings shown for a selected block, and the defaults a new block starts
 * with all come from here. Everything listed has a real renderer in
 * apps/web/src/components/chrome/ComposedFooter.tsx -- a block with no
 * renderer would save happily and then show nothing on the live site. */

export type FooterBlockType =
  | 'BRAND'
  | 'HEADING'
  | 'TEXT'
  | 'NAV_LINKS'
  | 'LINK_LIST'
  | 'CTA'
  | 'CONTACT'
  | 'SOCIAL'
  | 'LEGAL_LINKS'
  | 'COPYRIGHT'
  | 'DIVIDER'
  | 'DISCLAIMER';

export type FooterLink = { label: string; url: string; newTab?: boolean };

export type FooterBlock = {
  id: string;
  type: FooterBlockType;
  area?: number;
  heading?: string;
  text?: string;
  menuKey?: string;
  links?: FooterLink[];
  ctaLabel?: string;
  ctaUrl?: string;
  visible?: boolean;
};

export type FooterRowLayout =
  | 'one-column'
  | 'two-equal'
  | 'one-third-two-thirds'
  | 'three-columns'
  | 'four-columns'
  | 'brand-plus-three'
  | 'centered';

export type FooterRow = {
  id: string;
  layout: FooterRowLayout;
  blocks: FooterBlock[];
  visible?: boolean;
};

export type FooterLayout = { version: number; rows: FooterRow[] };

export const FOOTER_LAYOUT_VERSION = 1;

/** Row shapes, described by what they look like rather than by their grid. */
export const ROW_LAYOUTS: {
  value: FooterRowLayout;
  label: string;
  areas: number;
}[] = [
  { value: 'one-column', label: 'One full-width column', areas: 1 },
  { value: 'two-equal', label: 'Two equal columns', areas: 2 },
  { value: 'one-third-two-thirds', label: 'Narrow left, wide right', areas: 2 },
  { value: 'three-columns', label: 'Three columns', areas: 3 },
  { value: 'four-columns', label: 'Four columns', areas: 4 },
  { value: 'brand-plus-three', label: 'Brand plus three columns', areas: 4 },
  { value: 'centered', label: 'Centered', areas: 1 },
];

export function layoutAreas(layout: FooterRowLayout): number {
  return ROW_LAYOUTS.find((entry) => entry.value === layout)?.areas ?? 1;
}

export type FooterBlockDefinition = {
  type: FooterBlockType;
  label: string;
  description: string;
  supportsHeading?: boolean;
  supportsText?: boolean;
  supportsLinks?: boolean;
  supportsCta?: boolean;
  supportsMenu?: boolean;
};

export const FOOTER_BLOCKS: FooterBlockDefinition[] = [
  {
    type: 'BRAND',
    label: 'Logo and blurb',
    description: 'Your site name with a short line underneath.',
    supportsText: true,
  },
  {
    type: 'HEADING',
    label: 'Heading',
    description: 'A short title above other blocks.',
    supportsHeading: true,
  },
  {
    type: 'TEXT',
    label: 'Paragraph',
    description: 'A paragraph of your own writing.',
    supportsText: true,
  },
  {
    type: 'NAV_LINKS',
    label: 'Menu column',
    description: 'A column of links from one of your navigation menus.',
    supportsHeading: true,
    supportsMenu: true,
  },
  {
    type: 'LINK_LIST',
    label: 'Custom links',
    description: 'A list of links you write yourself.',
    supportsHeading: true,
    supportsLinks: true,
  },
  {
    type: 'CTA',
    label: 'Button',
    description: 'A prompt with a button.',
    supportsHeading: true,
    supportsText: true,
    supportsCta: true,
  },
  {
    type: 'CONTACT',
    label: 'Contact details',
    description: 'Email, phone and address from your contact settings.',
    supportsHeading: true,
  },
  {
    type: 'SOCIAL',
    label: 'Social links',
    description: 'Links to the social accounts in your settings.',
    supportsHeading: true,
  },
  {
    type: 'LEGAL_LINKS',
    label: 'Legal links',
    description: 'Privacy, terms and similar links.',
    supportsHeading: true,
    supportsLinks: true,
  },
  {
    type: 'COPYRIGHT',
    label: 'Copyright line',
    description: 'Your copyright notice.',
    supportsText: true,
  },
  {
    type: 'DISCLAIMER',
    label: 'Small print',
    description: 'A smaller, quieter line of text.',
    supportsText: true,
  },
  {
    type: 'DIVIDER',
    label: 'Divider',
    description: 'A thin line between rows.',
  },
];

const BY_TYPE = new Map(FOOTER_BLOCKS.map((entry) => [entry.type, entry]));

export function footerBlockDefinition(
  type: FooterBlockType,
): FooterBlockDefinition {
  return (
    BY_TYPE.get(type) ?? {
      type,
      label: type,
      description: '',
      supportsText: true,
    }
  );
}

export function footerBlockLabel(type: FooterBlockType): string {
  return footerBlockDefinition(type).label;
}

let counter = 0;
/** Ids only need to be unique inside one document; they are not database keys. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function newBlock(type: FooterBlockType, area = 0): FooterBlock {
  const definition = footerBlockDefinition(type);
  return {
    id: newId('block'),
    type,
    area,
    visible: true,
    ...(definition.supportsHeading ? { heading: '' } : {}),
    ...(definition.supportsText ? { text: '' } : {}),
    ...(definition.supportsLinks ? { links: [] } : {}),
    ...(definition.supportsCta ? { ctaLabel: '', ctaUrl: '' } : {}),
  };
}

export function newRow(layout: FooterRowLayout = 'three-columns'): FooterRow {
  return { id: newId('row'), layout, blocks: [], visible: true };
}

/** Moves blocks that sat in a column the new layout no longer has into the
 * last remaining column, mirroring what the API does on save so the editor
 * never shows a block the server would silently relocate. */
export function reflowRow(row: FooterRow, layout: FooterRowLayout): FooterRow {
  const max = layoutAreas(layout) - 1;
  return {
    ...row,
    layout,
    blocks: row.blocks.map((block) => ({
      ...block,
      area: Math.min(block.area ?? 0, max),
    })),
  };
}
