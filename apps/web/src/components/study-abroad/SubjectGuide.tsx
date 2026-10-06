import Link from 'next/link';
import type {
  Course,
  CourseLevelGroup,
  Media,
  SubjectDetail,
} from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { levelCoursesHref, levelTotal } from '@/lib/course-levels';
import { universityHref } from '@/lib/university-links';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { formatNumber } from '@/lib/format';
import { CourseCards } from './CourseCards';
import { CourseLevels } from './CourseLevels';
import { Crumbs } from './Crumbs';
import { DestinationSwitcher } from './DestinationSwitcher';
import { firstSentence, splitLead } from './CountryGuideSections';
import {
  destinationsLead,
  programmeCount,
  rankDestinations,
  sparseBandClass,
  switcherClass,
  teachingDestinations,
  type CountedDestination,
} from './switcher';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { ConsultantsCta } from './ConsultantsCta';
import { Longform } from './Longform';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';
import { SubjectSpecializations } from './SubjectSpecializations';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';

/** A neighbouring subject, for the "Related subjects" band. */
export type RelatedSubject = {
  id: string;
  name: string;
  slug: string;
  iconMedia?: Media | null;
};

/** The subject's generic mark, where a record has no icon of its own. */
function SubjectGlyph({ media, stroke = '1.4' }: { media?: Media | null; stroke?: string }) {
  return media ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt="" />
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}>
      <path d="M4 5h16v14H4z M4 9h16" />
    </svg>
  );
}

/**
 * A subject's guide, in the approved design.
 *
 * The reference builds subjects from the same stylesheet and the same section
 * bands as the country guides, so this is the study-abroad language rather
 * than a second one: numbered eyebrows, paper and white alternating, the
 * closing navy band.
 *
 * Sections stand down rather than render empty, and both the numbering and the
 * shade are taken from what actually renders, so a subject with no courses yet
 * still reads as a finished page and never shows two paper bands touching.
 */
