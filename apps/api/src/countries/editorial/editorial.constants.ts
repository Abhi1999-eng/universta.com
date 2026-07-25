export const COUNTRY_SECTION_KEYS = [
  'hero',
  'why-study',
  'universities',
  'subjects',
  'documents',
  'cost-of-study',
  'scholarships',
  'visa-process',
  'work-opportunities',
  'language-requirements',
  'intakes',
  'events',
  'cities',
  'life-and-culture',
  'living-costs',
  'careers',
  'application-steps',
  'guides',
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
