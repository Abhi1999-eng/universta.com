import { resolveContentVariables } from '../../../../packages/content-variables';
import { employmentSchema, remoteRole } from './record-dates';
import { plainText } from './record-text';

/**
 * A role page's schema.org JobPosting.
 *
 * The description keeps the editor's markup, which job search reads, with
 * {jobTitle}, {jobDepartment} and {jobLocation} filled in; an emptied editor
 * falls back to the summary. employmentType is one of
 * schema.org's values however the editor wrote it ("Part time", FULL_TIME,
 * "Full-time"), and is left out when it is none of them. The place is a
 * PostalAddress from the city (or the free-text location), the state and the
 * country code; a remote role is TELECOMMUTE, and names the country it can
 * be worked from where one is set.
 */

type Row = Record<string, unknown>;

const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const relation = (value: unknown) => (value && typeof value === 'object' ? (value as Row) : null);

function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)) as T;
}

export function jobPostingJsonLd(row: Row) {
  const country = relation(row.country);
  const countryName = words(country?.name);
  const address = defined({
    addressLocality: words(relation(row.city)?.name) ?? words(row.location) ?? undefined,
    addressRegion: words(relation(row.state)?.name) ?? undefined,
    addressCountry: words(country?.iso2Code)?.toUpperCase() ?? countryName ?? undefined,
  });
  const remote = remoteRole(row.remoteStatus);
  const description = words(row.description) ? resolveContentVariables('job', String(row.description), row) : null;
  return defined({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: row.title,
    description: (description && plainText(description) ? description : null) ?? plainText(row.summary) ?? words(row.title) ?? undefined,
    datePosted: row.publishedDate ?? row.createdAt,
    validThrough: row.expiryDate ?? undefined,
    employmentType: employmentSchema(row.employmentType),
    hiringOrganization: { '@type': 'Organization', name: 'Universta' },
    jobLocation: Object.keys(address).length ? { '@type': 'Place', address: { '@type': 'PostalAddress', ...address } } : undefined,
    jobLocationType: remote ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: remote && countryName ? { '@type': 'Country', name: countryName } : undefined,
  });
}
