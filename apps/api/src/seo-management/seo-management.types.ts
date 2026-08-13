export const SEO_BULK_ENTITY_TYPES = [
  'country',
  'city',
  'subject',
  'course',
  'university',
  'offering',
  'scholarship',
  'consultant',
  'consultantLocation',
  'job',
  'event',
  'successStory',
] as const;

export type SeoBulkEntityType = (typeof SEO_BULK_ENTITY_TYPES)[number];

export type SeoVariable = {
  key: string;
  label: string;
};

export type SeoEntityDefinition = {
  key: SeoBulkEntityType;
  label: string;
  variables: SeoVariable[];
};

export const SEO_ENTITY_DEFINITIONS: SeoEntityDefinition[] = [
  {
    key: 'country',
    label: 'Countries',
    variables: [
      { key: 'countryName', label: 'Country name' },
      { key: 'countrySlug', label: 'Country slug' },
    ],
  },
  {
    key: 'city',
    label: 'Cities',
    variables: [
      { key: 'cityName', label: 'City name' },
      { key: 'citySlug', label: 'City slug' },
      { key: 'countryName', label: 'Country name' },
      { key: 'countrySlug', label: 'Country slug' },
    ],
  },
  {
    key: 'subject',
    label: 'Subjects',
    variables: [
      { key: 'subjectName', label: 'Subject name' },
      { key: 'subjectSlug', label: 'Subject slug' },
    ],
  },
  {
    key: 'course',
    label: 'Generic courses',
    variables: [
      { key: 'courseName', label: 'Course name' },
      { key: 'courseSlug', label: 'Course slug' },
      { key: 'subjectName', label: 'Subject name' },
      { key: 'degreeLevel', label: 'Course level' },
    ],
  },
  {
    key: 'university',
    label: 'Universities',
    variables: [
      { key: 'universityName', label: 'University name' },
      { key: 'universitySlug', label: 'University slug' },
      { key: 'countryName', label: 'Country name' },
      { key: 'countrySlug', label: 'Country slug' },
      { key: 'cityName', label: 'Primary campus city' },
    ],
  },
  {
    key: 'offering',
    label: 'University course offerings',
    variables: [
      { key: 'courseName', label: 'Course name' },
      { key: 'offeringSlug', label: 'Offering slug' },
      { key: 'universityName', label: 'University name' },
      { key: 'universitySlug', label: 'University slug' },
      { key: 'countryName', label: 'Country name' },
      { key: 'countrySlug', label: 'Country slug' },
      { key: 'cityName', label: 'Campus city' },
      { key: 'degreeLevel', label: 'Course level' },
    ],
  },
  {
    key: 'scholarship',
    label: 'Scholarships',
    variables: [
      { key: 'scholarshipTitle', label: 'Scholarship title' },
      { key: 'scholarshipSlug', label: 'Scholarship slug' },
      { key: 'providerName', label: 'Provider name' },
      { key: 'countryName', label: 'Country name' },
      { key: 'universityName', label: 'University name' },
    ],
  },
  {
    key: 'consultant',
    label: 'Consultants',
    variables: [
      { key: 'consultantName', label: 'Consultant name' },
      { key: 'consultantSlug', label: 'Consultant slug' },
      { key: 'countryName', label: 'Destination country' },
      { key: 'cityName', label: 'Location city' },
    ],
  },
  {
    key: 'consultantLocation',
    label: 'Consultant locations',
    variables: [
      { key: 'locationName', label: 'Location name' },
      { key: 'consultantLocationSlug', label: 'Location slug' },
      { key: 'cityName', label: 'City name' },
      { key: 'countryName', label: 'Country name' },
    ],
  },
  {
    key: 'job',
    label: 'Jobs',
    variables: [
      { key: 'jobTitle', label: 'Job title' },
      { key: 'jobSlug', label: 'Job slug' },
      { key: 'departmentName', label: 'Department' },
      { key: 'cityName', label: 'City name' },
      { key: 'countryName', label: 'Country name' },
    ],
  },
  {
    key: 'event',
    label: 'Events',
    variables: [
      { key: 'eventTitle', label: 'Event title' },
      { key: 'eventSlug', label: 'Event slug' },
      { key: 'cityName', label: 'City name' },
      { key: 'countryName', label: 'Country name' },
    ],
  },
  {
    key: 'successStory',
    label: 'Success stories',
    variables: [
      { key: 'storyTitle', label: 'Story title' },
      { key: 'successStorySlug', label: 'Story slug' },
      { key: 'universityName', label: 'University name' },
      { key: 'countryName', label: 'Country name' },
      { key: 'courseName', label: 'Course name' },
    ],
  },
];

export const SEO_TEMPLATE_TEXT_FIELDS = [
  'seoTitleTemplate',
  'metaDescriptionTemplate',
  'ogTitleTemplate',
  'ogDescriptionTemplate',
  'canonicalTemplate',
] as const;

export type SeoTemplateInput = {
  seoTitleTemplate?: string | null;
  metaDescriptionTemplate?: string | null;
  ogTitleTemplate?: string | null;
  ogDescriptionTemplate?: string | null;
  canonicalTemplate?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
};

export type SeoManualMetadata = {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogMedia?: {
    publicUrl?: string | null;
    url?: string | null;
    altText?: string | null;
    alt?: string | null;
  } | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterMedia?: {
    publicUrl?: string | null;
    url?: string | null;
    altText?: string | null;
    alt?: string | null;
  } | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
};

export type SeoResolver = {
  resolve(
    entityType: SeoBulkEntityType,
    record: Record<string, unknown>,
    manual: SeoManualMetadata | null | undefined,
    suppliedTemplate?: SeoTemplateInput | null,
  ): Promise<Record<string, unknown>>;
};
