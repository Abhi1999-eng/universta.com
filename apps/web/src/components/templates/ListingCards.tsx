import Link from 'next/link';

/** Result cards for the three polished listing pages.
 *
 * Every value shown is read straight from the published record. There are
 * deliberately no ratings, rankings, review counts, success rates or
 * accreditation claims: the reference mockups show those slots, but the
 * project has no such data and must not invent it. */

type Named = { name?: string | null; slug?: string | null };

function Featured({ on }: { on?: boolean | null }) {
  return on ? <span className="lc-tag is-featured">Featured</span> : null;
}

export type UniversityRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  institutionType?: string | null;
  isFeatured?: boolean | null;
  country?: Named | null;
  campuses?: Array<{ id: string }> | null;
  _count?: { offerings?: number } | null;
};

export function UniversityCard({ row }: { row: UniversityRow }) {
  const offerings = row._count?.offerings ?? 0;
  const campuses = row.campuses?.length ?? 0;
  return (
    <article className="listing-card">
      <div className="lc-top">
        {row.country?.name ? <span className="lc-tag">{row.country.name}</span> : null}
        {row.institutionType ? <span className="lc-tag">{row.institutionType}</span> : null}
        <Featured on={row.isFeatured} />
      </div>
      <h3>
        <Link href={`/universities/${row.slug}`}>{row.name}</Link>
      </h3>
      {row.shortDescription ? <p>{row.shortDescription}</p> : null}
      <div className="lc-facts">
        <span>
          <b>{offerings}</b> published {offerings === 1 ? 'course offering' : 'course offerings'}
        </span>
        {campuses ? (
          <span>
            <b>{campuses}</b> {campuses === 1 ? 'campus' : 'campuses'}
          </span>
        ) : null}
      </div>
      <div className="lc-actions">
        <Link className="btn btn-primary btn-sm" href={`/universities/${row.slug}`}>
          View university
        </Link>
        <Link className="go" href={`/universities/${row.slug}/courses`}>
          View courses →
        </Link>
      </div>
    </article>
  );
}

export type ScholarshipRow = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  eligibility?: string | null;
  benefitType?: string | null;
  amount?: string | number | null;
  currencyCode?: string | null;
  deadline?: string | null;
  isFeatured?: boolean | null;
  provider?: Named | null;
};

function formatDeadline(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function ScholarshipCard({ row }: { row: ScholarshipRow }) {
  // Only the stored deadline is rendered. Whether it has passed is a filter
  // concern (the "Only open deadlines" control), deliberately not derived from
  // the clock during render: that would be impure and could differ between the
  // server-rendered HTML and hydration.
  const deadline = formatDeadline(row.deadline);
  return (
    <article className="listing-card">
      <div className="lc-top">
        {row.provider?.name ? <span className="lc-tag">{row.provider.name}</span> : null}
        {row.benefitType ? <span className="lc-tag">{row.benefitType}</span> : null}
        <Featured on={row.isFeatured} />
      </div>
      <h3>
        <Link href={`/scholarships/${row.slug}`}>{row.title}</Link>
      </h3>
      {row.summary ? <p>{row.summary}</p> : null}
      <div className="lc-facts">
        {row.amount ? (
          <span>
            <b>
              {row.currencyCode ? `${row.currencyCode} ` : ''}
              {row.amount}
            </b>{' '}
            award
          </span>
        ) : null}
        {deadline ? (
          <span>
            <b>{deadline}</b> deadline
          </span>
        ) : null}
      </div>
      {row.eligibility ? (
        <div className="lc-facts">
          <span>Eligibility: {row.eligibility}</span>
        </div>
      ) : null}
      <div className="lc-actions">
        <Link className="btn btn-primary btn-sm" href={`/scholarships/${row.slug}`}>
          View details
        </Link>
      </div>
    </article>
  );
}

export type ConsultantRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  verificationStatus?: string | null;
  isFeatured?: boolean | null;
  locations?: Array<{ location?: (Named & { citySlug?: string | null }) | null }> | null;
  services?: Array<{ id: string; name?: string | null; serviceName?: string | null }> | null;
  languages?: Array<{ id: string; language?: string | null; languageName?: string | null }> | null;
  countries?: Array<{ country?: Named | null }> | null;
};

export function ConsultantCard({ row }: { row: ConsultantRow }) {
  const verified = (row.verificationStatus ?? '').toUpperCase() === 'VERIFIED';
  const locations = (row.locations ?? []).map((entry) => entry.location).filter(Boolean) as Named[];
  const services = (row.services ?? [])
    .map((service) => service.serviceName ?? service.name)
    .filter(Boolean) as string[];
  const languages = (row.languages ?? [])
    .map((language) => language.languageName ?? language.language)
    .filter(Boolean) as string[];
  const destinations = (row.countries ?? [])
    .map((entry) => entry.country?.name)
    .filter(Boolean) as string[];

  return (
    <article className="listing-card">
      <div className="lc-top">
        {/* Reflects the stored verificationStatus only -- not an endorsement. */}
        {verified ? <span className="lc-tag is-verified">Verified</span> : null}
        <Featured on={row.isFeatured} />
      </div>
      <h3>
        <Link href={`/study-abroad-consultants/${row.slug}`}>{row.name}</Link>
      </h3>
      {row.shortDescription ? <p>{row.shortDescription}</p> : null}
      <div className="lc-facts">
        {services.length ? <span>Services: {services.slice(0, 3).join(', ')}</span> : null}
        {languages.length ? <span>Languages: {languages.slice(0, 3).join(', ')}</span> : null}
        {destinations.length ? <span>Destinations: {destinations.slice(0, 3).join(', ')}</span> : null}
      </div>
      <div className="lc-actions">
        <Link className="btn btn-primary btn-sm" href={`/study-abroad-consultants/${row.slug}`}>
          View profile
        </Link>
        {locations.slice(0, 2).map((location) =>
          location.slug ? (
            <Link
              key={location.slug}
              className="go"
              href={`/study-abroad-consultants/locations/${location.slug}`}
            >
              {location.name ?? location.slug} →
            </Link>
          ) : null,
        )}
      </div>
    </article>
  );
}
