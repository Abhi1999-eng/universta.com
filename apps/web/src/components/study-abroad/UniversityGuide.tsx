import Link from 'next/link';
import type { Course } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { CourseCards } from './CourseCards';
import { FlagMark } from './FlagMark';
import { SectionHead } from './SectionHead';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';

export type UniversityOffering = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  qualificationName: string | null;
  subject: { name: string; slug: string } | null;
  specialization: { name: string; slug: string } | null;
  courseLevel: { code: string | null; name: string } | null;
  duration: { min: string | null; max: string | null; unit: string | null };
};

export type UniversityRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  overview: string | null;
  institutionType: string | null;
  qsRanking: number | null;
  /* Somebody else's figures, which is why they travel with who published
     them and when. The page says that out loud rather than presenting a
     count of students as a fact of its own. */
  totalStudents: number | null;
  internationalStudentsPercent: string | number | null;
  studentFacultyRatio: string | number | null;
  establishedYear: number | null;
  campusSetting: string | null;
  websiteUrl: string | null;
  admissionsEmail: string | null;
  phone: string | null;
  statsSourceName: string | null;
  statsSourceUrl: string | null;
  statsYear: number | null;
  sourceReference: string | null;
  verifiedAt: string | null;
  campuses: number;
  country: {
    name: string;
    slug: string;
    iso2Code: string | null;
    officialLanguage: string | null;
    currencyCode: string | null;
    currencySymbol: string | null;
    intakeMonths: number[];
    postStudyWorkPermitMonths: number | null;
  } | null;
  offerings: UniversityOffering[];
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function initials(name: string) {
  const letters = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  return letters.slice(0, 3).join('') || name.slice(0, 2).toUpperCase();
}

