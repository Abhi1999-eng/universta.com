import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { CourseDetail } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { CourseCards } from './CourseCards';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { counsellingHref } from '@/lib/counselling-link';
import { inCountry } from '@/lib/country-article';
import { durationLabel, programmesHref } from '@/lib/course-levels';
import { formatNumber } from '@/lib/format';
import { dateLabel } from '@/lib/university-courses';
import type { ProgrammeSample as Programmes } from '@/lib/programme-sample';
import {
  academicRows,
  englishRows,
  feeRange,
  hasEntryDetail,
  intakeRows,
} from '@/lib/course-entry';
import { allProgrammes, ProgrammeSample } from './ProgrammeSample';
import {
  courseSections,
  sectionItems,
  sectionParagraphs,
  sectionSteps,
} from '@/lib/course-sections';
import {
  CareerList,
  DocumentPills,
  SectionChecklist,
  SectionMedia,
  SectionProse,
} from './CourseSectionParts';

/** How many of the programmes read are drawn as cards; the rest are a line
 *  each, so every university the page read is named. */
const CARDS_SHOWN = 6;

const NOT_LISTED = 'Not listed';

/** The design's labels for the section strip, by section. */
const TAB_LABELS: Record<string, string> = {
  about: 'About',
  curriculum: 'Curriculum',
  skills: 'Skills',
  eligibility: 'Eligibility',
  destinations: 'Destinations',
  taught: 'Universities',
  entry: 'Entry',
  apply: 'How to apply',
  funding: 'Scholarships',
  careers: 'Careers',
  faqs: 'FAQs',
  similar: 'Similar',
};

/**
 * A programme's guide, in the approved design.
 *
 * The reference runs twelve sections here, several of which describe things a
 * generic course record cannot know -- which consultants cover it, say. Those
 * stand down rather than render a heading over nothing, and the numbering is
 * taken from what survives so it never skips.
 *
 * Which universities teach it is no longer one of them: the universities'
 * own programmes name the course they are an instance of, so the guide
 * lists them, narrowed to the destination it was opened under, and hands
 * on to all of them in the finder. A course nobody teaches yet -- every
 * course, while the catalogue holds no programmes -- simply has no such
 * section.
 *
 * The facts the hero used to run together in one line are the design's
 * "At a glance" panel, as on a programme's own page.
 *
 * Every kind of content section the admin offers has a place: the
 * curriculum and the skills, admission requirements with the documents as
 * the design's pills, the application process as its numbered steps, the
 * career outcomes as its numbered role list under the careers prose, the
 * sources under the facts and the counselling call as the closing band.
 * Each section's subheading is its band's lead and its picture sits under
 * its text. The prose of a band sits in the right-hand column beside its
 * heading, as the design lays every band out, so no band leaves the right
 * half of the page empty.
 */
