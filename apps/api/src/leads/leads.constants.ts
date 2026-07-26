export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CLOSED',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCE_TYPES = [
  'GENERAL',
  'COUNTRY',
  'SUBJECT',
  'SPECIALIZATION',
  'COURSE',
] as const;

export type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[number];

export const PUBLIC_LEAD_SOURCE_TYPES = [
  'general',
  'country',
  'subject',
  'specialization',
  'course',
] as const;

export const LEAD_NOTE_TYPES = ['GENERAL', 'FOLLOW_UP'] as const;

export const LEAD_DEFAULT_PAGE = 1;
export const LEAD_DEFAULT_LIMIT = 20;
export const LEAD_MAX_LIMIT = 100;
export const LEAD_DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_LEAD_BODY_LIMIT_BYTES = 16 * 1024;
