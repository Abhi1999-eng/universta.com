import Link from 'next/link';
import { FlagMark } from './FlagMark';
import { universityHref } from '@/lib/university-links';
import { universityInitials } from '@/lib/university-initials';
import {
  institutionTypeLabel,
  type UniversityListRow,
} from '@/lib/university-list';

/**
 * One university, in the approved build's card.
 *
 * The same card on the worldwide directory, a destination's own list and
 * the country guide, so an institution looks the same wherever it is met.
 * Those places know different amounts about it -- the guide is handed a
 * name, a type and a rank -- so every part past the name stands down when
 * the record does not hold it, rather than printing a dash or a guess.
 *
 * Three parts of the reference card are not here. Its "profile fit" badge
 * is scored against a student profile this product does not collect, and
 * its tuition, annual-cost and language figures are recorded per course
 * here, not per institution, so a number in those slots would be invented.
 * Its "Popular for" row is kept, but named for what the catalogue can
 * actually say: the subjects with the most published programmes.
 */
export type UniversityCardData = Pick<UniversityListRow, 'id' | 'name' | 'slug'> &
  Partial<Omit<UniversityListRow, 'id' | 'name' | 'slug'>>;

/** How many subjects the card names. */
const SUBJECTS_SHOWN = 3;

export function compareUniversityHref(slug: string) {
  return `/compare/universities?items=${encodeURIComponent(slug)}`;
}

export function UniversityCard({
  university,
  guide = false,
}: {
  university: UniversityCardData;
  /** Add a button to the university's country guide -- worth it on the
   * worldwide directory, where the cards cross many countries, and noise on
   * a list that is one country's already. */
  guide?: boolean;
}) {
  const href = universityHref(university.slug);
  const type = institutionTypeLabel(university.institutionType);
  const where = university.country
    ? university.city
      ? `${university.city}, ${university.country.name}`
      : university.country.name
    : university.city ?? null;

  const stats = [
    typeof university.programmes === 'number'
      ? { label: 'Programmes', value: university.programmes.toLocaleString('en-GB') }
      : null,
    /* Only when a campus is on record: "1" for a university with none would
       be a figure nobody gave us. */
    university.campuses
      ? { label: 'Campuses', value: university.campuses.toLocaleString('en-GB') }
      : null,
    university.totalStudents
      ? { label: 'Students', value: university.totalStudents.toLocaleString('en-GB') }
      : null,
    university.internationalStudentsPercent
      ? { label: 'International', value: `${university.internationalStudentsPercent}%` }
      : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  const subjects = (university.subjects ?? []).slice(0, SUBJECTS_SHOWN);

  return (
    <article className="unicard">
      <div className="unicard__head">
        <span className="unimark" aria-hidden="true">
          {universityInitials(university.name)}
        </span>
        <div className="unicard__id">
          <h3 className="unicard__name">
            <Link href={href}>{university.name}</Link>
          </h3>
          {where ? (
            <p className="unicard__where">
              {university.country ? (
                <FlagMark iso2Code={university.country.iso2Code} bands={null} />
              ) : null}
              <span>{where}</span>
            </p>
          ) : null}
          {type ? <p className="unicard__type">{type}</p> : null}
        </div>
      </div>

      {stats.length ? (
        <dl className="unicard__stats">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {university.shortDescription ? (
        <p className="unicard__desc">{university.shortDescription}</p>
      ) : null}

      {subjects.length ? (
        <div className="unicard__fields">
          <span className="label">Most programmes in</span>
          <div className="pillrow">
            {subjects.map((subject) => (
              <span className="pill pill--sm" key={subject.slug}>
                {subject.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="unicard__foot">
        <Link className="btn btn--sm" href={href}>
          View university{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
        {guide && university.country ? (
          <Link
            className="btn btn--sm btn--ghost btn--wrap"
            href={`/study-abroad/${university.country.slug}`}
          >
            {university.country.name} guide
          </Link>
        ) : null}
        <Link
          className="iconbtn"
          href={compareUniversityHref(university.slug)}
          aria-label={`Compare ${university.name}`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
          </svg>
          <span>Compare</span>
        </Link>
        {university.qsRanking ? (
          <span className="unicard__rank" title="QS World University Rankings">
            Ranked #{university.qsRanking} · one factor among many
          </span>
        ) : null}
      </div>
    </article>
  );
}