export function CourseGuide({
  course,
  country,
  scholarships = [],
  programmes = null,
}: {
  course: CourseDetail;
  /** Awards recorded against this programme wherever it is taught. Read on
   *  the page rather than carried on the course record, so a failure to
   *  reach the funding list costs a section and not the route. */
  scholarships?: ScholarshipCard[];
  /** The destination the visitor arrived under, so counselling booked from
   *  here starts with the course and that country already stated. */
  country?: string;
  /** The universities' programmes of this course, in that destination when
   *  there is one. Null when there are none or they could not be read. */
  programmes?: Programmes | null;
}) {
  const overview = course.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  const sections = course.contentSections ?? [];
  const faqs = course.faqs ?? [];
  const related = course.relatedCourses ?? [];
  const availability = course.availability ?? [];
  const careers = course.careerSummary?.trim();

  const {
    curriculum,
    skills,
    admission,
    documents,
    careers: outcomes,
    application: apply,
    sources,
    counselling,
  } = courseSections(sections);
  const eligibility = admission ?? documents;
  const steps = sectionSteps(apply);
  const skillItems = sectionItems(skills);
  const outcomeItems = sectionItems(outcomes);
  const sourceText = sectionParagraphs(sources);

  /* The destination the guide was opened under, by its name; the course's
     record narrows to it, so it is the one row its availability holds. */
  const atHere = country
    ? (availability.find((row) => row.country.slug === country) ?? null)
    : null;
  const hereName =
    atHere?.country.name ??
    (country && course.selectedCountry?.slug === country
      ? course.selectedCountry.name
      : null);
  const here = hereName ? inCountry(hereName) : null;
  const taught = programmes?.cards.length ? programmes : null;

  /* The panel holds what the facts line held -- the level, how long, how it
     is taught, how many destinations -- and, under a destination, what that
     destination records for its fee and intakes. A fact the record does
     not hold says so rather than dropping its row. */
  const duration = durationLabel(course);
  const modes = (course.studyModes ?? []).map((mode) => mode.name).join(', ');
  const intakesHere = [
    ...new Set(atHere ? intakeRows(atHere).map((row) => row.name) : []),
  ];
  const code = course.courseCode?.trim() || null;
  const credits =
    course.credits !== null &&
    course.credits !== undefined &&
    course.credits !== '' &&
    Number.isFinite(Number(course.credits))
      ? formatNumber(Number(course.credits))
      : null;
  const glance: Array<{ label: string; value: string | null; note?: string | null }> = [
    {
      label: 'Level',
      value: course.courseLevel?.name ?? null,
      note: course.qualificationName,
    },
    /* The code and the credits an editor recorded, where there are some;
       a course without them keeps the panel it had. */
    ...(code ? [{ label: 'Course code', value: code }] : []),
    { label: 'Duration', value: duration },
    ...(credits ? [{ label: 'Credits', value: credits }] : []),
    { label: 'Study mode', value: modes || null },
    hereName
      ? { label: 'Destination', value: hereName }
      : {
          label: 'Destinations',
          value: availability.length
            ? `${formatNumber(availability.length)} ${availability.length === 1 ? 'destination' : 'destinations'}`
            : null,
        },
    ...(hereName
      ? [
          {
            label: 'Tuition',
            value: atHere ? feeRange(atHere.tuition) : null,
            note:
              atHere && feeRange(atHere.tuition) && atHere.tuition?.period === 'PER_YEAR'
                ? 'A year'
                : null,
          },
          {
            label: intakesHere.length > 1 ? 'Intakes' : 'Intake',
            value: intakesHere.join(' · ') || null,
          },
        ]
      : []),
    ...(taught
      ? [
          {
            label: 'Programmes',
            value: formatNumber(taught.total),
            note: taught.universities
              ? `At ${formatNumber(taught.universities)} ${taught.universities === 1 ? 'university' : 'universities'}`
              : null,
          },
        ]
      : []),
  ];

  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (curriculum) order.push('curriculum');
  if (skills) order.push('skills');
  if (eligibility) order.push('eligibility');
  if (availability.length) order.push('destinations');
  if (taught) order.push('taught');
  /* A destination that is only a name adds a card saying nothing, so the
     section is built from the ones that actually recorded something. */
  const detailed = availability.filter(hasEntryDetail);
  if (detailed.length) order.push('entry');
  if (apply) order.push('apply');
  if (scholarships.length) order.push('funding');
  if (careers || outcomes) order.push('careers');
  if (faqs.length) order.push('faqs');
  if (related.length) order.push('similar');

  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    order.indexOf(id) % 2 === 0 ? 'sec sec--paper' : 'sec sec--white';

  const subjectSlug = course.subject?.slug;
  /* The counselling section is the closing invitation's own words, where
     an editor wrote some. */
  const ctaBody = counselling
    ? [
        counselling.subheading?.trim(),
        ...sectionParagraphs(counselling).map((line) =>
          richTextToPlainText(line).trim(),
        ),
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <>
      <section className="hero hero--compact coursehero">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/courses">Courses</Link>
            {course.subject ? (
              <>
                <span className="crumbs__sep" aria-hidden="true">
                  /
                </span>
                <Link href={`/subjects/${course.subject.slug}`}>
                  {course.subject.name}
                </Link>
              </>
            ) : null}
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{course.name}</span>
          </nav>
          <div className="coursehero__grid">
            <div className="coursehero__main">
              <p className="hero__eyebrow">
                {course.courseLevel?.name ?? 'Programme'}
                {course.qualificationName ? (
                  <>
                    <b>·</b>
                    {course.qualificationName}
                  </>
                ) : null}
              </p>
              <h1 className="coursehero__name">{course.name}</h1>
              {course.shortDescription ? (
                <p className="hero__sub">{course.shortDescription}</p>
              ) : null}
              {/* Where the course sits, as the design's programme page shows
                  it: the subject, the specialization, and the subject in the
                  destination the guide was opened under. */}
              {course.subject ? (
                <div className="topicpath" aria-label="Where this course sits">
                  <Link
                    className="topicpath__item"
                    href={`/subjects/${course.subject.slug}`}
                  >
                    <span className="label">Subject</span>
                    <span>
                      {course.subject.name} <span aria-hidden="true">&rarr;</span>
                    </span>
                  </Link>
                  {course.subSubject ? (
                    <Link
                      className="topicpath__item"
                      href={`/subjects/${course.subject.slug}/${course.subSubject.slug}`}
                    >
                      <span className="label">Specialization</span>
                      <span>
                        {course.subSubject.name}{' '}
                        <span aria-hidden="true">&rarr;</span>
                      </span>
                    </Link>
                  ) : null}
                  {country && hereName ? (
                    <Link
                      className="topicpath__item"
                      href={`/study-abroad/${country}/${course.subject.slug}`}
                    >
                      <span className="label">In {here}</span>
                      <span>
                        {course.subject.name} <span aria-hidden="true">&rarr;</span>
                      </span>
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <div className="btn-row" style={{ marginTop: 22 }}>
                <Link
                  className="btn btn--lg"
                  href={`/courses?subject=${course.subject.slug}`}
                >
                  Similar programmes{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
                <Link
                  className="btn btn--lg btn--ghost"
                  href={counsellingHref({
                    source: 'course',
                    course: course.slug,
                    ...(country ? { country } : {}),
                    from: `/courses/${course.slug}`,
                  })}
                >
                  Talk to a counsellor
                </Link>
              </div>
            </div>

            <aside className="snap coursefacts" aria-label="Course facts">
              <div className="snap__head">
                <span className="snap__title">At a glance</span>
              </div>
              {glance.map((row) => (
                <div className="snap__row" key={row.label}>
                  <span className="snap__k">{row.label}</span>
                  <span className={`snap__v${row.value ? '' : ' uc-none'}`}>
                    {row.value ?? NOT_LISTED}
                  </span>
                  {row.note ? <span className="snap__n">{row.note}</span> : null}
                </div>
              ))}
              <div className="snap__foot">
                {/* The sources section, under the facts it vouches for:
                    its heading and date line, and how they were checked
                    one click away. */}
                {sources ? (
                  <div className="cg-sources">
                    <p className="snap__source">
                      <b>{sources.heading?.trim() || 'Sources'}</b>
                      {sources.subheading?.trim()
                        ? ` · ${sources.subheading.trim()}`
                        : ''}
                    </p>
                    {sourceText.length || sources.media?.url ? (
                      <details className="cg-sources__more">
                        <summary>How we checked</summary>
                        <SectionProse section={sources} />
                        <SectionMedia media={sources.media} />
                      </details>
                    ) : null}
                  </div>
                ) : null}
                <p className="snap__disclaimer">
                  {hereName
                    ? `What the catalogue records for ${here}. `
                    : ''}
                  Each university sets its own fees, intakes and entry
                  requirements &mdash; open a programme for its figures.
                </p>
              </div>
            </aside>
          </div>
          {/* The picture an editor set on the course, under its name and
              its facts, as a subject's hero carries its own. */}
          {course.featuredMedia?.url ? (
            <figure className="subjhero__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={course.featuredMedia.url}
                alt={course.featuredMedia.alt ?? ''}
                loading="eager"
              />
            </figure>
          ) : null}
        </div>
      </section>

      {/* `unitabs--sections` gives the sections below their offset, so a
          link here lands each one under the sticky header and this strip. */}
      {order.length > 1 ? (
        <nav className="unitabs unitabs--sections" aria-label="Course sections">
          <div className="wrap unitabs__inner">
            {order.map((id) => (
              <a key={id} href={`#${id}`}>
                {TAB_LABELS[id] ?? id}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {hasOverview ? (
        <section className={`${band('about')} cg-band`} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title={`About ${course.name}`}
            >
              <div className="prose">
                <RichText value={overview!} />
              </div>
            </SectionHead>
          </div>
        </section>
      ) : null}

      {curriculum ? (
        <section className={`${band('curriculum')} cg-band`} id="curriculum">
          <div className="wrap">
            <SectionHead
              n={n('curriculum')}
              eyebrow="Curriculum"
              title={curriculum.heading?.trim() || 'What you study'}
              lead={curriculum.subheading?.trim() || undefined}
            >
              <SectionChecklist section={curriculum} />
              <SectionMedia media={curriculum.media} />
            </SectionHead>
          </div>
        </section>
      ) : null}

      {skills ? (
        <section className={`${band('skills')} cg-band`} id="skills">
          <div className="wrap">
            <SectionHead
              n={n('skills')}
              eyebrow="Skills"
              title={skills.heading?.trim() || 'Skills you build'}
              lead={skills.subheading?.trim() || undefined}
            >
              {skillItems.length ? null : <SectionProse section={skills} />}
              <SectionMedia media={skills.media} />
            </SectionHead>
            <CareerList items={skillItems} label={skills.heading?.trim() || 'Skills'} />
          </div>
        </section>
      ) : null}

      {eligibility ? (
        <section className={`${band('eligibility')} cg-band`} id="eligibility">
          <div className="wrap">
            <SectionHead
              n={n('eligibility')}
              eyebrow="Eligibility"
              title={eligibility.heading?.trim() || 'Who can apply'}
              lead={eligibility.subheading?.trim() || undefined}
            >
              {admission ? (
                <>
                  <SectionChecklist section={admission} />
                  <SectionMedia media={admission.media} />
                </>
              ) : null}
              {/* The documents, as the design's "Documents required"
                  pills beside the requirements. Alone, they are the band. */}
              {documents ? (
                <div className="cg-docs">
                  {admission ? (
                    <>
                      <p className="path__h">
                        {documents.heading?.trim() || 'Documents required'}
                      </p>
                      {documents.subheading?.trim() ? (
                        <p className="cg-note">{documents.subheading.trim()}</p>
                      ) : null}
                    </>
                  ) : null}
                  <DocumentPills section={documents} />
                  <SectionMedia media={documents.media} />
                </div>
              ) : null}
            </SectionHead>
          </div>
        </section>
      ) : null}

      {availability.length ? (
        <section className={band('destinations')} id="destinations">
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title="Where you can study it"
              lead="Fees and intakes are set by the university, so open a destination for its own numbers."
            />
            {/* The design's chip row, which wraps: as one line it ran
                twelve countries off the side of a phone. */}
            <div className="citychips">
              {availability.map((row) => (
                <Link
                  key={row.id}
                  className="chipbtn"
                  href={`/study-abroad/${row.country.slug}`}
                >
                  {row.country.name}
                  {row.availabilityStatus === 'LIMITED' ? (
                    <span className="badge badge--cond">Limited</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {taught ? (
        <section className={band('taught')} id="taught">
          <div className="wrap">
            <SectionHead
              n={n('taught')}
              eyebrow="Universities"
              title="Where it is taught"
              lead={`${formatNumber(taught.total)} ${taught.total === 1 ? 'programme' : 'programmes'}${
                taught.universities
                  ? ` at ${formatNumber(taught.universities)} ${taught.universities === 1 ? 'university' : 'universities'}`
                  : ''
              }${here ? ` in ${here}` : ''}, each as the university teaches it. Its page has the university’s own fees, intakes and entry requirements.`}
            />
            {/* Every card here is an instance of this course, so its
                "Course guide" would only lead back to this page. */}
            <ProgrammeSample
              cards={taught.cards.slice(0, CARDS_SHOWN)}
              rows={taught.cards.slice(CARDS_SHOWN)}
              rowsLabel="Also taught at"
              link={{
                href: programmesHref({ course: course.slug, country: country || undefined }),
                label: allProgrammes('See', taught.total),
              }}
              guideLinks={false}
            />
          </div>
        </section>
      ) : null}

      {detailed.length ? (
        <section className={band('entry')} id="entry">
          <div className="wrap">
            <SectionHead
              n={n('entry')}
              eyebrow="Entry"
              title="What each destination asks for"
              lead="The same programme is admitted on different terms in different countries. Only what the catalogue records is shown -- a figure missing here has not been set, not set to zero."
            />
            {/* One destination: its card takes the width in two columns,
                the figures and intakes on the left, what it asks in words
                on the right. Several: one card each, side by side. */}
            <div
              className={`entrygrid${detailed.length === 1 ? ' entrygrid--one' : ''}`}
            >
              {detailed.map((row) => {
                const tuition = feeRange(row.tuition);
                const applicationFee = feeRange(row.applicationFee);
                const academic = academicRows(row);
                const english = englishRows(row);
                const intakes = intakeRows(row);
                const limited = row.availabilityStatus === 'LIMITED';
                const figures = Boolean(
                  tuition || applicationFee || academic.length || english.length || intakes.length,
                );
                const words = Boolean(
                  row.englishRequirementsText?.trim() ||
                    row.admissionRequirements?.trim() ||
                    row.applicationNotes?.trim() ||
                    row.careerOpportunities?.trim() ||
                    row.sourceReference,
                );
                return (
                  <article
                    className={`entrycard${
                      detailed.length === 1 && figures && words ? ' entrycard--split' : ''
                    }`}
                    key={row.id}
                  >
                    <h3 className="entrycard__t">
                      <Link href={`/study-abroad/${row.country.slug}`}>
                        {row.country.name}
                      </Link>
                      {/* What the editor ticked as "Limited": taught there,
                          with fewer places or not every year. */}
                      {limited ? (
                        <span className="badge badge--cond">Limited availability</span>
                      ) : null}
                    </h3>

                    {figures ? (
                      <div className="entrycard__col">
                        {tuition || applicationFee ? (
                          <dl className="entrycard__facts">
                            {tuition ? (
                              <div>
                                <dt>Tuition</dt>
                                <dd>{tuition}</dd>
                              </div>
                            ) : null}
                            {applicationFee ? (
                              <div>
                                <dt>Application fee</dt>
                                <dd>{applicationFee}</dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : null}

                        {academic.length ? (
                          <dl className="entrycard__facts">
                            {academic.map((fact) => (
                              <div key={fact.label}>
                                <dt>{fact.label}</dt>
                                <dd>{fact.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}

                        {english.length ? (
                          <>
                            <p className="entrycard__label">
                              <span className="label">English, minimum</span>
                            </p>
                            <dl className="entrycard__facts">
                              {english.map((fact) => (
                                <div key={fact.label}>
                                  <dt>{fact.label}</dt>
                                  <dd>{fact.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </>
                        ) : null}

                        {intakes.length ? (
                          <table className="entrytable">
                            <caption className="sr-only">
                              Intakes and application deadlines in{' '}
                              {row.country.name}
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">Intake</th>
                                <th scope="col">Apply by</th>
                              </tr>
                            </thead>
                            <tbody>
                              {intakes.map((intake) => (
                                <tr key={intake.id}>
                                  <th scope="row">{intake.name}</th>
                                  <td>
                                    {intake.deadline ?? 'Deadline not published'}
                                    {intake.notes ? (
                                      <span className="entrytable__note">
                                        {intake.notes}
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                      </div>
                    ) : null}

                    {words ? (
                      <div className="entrycard__col">
                        {row.englishRequirementsText?.trim() ? (
                          <p className="entrycard__note">
                            {row.englishRequirementsText}
                          </p>
                        ) : null}
                        {row.admissionRequirements?.trim() ? (
                          <p className="entrycard__note">
                            {row.admissionRequirements}
                          </p>
                        ) : null}
                        {row.applicationNotes?.trim() ? (
                          <p className="entrycard__note">{row.applicationNotes}</p>
                        ) : null}
                        {/* Where graduates go from this destination, and
                            the work rules that apply there. */}
                        {row.careerOpportunities?.trim() ? (
                          <>
                            <p className="entrycard__label">
                              <span className="label">After graduating</span>
                            </p>
                            <p className="entrycard__note">
                              {row.careerOpportunities}
                            </p>
                          </>
                        ) : null}

                        {row.sourceReference ? (
                          <p className="entrycard__src">
                            <a
                              href={row.sourceReference}
                              rel="nofollow noopener"
                              target="_blank"
                            >
                              The university&rsquo;s own page for this programme
                            </a>
                            {dateLabel(row.verifiedAt)
                              ? `, checked ${dateLabel(row.verifiedAt)}`
                              : null}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* The application process as the design's numbered steps on
          navy; saved as text, as text in the right-hand column. */}
      {apply ? (
        <section
          className={steps.length ? 'sec sec--navy cg-band' : `${band('apply')} cg-band`}
          id="apply"
        >
          <div className="wrap">
            <SectionHead
              n={n('apply')}
              eyebrow="Applying"
              title={apply.heading?.trim() || 'How to apply'}
              lead={apply.subheading?.trim() || undefined}
            >
              {steps.length ? null : <SectionProse section={apply} />}
              <SectionMedia media={apply.media} />
            </SectionHead>
            {steps.length ? (
              <ol
                className={`applysteps cg-steps${steps.length > 5 ? ' cg-steps--rows' : ''}`}
                style={
                  {
                    '--cg-steps': steps.length > 5 ? Math.ceil(steps.length / 2) : steps.length,
                  } as CSSProperties
                }
              >
                {steps.map((step, index) => (
                  <li className="applystep" key={`${index}-${step}`}>
                    <span className="applystep__n">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="applystep__b">{step}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('funding')} id="funding">
          <div className="wrap">
            <SectionHead
              n={n('funding')}
              eyebrow="Funding"
              title={`Scholarships for ${course.name}`}
              lead={`${scholarships.length} ${scholarships.length === 1 ? 'award is' : 'awards are'} recorded against this programme at the universities that teach it. ${FUNDING_CAVEAT}`}
            />
            <ScholarshipCards scholarships={scholarships} />
          </div>
        </section>
      ) : null}

      {/* The careers prose beside the heading, and the career outcomes
          an editor listed as the design's numbered roles under it. */}
      {careers || outcomes ? (
        <section className={`${band('careers')} cg-band`} id="careers">
          <div className="wrap">
            <SectionHead
              n={n('careers')}
              eyebrow="Careers"
              title={outcomes?.heading?.trim() || 'Where it leads'}
              lead={outcomes?.subheading?.trim() || undefined}
            >
              {careers ? (
                <div className="prose">
                  <RichText value={careers} />
                </div>
              ) : null}
              {outcomes && !outcomeItems.length ? (
                <SectionProse section={outcomes} />
              ) : null}
              <SectionMedia media={outcomes?.media} />
            </SectionHead>
            <CareerList
              items={outcomeItems}
              label={outcomes?.heading?.trim() || 'Career outcomes'}
            />
          </div>
        </section>
      ) : null}

      {faqs.length ? (
        <section className={band('faqs')} id="faqs">
          <div className="wrap">
            <SectionHead
              n={n('faqs')}
              eyebrow="Questions"
              title={`Straight answers about ${course.name}`}
            />
            <div className="faq">
              {faqs.map((faq) => (
                <details className="faq__item" key={faq.id}>
                  <summary className="faq__q">
                    {faq.question}
                    <span className="faq__plus" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="faq__a prose">
                    <RichText value={faq.answer} />
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className={band('similar')} id="similar">
          <div className="wrap">
            <SectionHead
              n={n('similar')}
              eyebrow="Similar"
              title="Programmes like this one"
            />
            <CourseCards courses={related} />
          </div>
        </section>
      ) : null}

      <MatchBand
        heading={`Interested in ${course.name}?`}
        href={subjectSlug ? `/courses?subject=${subjectSlug}` : '/courses'}
      />

      <PlanBand
        heading={counselling?.heading?.trim() || 'Not sure this is the right programme?'}
        body={
          ctaBody ||
          "Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        }
        secondary={{ href: '/courses', label: 'Browse all courses' }}
      />

      <ConnectBand
        actions={[
          { href: '/courses', label: 'Explore courses' },
          ...(subjectSlug
            ? [
                {
                  href: `/subjects/${subjectSlug}`,
                  label: `More ${course.subject!.name}`,
                  ghost: true,
                },
              ]
            : []),
          { href: '/contact', label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Destinations',
            items: availability.map((row) => ({
              id: row.id,
              name: row.country.name,
              href: `/study-abroad/${row.country.slug}`,
            })),
          },
          {
            title: 'Similar programmes',
            items: related.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/courses/${row.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
