import Link from 'next/link';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { StudentCatalogueActions } from '@/components/student/StudentCatalogueActions';
import { counsellingHref } from '@/lib/counselling-link';
import { inCountry } from '@/lib/country-article';
import { jsonLdString } from '@/lib/json-ld';
import {
  groupRequirements,
  teachingLanguage,
  type OfferingDetail,
} from '@/lib/offering-detail';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { dateLabel, humanise, place } from '@/lib/university-courses';
import { breadcrumbJsonLd, faqJsonLd, type Crumb } from '@/lib/university-json-ld';
import {
  countryUniversitiesHref,
  universityCoursesHref,
  universityHref,
} from '@/lib/university-links';
import type { UniversityDestination } from './UniversityGuide';
import { Crumbs } from './Crumbs';
import { CompareButton, CompareTray } from './CourseCompare';
import { ConnectBand } from './DiscoveryBands';
import { FlagMark } from './FlagMark';
import { CourseSticky, EligibilityButton } from './OfferingActions';
import { OfferingCard } from './OfferingCard';
import { PlanBand } from './PlanBand';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import { SectionHead } from './SectionHead';
import { universityInitials } from '@/lib/university-initials';
import { countryConsultantsHref } from '@/lib/country-consultant-list';

/**
 * One course at one university, at
 * /study-abroad/<country>/universities/<university>/courses/<course>.
 *
 * The look is the design's course page: a split hero with an "At a glance"
 * panel, a sticky strip of section tabs, and full-width numbered bands --
 * overview, the admissions grid, the navy "How to apply" steps -- ending in
 * the university's other courses and similar ones as course cards.
 *
 * The behaviour is the reference's: Fees, Intakes and Eligibility are
 * always there, and where the catalogue records nothing they say so and
 * point at the university's own page or a counsellor rather than vanishing.
 * Every row of the panel is always listed, "Not listed" when empty. And the
 * page ends with the same course at other universities, each linking to
 * that university's own version of it.
 *
 * Nothing is invented to fill a gap. The design's curriculum lists modules
 * this catalogue does not keep per course, so its "What will you study?"
 * section is drawn the way the design draws a course without them: it says
 * the structure is not in our data and points to the official page. The
 * design's document checklist reads records the catalogue does not keep
 * either, and is not drawn. Its course FAQ is drawn from the questions
 * editors wrote for the course, and only when there are some.
 */

const NOT_LISTED = 'Not listed';

export type OfferingFaq = { id: string; question: string; answer: string };