export function SubjectGuide({
  subject,
  scholarships,
  universities = [],
  universityTotal,
  levels: levelGroups = null,
  related = [],
}: {
  subject: SubjectDetail;
  scholarships: ScholarshipCard[];
  /** Cross-links only: the reference gives a subject no universities section,
   *  so these close the page in the connect band rather than open one. */
  universities?: Array<{ id: string; name: string; slug: string }>;
  /** How many universities teach it in all. The page reads a handful to
   *  link to, and its figure used to be the size of that handful. */
  universityTotal?: number | null;
  /** The subject's courses filed under their study levels, in academic
   *  order. Absent when that read failed; the six mixed courses the subject
   *  carries are shown instead, as they were before. */
  levels?: CourseLevelGroup[] | null;
  /** Subjects that share a specialization with this one, closest first. */
  related?: RelatedSubject[];
}) {
  const specializations = subject.subSubjects ?? [];
  /* The places that teach it first, most programmes first: the band used to
     open on Afghanistan, Albania and Algeria, which list every subject and
     teach none of this one. */
  const countries = rankDestinations(
    (subject.countries ?? []) as CountedDestination[],
  );
  const teaching = teachingDestinations(countries);
  /* How many destinations teach it, which is the figure the page states.
     Every destination lists every subject, so the length of the list
     answered a different question -- and read 205 where 82 teach it. */
  const destinationCount = subject.availableCountryCount ?? teaching.length;
  const courses: Course[] = subject.featuredCourses ?? [];
  const groups = levelGroups ?? [];
  /* The levels with something listed. `groups` also holds the levels the
     page always shows, empty ones included, which the block draws and the
     figures must not count as taught. */
  const taught = groups.filter((group) => group.count > 0);
  /* In academic order where the grouped read supplied it; the subject's own
     counts arrive in that order too. */
  const levels = taught.length
    ? taught.map((group) => ({ level: group.level, count: group.count }))
    : (subject.courseCountsByLevel ?? []);
  const levelOrder = levels.flatMap((row) => (row.level.code ? [row.level.code] : []));
  const filed = levelTotal(groups);
  const tests = subject.tests ?? [];
  const overview = subject.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  /* The design sets the overview's opening on the page, large, and the
     reference shows the whole of it. Only the opening was hidden behind
     the toggle before, so the section read as a counts line and a button.
     The first paragraph leads; anything after it opens under the toggle. */
  const split = hasOverview ? splitLead(overview!) : null;
  /* The overview usually opens on the short description the hero has just
     printed, and the lead then said it a second time, word for word. */
  const said = subject.shortDescription?.replace(/\s+/g, ' ').trim();
  const leadText = split?.lead?.replace(/\s+/g, ' ').trim();
  const unsaid =
    leadText && said && leadText.startsWith(said)
      ? leadText.slice(said.length).trim()
      : leadText;
  const opening = unsaid ? firstSentence(unsaid) : null;
  const universityCount = universityTotal ?? universities.length;
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}`,
  });

  /* Only the figures this record actually has: a strip of dashes says less
     than a shorter strip does. */
  const stats = [
    specializations.length
      ? { label: 'Specializations', value: formatNumber(specializations.length) }
      : null,
    levels.length
      ? { label: 'Study levels', value: levels.map((row) => row.level.name).join(', ') }
      : null,
    subject.publishedCourseCount
      ? { label: 'Programmes profiled', value: formatNumber(subject.publishedCourseCount) }
      : null,
    universityCount
      ? { label: 'Universities', value: formatNumber(universityCount) }
      : null,
    destinationCount
      ? { label: 'Destinations', value: formatNumber(destinationCount) }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (specializations.length) order.push('specializations');
  if (countries.length) order.push('destinations');
  if (groups.length || courses.length) order.push('programs');
  if (tests.length) order.push('tests');
  if (scholarships.length) order.push('scholarship-funding');
  if (related.length) order.push('related-subjects');

  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    order.indexOf(id) % 2 === 0 ? 'sec sec--paper' : 'sec sec--white';

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Subjects', href: '/subjects' },
              { label: subject.name },
            ]}
          />
          <div className="subjhero">
            <span className="subjhero__icon" aria-hidden="true">
              <SubjectGlyph media={subject.iconMedia} />
            </span>
            <div>
              <p className="hero__eyebrow">
                Subject<b>·</b>
                {specializations.length} specializations
              </p>
              <h1 className="hero__h1">Study {subject.name} abroad</h1>
              {subject.shortDescription ? (
                <p className="hero__sub">{subject.shortDescription}</p>
              ) : null}
              <div className="btn-row" style={{ marginTop: 22 }}>
                <Link
                  className="btn btn--lg"
                  href={`/courses?subject=${subject.slug}`}
                >
                  Find my programmes{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
                {/* The directory reads `?subject=`, so the button opens the
                    universities that teach it rather than all of them. */}
                <Link
                  className="btn btn--lg btn--ghost"
                  href={`/universities?subject=${subject.slug}`}
                >
                  Browse universities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The reference states the shape of a subject before it explains it:
          how many branches, which levels, and how much of it we have profiled.
          Each figure stands down on its own rather than showing a zero. */}
      {stats.length ? (
        <section className="sec sec--white sec--tight">
          <div className="wrap">
            <div className="unisnap unisnap--fit">
              {stats.map((row) => (
                <div className="unisnap__cell" key={row.label}>
                  <span className="label">{row.label}</span>
                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead n={n('about')} eyebrow="Overview" title={`About ${subject.name}`}>
              {opening ? <p className="ov__lead">{opening.first}</p> : null}
              {opening?.rest ? <p className="ov__more">{opening.rest}</p> : null}
              <p className="subjabout__facts datum">
                {formatNumber(subject.publishedCourseCount) || '—'} programmes ·{' '}
                {specializations.length || '—'} specializations ·{' '}
                {destinationCount ? formatNumber(destinationCount) : '—'} destinations
              </p>
            </SectionHead>
            {split?.rest ? (
              <Longform label={`More about ${subject.name}`}>
                <div className="prose">
                  <RichText value={split.rest} />
                </div>
              </Longform>
            ) : null}
          </div>
        </section>
      ) : null}

      {specializations.length ? (
        <section className={band('specializations')} id="specializations">
          <div className="wrap">
            <SectionHead
              n={n('specializations')}
              eyebrow="Specializations"
              title="Choose a specialization"
              lead={`The branches of ${subject.name} we cover. Each one has its own page.`}
            />
            <SubjectSpecializations
              subjectName={subject.name}
              subjectSlug={subject.slug}
              branches={specializations}
              levelOrder={levelOrder}
            />
          </div>
        </section>
      ) : null}

      {countries.length ? (
        <section
          className={band('destinations') + sparseBandClass(countries.length)}
          id="destinations"
        >
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title={`Where you can study ${subject.name}`}
              lead={destinationsLead({
                name: subject.name,
                countries,
                open: `Open one to see ${subject.name} there: its specializations and the programmes taught in it.`,
                legacy: `Open a destination to see ${subject.name} there: its specializations and the programmes taught in it.`,
              })}
            >
              {/* The section's link, set as one: it was a second grey
                  paragraph with no gap, and read as the sentence's last
                  line. */}
              <p className="sec-head__cta">
                <Link className="linkcta" href="/study-abroad">
                  All destinations{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </p>
            </SectionHead>
            <DestinationSwitcher
              countries={countries}
              label={subject.name}
              within={subject.slug}
            />
          </div>
        </section>
      ) : null}

      {groups.length || courses.length ? (
        <section className={band('programs')} id="programs">
          <div className="wrap">
            <SectionHead
              n={n('programs')}
              eyebrow="Programmes"
              title={
                groups.length
                  ? `${subject.name} programmes by level`
                  : `${subject.name} programmes`
              }
              lead={
                groups.length
                  ? filed
                    ? `${formatNumber(filed)} ${filed === 1 ? 'programme' : 'programmes'}, each under the level it is taught at.`
                    : `No ${subject.name} programme is listed yet. Programmes are filed under these study levels as they are added.`
                  : levels.length
                    ? levels
                        .map((row) => `${row.level.name} (${row.count})`)
                        .join(' · ')
                    : undefined
              }
            >
              {/* A search with nothing in it is not a way on. */}
              {filed || courses.length ? (
                <p className="sec-head__cta">
                  <Link className="linkcta" href={`/courses?subject=${subject.slug}`}>
                    Every {subject.name} programme{' '}
                    <span className="linkcta__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </p>
              ) : null}
            </SectionHead>
            {groups.length ? (
              <CourseLevels
                groups={groups}
                allHref={(level) =>
                  levelCoursesHref({ subject: subject.slug, level })
                }
              />
            ) : (
              <CourseCards courses={courses} />
            )}
          </div>
        </section>
      ) : null}

      {tests.length ? (
        <section className={band('tests')} id="tests">
          <div className="wrap">
            <SectionHead
              n={n('tests')}
              eyebrow="Requirements"
              title={`Tests you may need for ${subject.name}`}
              lead="Language tests accepted by the destinations that teach this subject. Requirements are set per programme, so confirm with the university before you book one."
            />
            <div className="examtests">
              <div className="examtests__group">
                <p className="path__h">English language tests</p>
                <ul className="examtests__list">
                  {tests.map((test) => (
                    <li className="examchip" key={test.code}>
                      <span className="examchip__main">
                        <span className="examchip__name">{test.name}</span>
                        <span className="examchip__cat">
                          English language test
                        </span>
                      </span>
                      {test.minScore ? (
                        <span className="examchip__meta">
                          <em>Highest published minimum: {test.minScore}</em>
                        </span>
                      ) : null}
                      <span className="examchip__side">
                        <span className="badge badge--neutral">
                          Accepted by {test.countries}{' '}
                          {test.countries === 1 ? 'destination' : 'destinations'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="examtests__note">
                  A destination that lists a test as optional still accepts it;
                  many waive it when your earlier study was in English.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('scholarship-funding')} id="scholarship-funding">
          <div className="wrap">
            <SectionHead
              n={n('scholarship-funding')}
              eyebrow="Funding"
              title={`Scholarships for ${subject.name}`}
              lead={`Awards recorded against this subject. ${FUNDING_CAVEAT}`}
            />
            <div className="schgroup">
              <div className="schgroup__head">
                <p className="path__h">
                  Recorded against {subject.name}{' '}
                  <span className="schgroup__n datum">{scholarships.length}</span>
                </p>
              </div>
              <ScholarshipCards scholarships={scholarships} />
            </div>
            <ConsultantsCta field={subject.name} />
          </div>
        </section>
      ) : null}

      {/* The reference ends a subject with its neighbours, so a reader on the
          wrong page can step sideways rather than back to the full list. It
          is as long as the data makes it, and absent when nothing is shared. */}
      {related.length ? (
        <section
          className={`${band('related-subjects')} sec--tight`}
          id="related-subjects"
        >
          <div className="wrap">
            {/* The compact head the specialization page gives its own
                "Related" band: a secondary section, not a chapter. */}
            <div className="sec-head sec-head--compact">
              <div>
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('related-subjects')}</span>{' '}
                  Related
                </p>
                <h2 className="sec-title sec-title--sm">Related subjects</h2>
                <p className="sec-lead">
                  Subjects that share specializations with {subject.name}.
                </p>
              </div>
            </div>
            <div className={switcherClass(related.length)}>
              {related.map((row) => (
                <Link
                  key={row.id}
                  className="switcher__item"
                  href={`/subjects/${row.slug}`}
                >
                  <span className="subjcard__icon subjrel__icon" aria-hidden="true">
                    <SubjectGlyph media={row.iconMedia} stroke="1.5" />
                  </span>
                  <span className="cchip__name">{row.name}</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ))}
            </div>
            <p className="h-more">
              <Link className="linkcta" href="/subjects">
                All subjects{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <MatchBand
        heading="Found your field?"
        href={`/courses?subject=${subject.slug}`}
        talkHref={counselling}
      />

      <PlanBand
        heading={`Thinking about ${subject.name}?`}
        body="Tell us your academic profile, goals and budget, and we'll show you which destinations run it and what you would need."
        secondary={{ href: '/subjects', label: 'Browse all subjects' }}
      />

      <ConnectBand
        actions={[
          { href: `/courses?subject=${subject.slug}`, label: 'Explore courses' },
          {
            href: `/scholarships?subject=${subject.slug}`,
            label: 'Find scholarships',
            ghost: true,
          },
          /* The enquiry arrives saying which subject it was about, rather
             than as a blank contact form. */
          { href: counselling, label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            items: specializations.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/subjects/${subject.slug}/${row.slug}`,
            })),
          },
          /* The same places the band above opens on, each opening the subject
             there rather than the country's general guide. */
          {
            title: 'Destinations',
            items: (teaching.length ? teaching : countries).map((row) => ({
              id: row.id,
              name: row.name,
              href: `/study-abroad/${row.slug}/${subject.slug}`,
              note: row.courseCount ? programmeCount(row.courseCount) : null,
            })),
            total: teaching.length || countries.length,
          },
          {
            title: 'Universities',
            items: universities.map((row) => ({
              id: row.id,
              name: row.name,
              href: universityHref(row.slug),
            })),
            total: universityCount,
          },
        ]}
      />
    </>
  );
}
