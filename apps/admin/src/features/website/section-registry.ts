/** One description of every section an admin can put on a page.
 *
 * This is the single source of truth for the builder: the Add Section library,
 * the settings shown for a selected section, and the defaults a new section
 * starts with are all derived from here, so adding a section type is one entry
 * rather than an edit in several switch statements.
 *
 * **Only types the public site genuinely renders belong here.** The public
 * renderer (apps/web/src/components/phase1/PageSectionRenderer.tsx) falls back
 * to printing the subheading alone for anything it does not recognise, so
 * offering an unrecognised type would let an admin build a section that
 * silently renders as a bare line of text. `HERO` and `CUSTOM` used to be
 * offered in the editor for exactly that reason and are deliberately absent --
 * see PUBLIC_ONLY_TYPES below for the ones that exist in data but are not
 * offered for new sections. */

export type SectionCategory =
  | 'popular'
  | 'discovery'
  | 'social-proof'
  | 'content';

/** The repeating-row shape a section edits, when it has one. Mirrors the
 * `items` array the public renderer reads out of `bodyJson`. */
export type RowSpec = {
  legend: string;
  primary: string;
  secondary?: string;
  hasUrl?: boolean;
};

export type SectionDefinition = {
  type: string;
  /** What the admin sees. Never the raw type name. */
  label: string;
  /** One line explaining what it puts on the page, in plain language. */
  description: string;
  category: SectionCategory;
  /** Free-text paragraphs, as the renderer's `paragraphs` array. */
  supportsParagraphs?: boolean;
  /** A single supporting line under the heading. */
  supportsSupportingText?: boolean;
  supportsMedia?: boolean;
  supportsCta?: boolean;
  /** Reads live records from the catalogue at render time. */
  supportsData?: boolean;
  /** Repeating rows the admin fills in by hand. */
  rows?: RowSpec;
  /** Approved layout choices, when the renderer honours more than one. */
  variants?: { value: string; label: string }[];
  /** What a freshly added section starts with, so it is never empty. */
  defaults?: { heading?: string; subheading?: string; limit?: number };
};

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: 'RICH_TEXT',
    label: 'Text',
    description: 'A heading and one or more paragraphs.',
    category: 'popular',
    supportsParagraphs: true,
    defaults: { heading: 'About us' },
  },
  {
    type: 'CTA',
    label: 'Call to action',
    description: 'A short prompt with a button.',
    category: 'popular',
    supportsSupportingText: true,
    supportsCta: true,
    defaults: { heading: 'Talk to a counsellor' },
  },
  {
    type: 'IMAGE_TEXT',
    label: 'Image and text',
    description: 'An image beside a short piece of writing.',
    category: 'popular',
    supportsMedia: true,
    supportsSupportingText: true,
    variants: [
      { value: 'left', label: 'Image on the left' },
      { value: 'right', label: 'Image on the right' },
    ],
    defaults: { heading: 'Why students choose us' },
  },
  {
    type: 'IMAGE',
    label: 'Image',
    description: 'A single picture with an optional caption.',
    category: 'content',
    supportsMedia: true,
    defaults: { heading: '' },
  },
  {
    type: 'STATS',
    label: 'Statistics',
    description: 'A row of numbers, each with a label.',
    category: 'popular',
    rows: {
      legend: 'Statistics',
      primary: 'Label (e.g. Partner universities)',
      secondary: 'Value (e.g. 120+)',
    },
    defaults: { heading: 'Universta in numbers' },
  },
  {
    type: 'FAQ_GROUP',
    label: 'Questions and answers',
    description: 'An expandable list of common questions.',
    category: 'popular',
    rows: { legend: 'Questions', primary: 'Question', secondary: 'Answer' },
    defaults: { heading: 'Frequently asked questions' },
  },
  {
    type: 'CARD_GRID',
    label: 'Cards',
    description: 'A grid of cards you write yourself, each able to link out.',
    category: 'content',
    rows: {
      legend: 'Cards',
      primary: 'Title',
      secondary: 'Description',
      hasUrl: true,
    },
    defaults: { heading: 'How it works' },
  },
  {
    type: 'RELATED_LINKS',
    label: 'Link list',
    description: 'A simple list of links to other pages.',
    category: 'content',
    rows: { legend: 'Links', primary: 'Link label', hasUrl: true },
    defaults: { heading: 'Read next' },
  },
  {
    type: 'LEAD_GENERATION',
    label: 'Enquiry form',
    description: 'The counselling enquiry form.',
    category: 'content',
    defaults: { heading: 'Book free counselling' },
  },
  // Discovery sections read published records live, so the admin chooses how
  // many to show rather than typing the content.
  {
    type: 'COUNTRY_DIRECTORY',
    label: 'Countries',
    description: 'Shows published study destinations from your catalogue.',
    category: 'discovery',
    supportsData: true,
    defaults: { heading: 'Popular destinations', limit: 6 },
  },
  {
    type: 'UNIVERSITY_DIRECTORY',
    label: 'Universities',
    description: 'Shows published universities from your catalogue.',
    category: 'discovery',
    supportsData: true,
    defaults: { heading: 'Featured universities', limit: 6 },
  },
  {
    type: 'COURSE_DIRECTORY',
    label: 'Courses',
    description: 'Shows published courses from your catalogue.',
    category: 'discovery',
    supportsData: true,
    defaults: { heading: 'Explore courses', limit: 6 },
  },
  {
    type: 'SCHOLARSHIP_DIRECTORY',
    label: 'Scholarships',
    description: 'Shows published scholarships from your catalogue.',
    category: 'discovery',
    supportsData: true,
    defaults: { heading: 'Scholarships', limit: 6 },
  },
  {
    type: 'CONSULTANT_DIRECTORY',
    label: 'Consultants',
    description: 'Shows published consultants from your catalogue.',
    category: 'discovery',
    supportsData: true,
    defaults: { heading: 'Talk to a consultant', limit: 6 },
  },
  {
    type: 'TESTIMONIALS',
    label: 'Testimonials',
    description: 'Shows published student testimonials.',
    category: 'social-proof',
    supportsData: true,
    defaults: { heading: 'What students say', limit: 6 },
  },
  {
    type: 'SUCCESS_STORIES',
    label: 'Success stories',
    description: 'Shows published student success stories.',
    category: 'social-proof',
    supportsData: true,
    defaults: { heading: 'Success stories', limit: 6 },
  },
];