function typeLabel(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

/** An offering is named for the catalogue it sits in -- "Master of Data
 * Science at Elmswood Polytechnic University" -- which is the right name in
 * a search result and a redundant one on Elmswood's own page, where it
 * stutters down a column of nine cards. The institution's name comes off
 * here, and only here. */
export function programmeName(name: string, university: string): string {
  const suffix = ` at ${university}`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/** An offering wearing enough of a course's shape for the shared card. */
function asCourse(offering: UniversityOffering, university: string): Course {
  return {
    id: offering.id,
    name: programmeName(offering.name, university),
    slug: offering.slug,
    shortName: offering.qualificationName,
    subject: offering.subject ?? { name: 'Programme', slug: '' },
    subSubject: offering.specialization,
    courseLevel: offering.courseLevel,
    duration: offering.duration,
  } as unknown as Course;
}

/**
 * A university's guide, at /universities/<slug>.
 *
 * The approved build's template carries twelve sections. Most of them read a
 * record this catalogue does not keep per institution: admission thresholds,
 * a fee table, scholarships, campus life and graduate outcomes are all
 * recorded against a programme or a destination here, not against the
 * university, and its profile-fit panel is scored against a student profile
 * this product does not collect. Those sections are left in the reference
 * rather than filled with figures nobody has verified.
 *
 * What is left is what the catalogue actually holds about an institution:
 * who it is, where it is, what it teaches, and where each of those
 * programmes goes. Sections stand down rather than render empty, and the
 * numbered run is built from the ones that render, so the numbering never
 * skips.
 */
export function UniversityGuide({
  university,
  scholarships = [],
}: {
  university: UniversityRecord;
  /** Awards the catalogue records against this institution. Read on the
   *  page rather than carried on the record, because a failure to reach the
   *  funding list should cost a section, not the university. */
  scholarships?: ScholarshipCard[];
}) {
  const { country, offerings } = university;
  const overview = university.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  const type = typeLabel(university.institutionType);

  const order: string[] = ['snapshot'];
  if (hasOverview) order.push('about');
  if (offerings.length) order.push('programmes');
  if (scholarships.length) order.push('funding');
  const hasContact = Boolean(
    university.websiteUrl || university.admissionsEmail || university.phone,
  );
  if (hasContact) order.push('contact');
  if (country) order.push('destination');
  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    `sec ${order.indexOf(id) % 2 === 0 ? 'sec--white' : 'sec--paper'}`;

  /* Only the cells this record can fill. A snapshot with "—" in half of it
     says less than a shorter one that is entirely true. */
  const snapshot: Array<{ label: string; value: string }> = [];
  if (country) snapshot.push({ label: 'Destination', value: country.name });
  if (type) snapshot.push({ label: 'Type', value: type });
  snapshot.push({
    label: 'Programmes',
    value: String(offerings.length),
  });
  if (university.campuses)
    snapshot.push({ label: 'Campuses', value: String(university.campuses) });
  if (country?.officialLanguage)
    snapshot.push({ label: 'Language', value: country.officialLanguage });
  if (country?.currencyCode)
    snapshot.push({
      label: 'Currency',
      value: [country.currencyCode, country.currencySymbol]
        .filter(Boolean)
        .join(' '),
    });
  if (country?.intakeMonths?.length)
    snapshot.push({
      label: country.intakeMonths.length === 1 ? 'Intake' : 'Intakes',
      value: [...country.intakeMonths]
        .sort((a, b) => a - b)
        .map((month) => MONTHS[month - 1] ?? String(month))
        .join(' · '),
    });
  if (country?.postStudyWorkPermitMonths)
    snapshot.push({
      label: 'Post-study work',
      value: `${country.postStudyWorkPermitMonths} months`,
    });
  if (university.qsRanking)
    snapshot.push({ label: 'QS ranking', value: `#${university.qsRanking}` });

  /* The figures a student compares institutions on. Each is added only when
     the record holds it, for the same reason as every cell above: a
     snapshot half full of dashes says less than a short one that is true. */
  const figure = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? null : Number(value);
  const students = figure(university.totalStudents);
  const international = figure(university.internationalStudentsPercent);
  const ratio = figure(university.studentFacultyRatio);
  if (students)
    snapshot.push({
      label: 'Students',
      value: students.toLocaleString('en-GB'),
    });
  if (international)
    snapshot.push({ label: 'International', value: `${international}%` });
  if (ratio)
    snapshot.push({ label: 'Students per staff', value: String(ratio) });
  if (university.establishedYear)
    snapshot.push({
      label: 'Founded',
      value: String(university.establishedYear),
    });
  if (university.campusSetting)
    snapshot.push({
      label: 'Setting',
      value:
        university.campusSetting[0] +
        university.campusSetting.slice(1).toLowerCase(),
    });

  /* Who counted, and when. Without this the numbers above would read as the
     catalogue's own, which they are not. */
  const figuresShown = Boolean(
    students || international || ratio || university.establishedYear,
  );
  const figureSource =
    figuresShown && (university.statsSourceName || university.statsYear)
      ? [university.statsSourceName, university.statsYear]
          .filter(Boolean)
          .join(', ')
      : null;

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/universities">Universities</Link>
            {country ? (
              <>
                <span className="crumbs__sep" aria-hidden="true">
                  /
                </span>
                <Link href={`/study-abroad/${country.slug}`}>
                  {country.name}
                </Link>
              </>
            ) : null}
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{university.name}</span>
          </nav>

          <div className="unihero">
            <div className="unihero__main">
              <div className="unihero__id">
                <span className="unimark unimark--lg" aria-hidden="true">
                  {initials(university.name)}
                </span>
                <div>
                  {type ? <p className="hero__eyebrow">{type}</p> : null}
                  <h1 className="unihero__name">{university.name}</h1>
                  {country ? (
                    <p className="unihero__where">
                      <FlagMark iso2Code={country.iso2Code} bands={null} />
                      {country.name}
                    </p>
                  ) : null}
                </div>
              </div>

              {university.shortDescription ? (
                <p className="unihero__desc">{university.shortDescription}</p>
              ) : null}

              <div className="btn-row">
                {offerings.length ? (
                  <Link className="btn btn--lg" href="#programmes">
                    See its programmes{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                ) : null}
                {country ? (
                  <Link
                    className="btn btn--lg btn--ghost"
                    href={`/study-abroad/${country.slug}`}
                  >
                    {country.name} guide
                  </Link>
                ) : null}
              </div>

              {university.qsRanking ? (
                <p className="rankline">
                  <span>
                    <b>#{university.qsRanking}</b> QS World University Rankings
                  </span>
                  <em>
                    Ranking is one factor among many. Programme fit, cost and
                    entry requirements usually matter more to your outcome.
                  </em>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className={`${band('snapshot')} sec--tight`} id="snapshot">
        <div className="wrap">
          <div className="unisnap">
            {snapshot.map((cell) => (
              <div className="unisnap__cell" key={cell.label}>
                <span className="label">{cell.label}</span>
                <b>{cell.value}</b>
              </div>
            ))}
          </div>
          {figureSource ? (
            <p className="unisnap__source">
              Student figures as published by{' '}
              {university.statsSourceUrl ? (
                <a
                  href={university.statsSourceUrl}
                  rel="nofollow noopener"
                  target="_blank"
                >
                  {figureSource}
                </a>
              ) : (
                figureSource
              )}
              . Universta does not count them itself.
            </p>
          ) : figuresShown ? (
            <p className="unisnap__source">
              Student figures are recorded in the catalogue without a
              published source, so treat them as indicative.
            </p>
          ) : null}
          <div className="verifybar">
            <div className="verifybar__body">
              <strong>Check before you apply.</strong> Fees, entry requirements
              and deadlines are set by the university and change between
              intakes. This page records what the catalogue holds, not an
              offer.
              {university.verifiedAt || university.sourceReference ? (
                <p className="verifybar__note">
                  {university.verifiedAt
                    ? `Last checked ${new Date(university.verifiedAt)
                        .toISOString()
                        .slice(0, 10)}.`
                    : null}{' '}
                  {university.sourceReference ? (
                    <>
                      Source:{' '}
                      <a
                        href={university.sourceReference}
                        rel="nofollow noopener"
                        target="_blank"
                      >
                        the institution&rsquo;s own pages
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title="About this university"
              lead={university.shortDescription ?? undefined}
            />
            <div className="prose">
              <RichText value={overview!} />
            </div>
          </div>
        </section>
      ) : null}

      {offerings.length ? (
        <section className={band('programmes')} id="programmes">
          <div className="wrap">
            <SectionHead
              n={n('programmes')}
              eyebrow="Courses"
              title={`Programmes at ${university.name}`}
              lead={`${offerings.length} ${offerings.length === 1 ? 'programme is' : 'programmes are'} profiled here, each with its own page. A university usually lists more than a catalogue carries, so treat this as a starting point rather than its full prospectus.`}
            />
            <CourseCards
              courses={offerings.map((offering) =>
                asCourse(offering, university.name),
              )}
              hrefFor={(course) =>
                `/universities/${university.slug}/courses/${course.slug}`
              }
            />
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('funding')} id="funding">
          <div className="wrap">
            <SectionHead
              n={n('funding')}
              eyebrow="Funding"
              title={`Scholarships at ${university.name}`}
              lead={`${scholarships.length} ${scholarships.length === 1 ? 'award is' : 'awards are'} recorded against this institution. ${FUNDING_CAVEAT}`}
            />
            <ScholarshipCards scholarships={scholarships} showCountries={false} />
          </div>
        </section>
      ) : null}

      {hasContact ? (
        <section className={`${band('contact')} sec--tight`} id="contact">
          <div className="wrap">
            <SectionHead
              n={n('contact')}
              eyebrow="Contact"
              title="Ask the university directly"
              lead="Anything on this page can change between intakes. These are the institution's own channels, which is where an answer is binding."
            />
            <div className="switcher switcher--few">
              {university.websiteUrl ? (
                <a
                  className="switcher__item"
                  href={university.websiteUrl}
                  rel="nofollow noopener"
                  target="_blank"
                >
                  <span className="cchip__name">Official website</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
              ) : null}
              {university.admissionsEmail ? (
                <a
                  className="switcher__item"
                  href={`mailto:${university.admissionsEmail}`}
                >
                  <span className="cchip__name">
                    {university.admissionsEmail}
                  </span>
                </a>
              ) : null}
              {university.phone ? (
                <a
                  className="switcher__item"
                  href={`tel:${university.phone.replace(/[^+\d]/g, '')}`}
                >
                  <span className="cchip__name">{university.phone}</span>
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {country ? (
        <section className={`${band('destination')} sec--tight`} id="destination">
          <div className="wrap">
            <SectionHead
              n={n('destination')}
              eyebrow="Destination"
              title={`Studying in ${country.name}`}
              lead="Fees, visa route, intakes and living costs are set by the destination rather than the institution, so they live on its guide."
            />
            <div className="switcher switcher--few">
              <Link
                className="switcher__item"
                href={`/study-abroad/${country.slug}`}
              >
                <FlagMark iso2Code={country.iso2Code} bands={null} />
                <span className="cchip__name">{country.name}</span>
                <span className="switcher__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <Link
                className="switcher__item"
                href={`/universities?q=${encodeURIComponent(country.name)}`}
              >
                <span className="cchip__name">
                  Other universities in {country.name}
                </span>
                <span className="switcher__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