export function OfferingGuide({
  detail,
  scholarships = [],
  scholarshipScope = 'course',
  destination = null,
  faqs = [],
  today = new Date(),
}: {
  detail: OfferingDetail;
  scholarships?: ScholarshipCard[];
  /** Whether the awards are recorded against this course or, failing that,
   *  against the university as a whole -- the heading says which. */
  scholarshipScope?: 'course' | 'university';
  /** The destination guide's parts this page links into, when it loaded:
   *  the sections it renders and the consultants who cover it. */
  destination?: UniversityDestination | null;
  /** The questions editors wrote for the course this one is an instance of. */
  faqs?: OfferingFaq[];
  today?: Date;
}) {
  const { card, university } = detail;
  const { country } = university;
  const listHref = universityCoursesHref(country.slug, university.slug);
  /* Each link into the destination's guide lands on the section it names,
     and only when the guide renders that section; otherwise on the guide
     itself rather than on an anchor that is not there. Without the guide
     to ask, the work-rights link keeps the anchor it always had. */
  const guideHref = `/study-abroad/${country.slug}`;
  const guideLink = (key: string) =>
    destination?.links.find((link) => link.key === key)?.href ?? null;
  const visaHref = guideLink('visa') ?? guideHref;
  const costHref = destination?.costHref ?? guideHref;
  const workHref = destination
    ? (guideLink('work-visa') ?? guideHref)
    : `${guideHref}#work-visa`;
  const consultants = destination?.consultants?.total
    ? destination.consultants
    : null;
  /* The destination's own consultants page, which also reads ?city=. */
  const consultantsHref = countryConsultantsHref(country.slug);
  const where = place(university.city, country);
  /* The country inside a sentence -- "Studying in the United Kingdom" --
     where a label or a breadcrumb keeps the bare name. */
  const inWhere = inCountry(country.name, country.iso2Code);
  /* The assessment files its lead under this page, so the counsellor knows
     which course the student was reading. The lead's form takes a path of
     at most 255 characters; a course address longer than that falls back
     to the university's course list rather than losing the lead. */
  const leadPath = card.href.length <= 255 ? card.href : listHref;
  const counselling = counsellingHref({
    source: detail.courseSlug ? 'course' : 'country',
    course: detail.courseSlug ?? undefined,
    country: country.slug,
    subject: card.subject?.slug,
    specialization: card.specialization?.slug,
    from: card.href,
  });
  /* The course's own application page first, then the university's site,
     then wherever the record was taken from. */
  const official = detail.applicationUrl
    ? { href: detail.applicationUrl, label: 'Apply on the university site' }
    : university.websiteUrl
      ? { href: university.websiteUrl, label: 'Official university website' }
      : detail.sourceReference
        ? { href: detail.sourceReference, label: 'The university’s course page' }
        : null;
  /* For the modules, the course's own page before the university's site:
     that is where a module list lives. */
  const modulesPage = detail.sourceReference ?? detail.applicationUrl;
  const modulesSource = modulesPage
    ? { href: modulesPage, label: 'Official course page', named: 'the official course page' }
    : university.websiteUrl
      ? {
          href: university.websiteUrl,
          label: 'Official university website',
          named: 'the official university website',
        }
      : null;

  /* The next deadline still to come; failing that, the last one recorded,
     marked as passed rather than presented as open. */
  const floor = today.toISOString().slice(0, 10);
  const deadlines = detail.intakes
    .map((intake) => intake.deadline)
    .filter((value): value is string => Boolean(value))
    .sort();
  const upcoming = deadlines.find((value) => value >= floor) ?? null;
  const lastPassed = deadlines.length ? deadlines[deadlines.length - 1]! : null;
  const deadline = upcoming
    ? dateLabel(upcoming)
    : lastPassed
      ? `${dateLabel(lastPassed)} (passed)`
      : null;
  const starts = [
    ...new Set(detail.intakes.map((intake) => intake.start).filter(Boolean)),
  ].join(', ');

  const requirements = groupRequirements(detail.requirements);
  const overview = detail.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview).trim());
  const careers = detail.careerSummary?.trim();
  const language = teachingLanguage(detail.requirements);
  const questions = faqs.filter(
    (faq) => faq.question.trim() && richTextToPlainText(faq.answer).trim(),
  );

  /* The tabs and the numbers both come from the bands that render. The
     questions follow the careers band, where the design puts them. */
  const numbered: Array<[string, string]> = [
    ['overview', 'Overview'],
    ['curriculum', 'Curriculum'],
    ['fees', 'Fees'],
    ['intakes', 'Intakes'],
    ['eligibility', 'Eligibility'],
    ['apply', 'How to apply'],
  ];
  if (scholarships.length) numbered.push(['scholarships', 'Scholarships']);
  if (careers) numbered.push(['careers', 'Careers']);
  if (questions.length) numbered.push(['faqs', 'FAQs']);
  numbered.push(['university', 'University']);
  const discovery: Array<[string, string]> = [];
  if (detail.more.rows.length) discovery.push(['more', 'More courses']);
  if (detail.related.length) discovery.push(['similar', 'Similar']);
  if (detail.elsewhere.length) discovery.push(['elsewhere', 'Other universities']);
  const tabs = [...numbered, ...discovery];
  const ids = tabs.map(([id]) => id);
  const n = (id: string) => {
    const index = numbered.findIndex(([entry]) => entry === id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    `sec ${ids.indexOf(id) % 2 === 0 ? 'sec--white' : 'sec--paper'}`;

  const pointer = (what: string) => (
    <p className="uc-missing">
      {what} {official ? (
        <>
          <a href={official.href} rel="nofollow noopener" target="_blank">
            Check the official course page &#8599;
          </a>{' '}
          or <Link href={counselling}>talk to a counsellor</Link>.
        </>
      ) : (
        <>
          <Link href={counselling}>Talk to a counsellor</Link>, who can confirm
          it with the university.
        </>
      )}
    </p>
  );

  const glance = [
    {
      label: 'Degree',
      value: card.level?.name ?? null,
      note: card.qualification,
    },
    { label: 'Duration', value: card.duration, note: card.studyMode },
    /* Named only on the course's own evidence, an English test it asks
       for; never borrowed from the country. */
    {
      label: 'Language',
      value: language?.value ?? null,
      note: language?.note ?? null,
    },
    {
      label: 'Tuition',
      value: card.tuition,
      note: card.tuition ? detail.tuitionPeriod : null,
    },
    {
      label: detail.intakes.length > 1 ? 'Intakes' : 'Intake',
      value: card.intakes.join(' · ') || null,
      note: starts ? `Classes begin ${starts}` : null,
    },
    { label: 'Application deadline', value: deadline, note: null },
    { label: 'Location', value: where, note: card.campus?.name ?? null },
  ];

  const keyFacts = [
    { label: 'Level', value: card.level?.name ?? null },
    { label: 'Duration', value: card.duration },
    { label: 'Tuition', value: card.tuition },
    { label: 'Study mode', value: card.studyMode },
    { label: 'Campus', value: card.campus?.name ?? null },
    { label: 'Course code', value: card.courseCode },
  ];

  /* The structured data reads the trail the page draws and the questions
     it shows; the course itself is described by the route. */
  const trail: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: 'Study abroad', href: '/study-abroad' },
    { label: country.name, href: `/study-abroad/${country.slug}` },
    { label: 'Universities', href: countryUniversitiesHref(country.slug) },
    { label: university.name, href: universityHref(university.slug) },
    { label: 'Courses', href: listHref },
    { label: card.name },
  ];
  const structured = [
    breadcrumbJsonLd(trail, card.href),
    faqJsonLd(
      questions.map((faq) => ({
        question: faq.question,
        answer: richTextToPlainText(faq.answer),
      })),
    ),
  ].filter((data): data is Record<string, unknown> => Boolean(data));

  return (
    <>
      {structured.map((data) => (
        <script
          key={String(data['@type'])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
        />
      ))}

      <section className="hero hero--compact coursehero" id="course-hero">
        <div className="wrap">
          <Crumbs trail={trail} />

          <div className="coursehero__grid">
            <div className="coursehero__main">
              <p className="hero__eyebrow">
                {[card.level?.name ?? 'Programme', card.qualification, card.studyMode]
                  .filter(Boolean)
                  .map((part, index) => (
                    <span key={part}>
                      {index ? <b>·</b> : null}
                      {part}
                    </span>
                  ))}
              </p>
              <h1 className="coursehero__name">{card.name}</h1>

              <Link className="coursehero__uni" href={universityHref(university.slug)}>
                <span className="unimark" aria-hidden="true">
                  {universityInitials(university.name)}
                </span>
                <span>
                  <b>{university.name}</b>
                  <em>
                    <FlagMark iso2Code={country.iso2Code} bands={null} />
                    {where}
                  </em>
                </span>
              </Link>

              {card.subject ? (
                <div className="topicpath" aria-label="Where this course sits">
                  <Link
                    className="topicpath__item"
                    href={`/subjects/${card.subject.slug}`}
                  >
                    <span className="label">Subject</span>
                    <span>
                      {card.subject.name} <span aria-hidden="true">&rarr;</span>
                    </span>
                  </Link>
                  {card.specialization ? (
                    <Link
                      className="topicpath__item"
                      href={`/subjects/${card.subject.slug}/${card.specialization.slug}`}
                    >
                      <span className="label">Specialization</span>
                      <span>
                        {card.specialization.name}{' '}
                        <span aria-hidden="true">&rarr;</span>
                      </span>
                    </Link>
                  ) : null}
                  <Link
                    className="topicpath__item"
                    href={`/study-abroad/${country.slug}/${card.subject.slug}`}
                  >
                    <span className="label">In {inWhere}</span>
                    <span>
                      {card.subject.name} <span aria-hidden="true">&rarr;</span>
                    </span>
                  </Link>
                </div>
              ) : null}

              <div className="btn-row uc-hero-actions">
                <a className="btn btn--lg" href="#eligibility">
                  Check my eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
                {official ? (
                  <a
                    className="btn btn--lg btn--ghost"
                    href={official.href}
                    rel="nofollow noopener"
                    target="_blank"
                  >
                    {official.label}{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &#8599;
                    </span>
                  </a>
                ) : null}
                <Link className="btn btn--lg btn--ghost" href={counselling}>
                  Talk to a counsellor
                </Link>
              </div>
              <div className="btn-row uc-hero-tools">
                <StudentCatalogueActions
                  kind="offerings"
                  entityId={card.id}
                  offeringId={card.id}
                  variant="heart"
                />
                <CompareButton
                  item={{ slug: card.slug, name: `${card.name} · ${university.name}` }}
                />
              </div>
            </div>

            <aside className="snap coursefacts" aria-label="Course facts">
              <div className="snap__head">
                <span className="snap__title">At a glance</span>
                {detail.verifiedAt ? (
                  <span className="badge badge--ok">Verified</span>
                ) : (
                  <span className="badge badge--cond">Needs verification</span>
                )}
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
                {detail.sourceReference ? (
                  <p className="snap__source">
                    Source:{' '}
                    <a
                      href={detail.sourceReference}
                      rel="nofollow noopener"
                      target="_blank"
                    >
                      the university&rsquo;s own listing &#8599;
                    </a>
                    {dateLabel(detail.verifiedAt)
                      ? `, checked ${dateLabel(detail.verifiedAt)}`
                      : ''}
                    .
                  </p>
                ) : null}
                <p className="snap__disclaimer">
                  {dateLabel(detail.updatedAt)
                    ? `Last updated ${dateLabel(detail.updatedAt)}. `
                    : ''}
                  Fees and deadlines change every cycle &mdash; confirm on the
                  official course page before applying.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* `unitabs--sections` is what gives the sections below their offset,
          so a link here lands each one under the sticky header and this
          strip rather than behind them; the hero's #eligibility link too. */}
      <nav className="unitabs unitabs--sections" aria-label="Course sections">
        <div className="wrap unitabs__inner">
          {tabs.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section className={band('overview')} id="overview">
        <div className="wrap">
          <SectionHead
            n={n('overview')}
            eyebrow="Overview"
            title="About this programme"
            lead={detail.shortDescription ?? undefined}
          >
            <div className="btn-row uc-links">
              <Link className="linkcta" href={listHref}>
                View all {detail.more.total > 1 ? `${detail.more.total} ` : ''}
                courses at {university.name}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
                Studying in {inWhere}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              {card.subject ? (
                <Link className="linkcta" href={`/subjects/${card.subject.slug}`}>
                  Explore {card.subject.name}
                  {card.specialization ? ` · ${card.specialization.name}` : ''}{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ) : null}
            </div>
          </SectionHead>
          {hasOverview ? (
            <div className="prose">
              <RichText value={overview!} />
            </div>
          ) : (
            pointer(`${university.name} has not published a description of this course in our catalogue yet.`)
          )}
          <h3 className="uc-subhead">Key facts</h3>
          <div className="unisnap uc-keyfacts">
            {keyFacts.map((fact) => (
              <div className="unisnap__cell" key={fact.label}>
                <span className="label">{fact.label}</span>
                <b className={fact.value ? undefined : 'uc-none'}>
                  {fact.value ?? NOT_LISTED}
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The design's module list, for a course without one: what it says
          then, with the way to the page that does have it. */}
      <section className={`${band('curriculum')} uc-curriculum`} id="curriculum">
        <div className="wrap">
          <SectionHead n={n('curriculum')} eyebrow="Curriculum" title="What will you study?">
            <p className="modnote uc-modnote">
              A semester-by-semester structure is not in our data for this course.{' '}
              {modulesSource ? (
                <>
                  Check {modulesSource.named} for the current module sequence.{' '}
                  <a href={modulesSource.href} rel="nofollow noopener" target="_blank">
                    {`${modulesSource.label} ↗`}
                  </a>
                </>
              ) : (
                <>
                  <Link href={counselling}>Talk to a counsellor</Link>, who can
                  confirm the modules with the university.
                </>
              )}
            </p>
          </SectionHead>
        </div>
      </section>

      <section className={band('fees')} id="fees">
        <div className="wrap">
          <SectionHead
            n={n('fees')}
            eyebrow="Fees"
            title="Tuition and cost"
            lead="What the catalogue records for international students. Living costs are set by the destination and live on its guide."
          />
          {card.tuition ? (
            <>
              <dl className="eligrid">
                <div className="eligrid__row">
                  <dt>Tuition</dt>
                  <dd>
                    <span className="datum">{card.tuition}</span>
                  </dd>
                </div>
                <div className="eligrid__row">
                  <dt>Charged</dt>
                  <dd>
                    <span>{detail.tuitionPeriod ?? NOT_LISTED}</span>
                  </dd>
                </div>
                <div className="eligrid__row">
                  <dt>Currency</dt>
                  <dd>
                    <span>{detail.currencyCode ?? NOT_LISTED}</span>
                  </dd>
                </div>
              </dl>
              <p className="uc-note">
                Published figure
                {dateLabel(detail.verifiedAt)
                  ? `, verified ${dateLabel(detail.verifiedAt)}`
                  : ''}
                . Confirm the exact fee with {university.name} before you apply.
              </p>
            </>
          ) : (
            pointer('Fee information for this course is not listed yet.')
          )}
          <p className="uc-note">
            {/* The guide's cost section when it has one, which is where its
                living costs are. */}
            <Link href={costHref}>
              {/* One string: the compiler drops the space before an entity
                  that follows an expression. */}
              {`Living costs and visa fees in ${inWhere} →`}
            </Link>
          </p>
        </div>
      </section>

      <section className={band('intakes')} id="intakes">
        <div className="wrap">
          <SectionHead
            n={n('intakes')}
            eyebrow="Intakes"
            title="Intakes and deadlines"
            lead="Deadlines are set per course and move between cycles, so check the one you are applying to."
          />
          <table className="entrytable uc-intakes">
            <caption className="sr-only">
              Intakes and application deadlines for {card.name}
            </caption>
            <thead>
              <tr>
                <th scope="col">Intake</th>
                <th scope="col">Application deadline</th>
                <th scope="col">Course start</th>
              </tr>
            </thead>
            <tbody>
              {detail.intakes.length ? (
                detail.intakes.map((intake) => (
                  <tr key={`${intake.label}-${intake.deadline ?? ''}`}>
                    <th scope="row">{intake.label}</th>
                    <td>
                      {dateLabel(intake.deadline) ?? NOT_LISTED}
                      {intake.notes ? (
                        <span className="entrytable__note">{intake.notes}</span>
                      ) : null}
                    </td>
                    <td>{intake.start ?? NOT_LISTED}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <th scope="row">{NOT_LISTED}</th>
                  <td>{NOT_LISTED}</td>
                  <td>{NOT_LISTED}</td>
                </tr>
              )}
            </tbody>
          </table>
          {detail.intakes.length
            ? null
            : pointer('Intakes for this course have not been listed yet.')}
        </div>
      </section>

      <section className={band('eligibility')} id="eligibility">
        <div className="wrap">
          <SectionHead
            n={n('eligibility')}
            eyebrow="Eligibility"
            title="Entry requirements"
            lead={
              detail.requirements.length ? (
                <>
                  These apply to this course specifically. <b>Required</b> means
                  the course states it.
                </>
              ) : undefined
            }
          />
          {detail.requirements.length
            ? null
            : pointer('Entry requirements for this course have not been listed yet.')}
          <div className="admgrid">
            <div className="admgrid__col">
              <p className="path__h">Academic requirements</p>
              {requirements.academic.length ? (
                <dl className="eligrid">
                  {requirements.academic.map((requirement) => (
                    <div className="eligrid__row" key={requirement.title}>
                      <dt>{requirement.title}</dt>
                      <dd>
                        <span>
                          {[
                            requirement.description,
                            requirement.minimumScore
                              ? `Minimum ${requirement.minimumScore}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Stated by the course'}
                        </span>
                        <span className="badge badge--req">Required</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="path__note">{NOT_LISTED} for this course.</p>
              )}
            </div>
            <div className="admgrid__col">
              <p className="path__h">Language requirements</p>
              {requirements.language.length ? (
                <ul className="reqlist">
                  {requirements.language.map((requirement) => (
                    <li key={requirement.title}>
                      <span>
                        {requirement.title}
                        <em>
                          {[
                            requirement.minimumScore
                              ? `Minimum ${requirement.minimumScore}`
                              : null,
                            requirement.description,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Score not stated'}
                        </em>
                      </span>
                      <span className="badge badge--req">Required</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="path__note">{NOT_LISTED} for this course.</p>
              )}
              {requirements.other.length ? (
                <>
                  <p className="path__h uc-gap">Other requirements</p>
                  <ul className="reqlist">
                    {requirements.other.map((requirement) => (
                      <li key={requirement.title}>
                        <span>
                          {requirement.title}
                          {requirement.description || requirement.minimumScore ? (
                            <em>
                              {[
                                requirement.description,
                                requirement.minimumScore
                                  ? `Minimum ${requirement.minimumScore}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </em>
                          ) : null}
                        </span>
                        <span className="badge badge--neutral">
                          {humanise(requirement.category)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
          <div className="btn-row uc-gap">
            <EligibilityButton
              className="btn btn--lg"
              intent="course-eligibility"
              countrySlug={country.slug}
              countryName={country.name}
              sourcePagePath={leadPath}
            >
              Check my eligibility for this course
            </EligibilityButton>
          </div>
        </div>
      </section>

      <section className="sec sec--navy" id="apply">
        <div className="wrap">
          <SectionHead
            n={n('apply')}
            eyebrow="Application"
            title="How to apply"
            lead="The sequence for this course. The deadline below is the one in our data. Universities move deadlines between cycles, so confirm it before you plan backwards from it."
          />
          <ol className="applysteps">
            <li className="applystep">
              <span className="applystep__n">01</span>
              <h3 className="applystep__t">Check eligibility</h3>
              <p className="applystep__b">
                Compare your degree, grades and language score against{' '}
                <a href="#eligibility">the requirements above</a>.
              </p>
            </li>
            <li className="applystep">
              <span className="applystep__n">02</span>
              <h3 className="applystep__t">Prepare documents</h3>
              <p className="applystep__b">
                Transcripts, a language test result and your passport, with
                certified translations where the university asks for them.
              </p>
            </li>
            <li className="applystep">
              <span className="applystep__n">03</span>
              <h3 className="applystep__t">Submit application</h3>
              <p className="applystep__b">
                {upcoming ? (
                  <>
                    Before <b>{dateLabel(upcoming)}</b>.
                  </>
                ) : (
                  <>
                    Before the deadline, which is <b>not listed yet</b> for this
                    course.
                  </>
                )}
              </p>
            </li>
            <li className="applystep">
              <span className="applystep__n">04</span>
              <h3 className="applystep__t">Wait for decision</h3>
              <p className="applystep__b">
                Respond to any interview, assessment or document request inside
                the stated window.
              </p>
            </li>
            <li className="applystep">
              <span className="applystep__n">05</span>
              <h3 className="applystep__t">Prepare visa</h3>
              <p className="applystep__b">
                Start the student visa file the day your admission letter
                arrives.{' '}
                {/* The guide's student-visa section, not its work-rights
                    one: this step is the visa to study. */}
                <Link href={visaHref}>{`${country.name} visa steps →`}</Link>
              </p>
            </li>
          </ol>
          <div className="applyfoot">
            <div>
              <p className="label">Application deadline</p>
              <p className="applyfoot__v">{deadline ?? NOT_LISTED}</p>
            </div>
            {official ? (
              <a
                className="btn btn--onnavy btn--lg"
                href={official.href}
                rel="nofollow noopener"
                target="_blank"
              >
                {official.label}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            ) : (
              <Link className="btn btn--onnavy btn--lg" href={counselling}>
                Talk to a counsellor{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {scholarships.length ? (
        <section className={band('scholarships')} id="scholarships">
          <div className="wrap">
            <SectionHead
              n={n('scholarships')}
              eyebrow="Funding"
              title={
                scholarshipScope === 'course'
                  ? 'Scholarships for this course'
                  : `Scholarships at ${university.name}`
              }
              lead={FUNDING_CAVEAT}
            />
            <ScholarshipCards scholarships={scholarships} showCountries={false} />
          </div>
        </section>
      ) : null}

      {/* The design's consultants slot: the destination's consultants and
          the cities they are in, beside the counselling Universta offers
          itself. One band, so the course page does not stack two of them;
          the consultants appear only when the destination has some. */}
      <section className="sec sec--white sec--tight" id="talk">
        <div className="wrap">
          <div className="consultcta">
            <div className="consultcta__copy">
              <p className="eyebrow eyebrow--plain">Talk it through</p>
              <h2 className="consultcta__t">
                Not sure you meet the requirements?
              </h2>
              <p className="consultcta__d">
                A counsellor can check your profile against this course&rsquo;s
                requirements and help you plan the application.
                {consultants
                  ? consultants.total === 1
                    ? ` One consultant on Universta supports students planning to study in ${inWhere}.`
                    : ` ${consultants.total} consultants on Universta support students planning to study in ${inWhere}.`
                  : null}
              </p>
              {consultants?.cities.length ? (
                <p className="citychips">
                  <span className="label">Near you</span>
                  {consultants.cities.map((entry) => (
                    <Link
                      className="specchip"
                      key={entry.city}
                      href={`${consultantsHref}?city=${encodeURIComponent(entry.city)}`}
                    >
                      {entry.city}
                      <em>{entry.count}</em>
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
            <div className="consultcta__actions">
              {consultants ? (
                <Link className="btn" href={consultantsHref}>
                  Find {country.name} consultants{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ) : null}
              <Link
                className={consultants ? 'btn btn--ghost' : 'btn'}
                href={counselling}
              >
                Book free counselling{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {careers ? (
        <section className={band('careers')} id="careers">
          <div className="wrap">
            <SectionHead
              n={n('careers')}
              eyebrow="Careers"
              title="Where can this course take you?"
              lead="Roles graduates of this kind of programme commonly move into. These are directions, not promises: no salary or employment figure is published here without a verified source."
            />
            <div className="prose">
              <RichText value={careers} />
            </div>
            <div className="btn-row uc-gap">
              <Link className="linkcta" href={workHref}>
                Post-study work rights in {inWhere}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {questions.length ? (
        <section className={band('faqs')} id="faqs">
          <div className="wrap">
            <SectionHead
              n={n('faqs')}
              eyebrow="Questions"
              title="About this course"
              lead="Questions specific to this programme rather than to the university as a whole."
            />
            <div className="faq">
              {questions.map((faq, index) => (
                <details className="faq__item" key={faq.id} open={index === 0}>
                  <summary className="faq__q">
                    <span>{faq.question}</span>
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

      <section className={band('university')} id="university">
        <div className="wrap">
          <SectionHead
            n={n('university')}
            eyebrow="University"
            title={`About ${university.name}`}
          />
          <div className="unisnap uc-unifacts">
            <div className="unisnap__cell">
              <span className="label">Location</span>
              <b className={university.city ? undefined : 'uc-none'}>
                {university.city ?? NOT_LISTED}
              </b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Country</span>
              <b>
                <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
              </b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Type</span>
              <b className={university.institutionType ? undefined : 'uc-none'}>
                {university.institutionType
                  ? humanise(university.institutionType)
                  : NOT_LISTED}
              </b>
            </div>
            <div className="unisnap__cell">
              <span className="label">QS ranking</span>
              <b className={university.qsRanking ? undefined : 'uc-none'}>
                {university.qsRanking ? `#${university.qsRanking}` : NOT_LISTED}
              </b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Courses here</span>
              <b>
                <Link href={listHref}>{detail.more.total || 1}</Link>
              </b>
            </div>
          </div>
          <div className="btn-row uc-gap">
            <Link className="btn" href={universityHref(university.slug)}>
              University profile{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
            {university.websiteUrl ? (
              <a
                className="btn btn--ghost"
                href={university.websiteUrl}
                rel="nofollow noopener"
                target="_blank"
              >
                Official website{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            ) : null}
            <Link className="btn btn--ghost" href={countryUniversitiesHref(country.slug)}>
              Universities in {inWhere}
            </Link>
          </div>
        </div>
      </section>

      {detail.more.rows.length ? (
        <section className={`${band('more')} sec--tight`} id="more">
          <div className="wrap">
            <div className="sec-head uc-plainhead">
              <div>
                <p className="eyebrow">Same university</p>
                <h2 className="sec-title">More courses at {university.name}</h2>
              </div>
            </div>
            <div className="courselist">
              {detail.more.rows.map((row) => (
                <Link className="courselist__row" href={row.href} key={row.slug}>
                  <span className="courselist__name">{row.name}</span>
                  <span className="courselist__meta">
                    {[row.level?.name, row.duration, row.studyMode]
                      .filter(Boolean)
                      .join(' · ') || NOT_LISTED}
                  </span>
                  <span className="courselist__fee datum">
                    {row.tuition ?? 'Fee not listed'}
                  </span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>
            <div className="btn-row uc-gap">
              <Link className="linkcta" href={listHref}>
                View all {detail.more.total} courses at {university.name}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {detail.related.length ? (
        <section className={band('similar')} id="similar">
          <div className="wrap">
            <SectionHead
              eyebrow="Recommended"
              title="Similar programmes you may like"
              lead={`The same subject at ${university.name} first, then at other universities.`}
            >
              <div className="btn-row uc-links">
                <Link className="linkcta" href="/compare/courses">
                  Compare programmes{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
                <Link
                  className="linkcta"
                  href={card.subject ? `/courses?subject=${card.subject.slug}` : '/courses'}
                >
                  Search all courses{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </div>
            </SectionHead>
            <div className="coursegrid coursegrid--3">
              {detail.related.map((row) => (
                <OfferingCard key={row.slug} course={row} show="university" />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {detail.elsewhere.length ? (
        <section className={band('elsewhere')} id="elsewhere">
          <div className="wrap">
            <SectionHead
              eyebrow="Same course"
              title="Other universities offering this course"
              lead="Each opens that university's own version of the course, with its own fees, intakes and entry requirements."
            />
            <div className="unigrid uc-elsewhere">
              {detail.elsewhere.map((row) => (
                <article className="unicard" key={row.slug}>
                  <div className="unicard__head">
                    <span className="unimark" aria-hidden="true">
                      {universityInitials(row.university.name)}
                    </span>
                    <div className="unicard__id">
                      <h3 className="unicard__name">
                        <Link href={row.university.href}>{row.university.name}</Link>
                      </h3>
                      <p className="unicard__where">
                        <FlagMark
                          iso2Code={row.university.country?.iso2Code ?? null}
                          bands={null}
                        />
                        {row.university.location}
                      </p>
                    </div>
                  </div>
                  <dl className="unicard__stats">
                    <div>
                      <dt>Tuition</dt>
                      <dd className={row.tuition ? undefined : 'uc-none'}>
                        {row.tuition ?? NOT_LISTED}
                      </dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd className={row.duration ? undefined : 'uc-none'}>
                        {row.duration ?? NOT_LISTED}
                      </dd>
                    </div>
                    <div>
                      <dt>{row.intakes.length > 1 ? 'Intakes' : 'Intake'}</dt>
                      <dd className={row.intakes.length ? undefined : 'uc-none'}>
                        {row.intakes.join(' · ') || NOT_LISTED}
                      </dd>
                    </div>
                    <div>
                      <dt>Course</dt>
                      <dd>{row.name}</dd>
                    </div>
                  </dl>
                  <div className="unicard__foot">
                    <Link className="btn btn--sm" href={row.href}>
                      View this course{' '}
                      <span className="btn__arrow" aria-hidden="true">
                        &rarr;
                      </span>
                    </Link>
                    <Link className="btn btn--sm btn--ghost" href={row.university.href}>
                      University profile
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <PlanBand
        heading="Ready to apply?"
        body="Check the intake deadline and entry requirements above, then talk it through with a counsellor before you submit."
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: counselling, label: 'Book free counselling' }}
      />

      <ConnectBand
        actions={[
          { href: listHref, label: `All courses at ${university.name}` },
          { href: universityHref(university.slug), label: 'University profile', ghost: true },
          {
            href: countryUniversitiesHref(country.slug),
            label: `Universities in ${inWhere}`,
            ghost: true,
          },
          { href: `/study-abroad/${country.slug}`, label: `Study in ${inWhere}`, ghost: true },
        ]}
        groups={[
          /* Each group says how many there are in all, not how many it
             lists: the university's other courses, and every other
             university that teaches this one. */
          {
            title: `More at ${university.name}`,
            items: detail.more.rows.map((row) => ({
              id: row.slug,
              name: row.name,
              href: row.href,
            })),
            total: Math.max(detail.more.total - 1, detail.more.rows.length),
          },
          {
            title: 'This course elsewhere',
            items: detail.elsewhere.map((row) => ({
              id: row.slug,
              name: row.university.name,
              href: row.href,
            })),
            total: detail.elsewhereTotal,
          },
        ]}
      />

      {/* The tray first: while it is open the sticky bar after it stands
          down, rather than the two stacking over the page's foot. */}
      <CompareTray />
      <CourseSticky
        mark={universityInitials(university.name)}
        name={card.name}
        university={university.name}
        countrySlug={country.slug}
        countryName={country.name}
        sourcePagePath={leadPath}
        after="course-hero"
      />
    </>
  );
}
