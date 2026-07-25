export const COUNTRY_SECTION_KEYS = [
  'hero',
  'why-study',
  'cost-of-study',
  'work-opportunities',
  'language-requirements',
  'intakes',
  'life-and-culture',
  'application-steps',
  'faqs',
  'consultant-cta',
  'trust-disclaimer',
] as const;

export const COUNTRY_SECTION_TYPES = [
  'RICH_TEXT',
  'FACT_GRID',
  'CARD_GRID',
  'STEPS',
  'CTA',
  'MEDIA',
] as const;

export const EDITORIAL_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'PUBLISHED',
] as const;
export const SEO_OWNER_TYPE = 'COUNTRY';

export type CountrySectionKey = (typeof COUNTRY_SECTION_KEYS)[number];
export type CountrySectionType = (typeof COUNTRY_SECTION_TYPES)[number];