/** Types that exist on pages already but are not offered when adding a new
 * section. They still need a definition so an existing section opens with the
 * right controls instead of an empty panel. `HERO` and `CUSTOM` render as a
 * heading and a line of text today; until the public site gives them a real
 * treatment, offering them would promise a layout that does not exist. */
export const LEGACY_SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: 'HERO',
    label: 'Hero (basic)',
    description:
      'Renders as a heading with supporting text. A richer hero layout is not built yet.',
    category: 'content',
    supportsSupportingText: true,
    supportsCta: true,
    supportsMedia: true,
  },
  {
    type: 'CUSTOM',
    label: 'Custom',
    description: 'Renders as a heading with supporting text.',
    category: 'content',
    supportsSupportingText: true,
  },
];

const BY_TYPE = new Map(
  [...SECTION_DEFINITIONS, ...LEGACY_SECTION_DEFINITIONS].map((definition) => [
    definition.type,
    definition,
  ]),
);

/** The definition for a stored section. Unknown types fall back to a
 * text-only definition so an older or hand-seeded section still opens with
 * usable controls rather than a blank panel. */
export function sectionDefinition(type: string): SectionDefinition {
  return (
    BY_TYPE.get(type) ?? {
      type,
      label: type,
      description: 'Renders as a heading with supporting text.',
      category: 'content',
      supportsSupportingText: true,
    }
  );
}

export function sectionLabel(type: string): string {
  return sectionDefinition(type).label;
}

export const SECTION_CATEGORY_LABELS: Record<SectionCategory, string> = {
  popular: 'Popular',
  discovery: 'From your catalogue',
  'social-proof': 'Social proof',
  content: 'Content',
};

/** Add Section library contents, grouped for display. */
export function sectionLibrary(): {
  category: SectionCategory;
  label: string;
  items: SectionDefinition[];
}[] {
  const order: SectionCategory[] = [
    'popular',
    'discovery',
    'social-proof',
    'content',
  ];
  return order
    .map((category) => ({
      category,
      label: SECTION_CATEGORY_LABELS[category],
      items: SECTION_DEFINITIONS.filter((d) => d.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

/** Every type the editor may offer for a new section. */
export const ADDABLE_SECTION_TYPES = SECTION_DEFINITIONS.map((d) => d.type);
