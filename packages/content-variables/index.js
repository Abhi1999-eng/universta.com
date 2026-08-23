/**
 * The only variable tokens that public content may resolve. Keep this module
 * dependency-free so Admin suggestions and public rendering use one registry.
 */
const contexts = {
  country: [
    ['countryName', 'Country name'],
    ['countrySlug', 'Country slug'],
  ],
  university: [
    ['universityName', 'University name'],
    ['universitySlug', 'University slug'],
    ['countryName', 'Country name'],
    ['countrySlug', 'Country slug'],
  ],
  offering: [
    ['offeringName', 'Offering name'],
    ['offeringSlug', 'Offering slug'],
    ['courseName', 'Course name'],
    ['courseSlug', 'Course slug'],
    ['universityName', 'University name'],
    ['universitySlug', 'University slug'],
    ['countryName', 'Country name'],
    ['countrySlug', 'Country slug'],
  ],
  course: [
    ['courseName', 'Course name'],
    ['courseSlug', 'Course slug'],
    ['subjectName', 'Subject name'],
    ['subjectSlug', 'Subject slug'],
  ],
  scholarship: [
    ['scholarshipTitle', 'Scholarship title'],
    ['scholarshipSlug', 'Scholarship slug'],
    ['providerName', 'Provider name'],
  ],
  consultant: [
    ['consultantName', 'Consultant name'],
    ['consultantSlug', 'Consultant slug'],
    ['verificationStatus', 'Verification status'],
  ],
  job: [
    ['jobTitle', 'Job title'],
    ['jobSlug', 'Job slug'],
    ['jobLocation', 'Job location'],
    ['jobDepartment', 'Job department'],
  ],
  event: [
    ['eventTitle', 'Event title'],
    ['eventSlug', 'Event slug'],
    ['eventVenue', 'Event venue'],
    ['eventDate', 'Event start date'],
  ],
  successStory: [
    ['storyTitle', 'Story title'],
    ['storySlug', 'Story slug'],
    ['studentAttribution', 'Student attribution'],
    ['countryName', 'Country name'],
    ['universityName', 'University name'],
    ['offeringName', 'University course offering name'],
    ['courseName', 'Course name'],
  ],
};

export const CONTENT_VARIABLE_CONTEXTS = Object.freeze(
  Object.fromEntries(
    Object.entries(contexts).map(([context, variables]) => [
      context,
      Object.freeze(variables.map(([key, label]) => Object.freeze({ key, label }))),
    ]),
  ),
);

export function variablesForContentContext(context) {
  return CONTENT_VARIABLE_CONTEXTS[context] ?? [];
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function date(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.valueOf())
    ? parsed.toISOString().slice(0, 10)
    : '';
}

function valuesForContext(context, source) {
  const row = source && typeof source === 'object' ? source : {};
  const country = row.country && typeof row.country === 'object' ? row.country : {};
  const university = row.university && typeof row.university === 'object' ? row.university : {};
  const genericCourse = row.genericCourse && typeof row.genericCourse === 'object' ? row.genericCourse : {};
  const subject = row.subject && typeof row.subject === 'object' ? row.subject : genericCourse.subject && typeof genericCourse.subject === 'object' ? genericCourse.subject : {};
  const provider = row.provider && typeof row.provider === 'object' ? row.provider : {};
  const offering = row.offering && typeof row.offering === 'object' ? row.offering : {};

  switch (context) {
    case 'country':
      return { countryName: text(row.name), countrySlug: text(row.slug) };
    case 'university':
      return { universityName: text(row.name), universitySlug: text(row.slug), countryName: text(country.name), countrySlug: text(country.slug) };
    case 'offering':
      return { offeringName: text(row.name), offeringSlug: text(row.slug), courseName: text(genericCourse.name), courseSlug: text(genericCourse.slug), universityName: text(university.name), universitySlug: text(university.slug), countryName: text(university.country?.name), countrySlug: text(university.country?.slug) };
    case 'course':
      return { courseName: text(row.name), courseSlug: text(row.slug), subjectName: text(subject.name), subjectSlug: text(subject.slug) };
    case 'scholarship':
      return { scholarshipTitle: text(row.title), scholarshipSlug: text(row.slug), providerName: text(provider.name) };
    case 'consultant':
      return { consultantName: text(row.name), consultantSlug: text(row.slug), verificationStatus: text(row.verificationStatus) };
    case 'job':
      return { jobTitle: text(row.title), jobSlug: text(row.slug), jobLocation: text(row.location), jobDepartment: text(row.department) };
    case 'event':
      return { eventTitle: text(row.title), eventSlug: text(row.slug), eventVenue: text(row.venue), eventDate: date(row.startsAt) };
    case 'successStory':
      return { storyTitle: text(row.title), storySlug: text(row.slug), studentAttribution: text(row.attribution), countryName: text(country.name), universityName: text(university.name), offeringName: text(offering.name), courseName: text(offering.genericCourse?.name) };
    default:
      return {};
  }
}

/**
 * Resolves only known variables. Unknown tokens stay literal for forward and
 * backward compatibility; known tokens with no runtime value render empty.
 */
export function resolveContentVariables(context, value, source) {
  if (typeof value !== 'string' || !CONTENT_VARIABLE_CONTEXTS[context]) return value;
  const values = valuesForContext(context, source);
  const allowed = new Set(CONTENT_VARIABLE_CONTEXTS[context].map((variable) => variable.key));
  return value.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (token, key) =>
    allowed.has(key) ? values[key] ?? '' : token,
  );
}
