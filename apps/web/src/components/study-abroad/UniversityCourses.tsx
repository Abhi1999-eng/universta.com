import Link from 'next/link';
import { counsellingHref } from '@/lib/counselling-link';
import { inCountry } from '@/lib/country-article';
import { jsonLdString } from '@/lib/json-ld';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import {
  courseListSearch,
  dateLabel,
  type CountryRef,
  type CourseFacets,
  type CourseFilters,
  type OfferingCardData,
} from '@/lib/university-courses';
import { breadcrumbJsonLd, faqJsonLd, type Crumb } from '@/lib/university-json-ld';
import {
  countryUniversitiesHref,
  universityCoursesHref,
  universityHref,
} from '@/lib/university-links';
import { Crumbs } from './Crumbs';
import { CompareTray } from './CourseCompare';
import { ConnectBand } from './DiscoveryBands';
import { FlagMark } from './FlagMark';
import { PlanBand } from './PlanBand';
import { countLabel, RowCard } from './RowCard';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import { SectionHead } from './SectionHead';
import { UniversityCourseResults } from './UniversityCourseResults';
import { universityInitials } from '@/lib/university-initials';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';

/**
 * Every course one university teaches, filed under its country at
 * /study-abroad/<country>/universities/<university>/courses.
 *
 * The design has no page of its own for this: a university's courses are the
 * results block inside its profile. The behaviour reference gives them one,
 * reached from the profile's "View all courses", with the country in its
 * breadcrumb. So this is the reference's page built from the design's parts:
 * the compact head and figure strip of a course listing, the results block,
 * and the guide's numbered bands for the ways in by level, by subject and by
 * intake, the university's scholarships and the questions a student asks.
 *
 * A university with no course in the catalogue says so, and points to its
 * own website and to a counsellor, instead of a filter panel over nothing.
 */

export type UniversityCoursesUniversity = {
  name: string;
  slug: string;
  websiteUrl: string | null;
  country: CountryRef;
  city: string | null;
};

export type UniversityCoursesProps = {
  university: UniversityCoursesUniversity;
  filters: CourseFilters;
  facets: CourseFacets;
  cards: OfferingCardData[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  catalogueTotal: number;
  /** Distinct campuses the courses are taught at. */
  campuses: number;
  deadlines: Array<{ label: string; deadline: string | null; count: number }>;
  scholarships: ScholarshipCard[];
};

const FAQS = [
  {
    q: 'Are these all the courses this university offers?',
    a: 'They are every course Universta has published for it. A university usually lists more than a catalogue carries; where a course is missing, it has not been added yet, so check the university’s own website too.',
  },
  {
    q: 'Is the tuition figure final?',
    a: 'No. It is the published figure for international students at the time the record was checked. Confirm the exact fee with the university before you apply.',
  },
  {
    q: 'What does the intake deadline mean?',
    a: 'It is the application deadline recorded against that intake for this specific course. Deadlines differ by course, so check the one you are applying to.',
  },
];


const figure = (value: number) => (value ? value.toLocaleString('en-GB') : '—');

export function UniversityCourses(props: UniversityCoursesProps) {
  const { university, facets, catalogueTotal: total } = props;
  const { country } = university;
  const base = universityCoursesHref(country.slug, university.slug);
  /* The country inside a sentence: "Study in the United Kingdom". */
  const inWhere = inCountry(country.name, country.iso2Code);
  const counselling = counsellingHref({
    source: 'country',
    country: country.slug,
    from: base,
  });

  /* Numbered from the bands that render, so the run never skips. */
  const order = ['courses'];
  if (facets.level.length) order.push('levels');
  if (facets.subject.length) order.push('subjects');
  if (props.deadlines.length) order.push('intakes');
  if (props.scholarships.length) order.push('scholarships');
  order.push('faq');
  const n = (id: string) => String(order.indexOf(id) + 1).padStart(2, '0');
  const band = (id: string) =>
    `sec ${order.indexOf(id) % 2 === 0 ? 'sec--white' : 'sec--paper'}`;

  const stats = [
    { label: total === 1 ? 'Course' : 'Courses', value: total },
    { label: 'Degree levels', value: facets.level.length },
    { label: 'Subjects', value: facets.subject.length },
    { label: 'Study modes', value: facets.studyMode.length },
    { label: 'Campuses', value: props.campuses },
    { label: 'Intakes', value: facets.intake.length },
  ];

  /* The structured data reads the trail the page draws and the questions
     its last band answers. */
  const trail: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: 'Study abroad', href: '/study-abroad' },
    { label: country.name, href: `/study-abroad/${country.slug}` },
    { label: 'Universities', href: countryUniversitiesHref(country.slug) },
    { label: university.name, href: universityHref(university.slug) },
    { label: 'Courses' },
  ];
  const structured = [
    breadcrumbJsonLd(trail, base),
    faqJsonLd(FAQS.map((item) => ({ question: item.q, answer: item.a }))),
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

      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={trail} />

          <div className="unihero">
            <div className="unihero__main">
              <div className="unihero__id">
                <span className="unimark unimark--lg" aria-hidden="true">
                  {universityInitials(university.name)}
                </span>
                <div>
                  <p className="hero__eyebrow">Courses offered</p>
                  <h1 className="unihero__name">Courses at {university.name}</h1>
                  <p className="unihero__where">
                    <FlagMark iso2Code={country.iso2Code} bands={null} />
                    <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
                    {university.city ? <span>· {university.city}</span> : null}
                  </p>
                </div>
              </div>

              <p className="unihero__desc">
                {total
                  ? `${total.toLocaleString('en-GB')} ${total === 1 ? 'course is' : 'courses are'} published for ${university.name}, each with its level, study mode, duration, tuition and intakes where the university has stated them.`
                  : `No course at ${university.name} is in the Universta catalogue yet. The university’s own website lists what it teaches.`}
              </p>

              <div className="btn-row">
                {total ? (
                  <a className="btn btn--lg" href="#courses">
                    Browse {total === 1 ? 'the course' : `${total.toLocaleString('en-GB')} courses`}{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </a>
                ) : null}
                <Link
                  className="btn btn--lg btn--ghost"
                  href={universityHref(university.slug)}
                >
                  University profile
                </Link>
                {university.websiteUrl ? (
                  <a
                    className="btn btn--lg btn--ghost"
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
                <Link className="btn btn--lg btn--ghost" href={counselling}>
                  Talk to a counsellor
                </Link>
              </div>
            </div>
          </div>

          <div className="statstrip statstrip--6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <b className="datum">{figure(stat.value)}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          {facets.subject.length ? (
            <div className="specchips">
              <span className="label">Popular subjects here</span>
              <div className="specchips__row">
                {facets.subject.slice(0, 8).map((subject) => (
                  <Link
                    key={subject.value}
                    className="specchip specchip--live"
                    href={`/study-abroad/${country.slug}/${subject.value}`}
                  >
                    {subject.label}
                    <em>{subject.count}</em>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={band('courses')} id="courses">
        <div className="wrap">
          <SectionHead
            n={n('courses')}
            eyebrow="Courses"
            title="Explore programmes"
            lead={
              total
                ? `Search ${university.name}'s ${total === 1 ? 'course' : `${total.toLocaleString('en-GB')} courses`}, narrow them by level, subject, duration, intake and study mode, and sort them. Every count is taken over all of them.`
                : undefined
            }
          />
          {total ? (
            <UniversityCourseResults
              base={base}
              universitySlug={university.slug}
              universityName={university.name}
              filters={props.filters}
              facets={facets}
              cards={props.cards}
              meta={props.meta}
              catalogueTotal={total}
            />
          ) : (
            <p className="dir__none" data-testid="courses-none">
              No course at this university is in our catalogue yet.{' '}
              {university.websiteUrl ? (
                <>
                  <a
                    href={university.websiteUrl}
                    rel="nofollow noopener"
                    target="_blank"
                  >
                    Check the official university website &#8599;
                  </a>{' '}
                  or{' '}
                </>
              ) : null}
              <Link href={counselling}>ask a counsellor</Link> what it teaches.
            </p>
          )}
        </div>
      </section>

      {facets.level.length ? (
        <section className={band('levels')} id="levels">
          <div className="wrap">
            <SectionHead
              n={n('levels')}
              eyebrow="By qualification"
              title="Browse by degree level"
              lead="Each opens the list above at that level."
            />
            {/* No initials tile, unlike the subjects below: a level's
                initials read as a degree -- "BA" for Bachelor's, "MA" for
                Master's -- on a page whose courses may be a BSc and an MSc. */}
            <div className="h-grid h-grid--4">
              {facets.level.map((level) => (
                <RowCard
                  key={level.value}
                  href={`${base}${courseListSearch(props.filters, {
                    q: '',
                    level: [level.value],
                    subject: [],
                    specialization: [],
                    duration: [],
                    intake: [],
                    studyMode: [],
                    scholarship: false,
                  })}#courses`}
                  title={level.label}
                  meta={countLabel(level.count, 'course')}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {facets.subject.length ? (
        <section className={band('subjects')} id="subjects">
          <div className="wrap">
            <SectionHead
              n={n('subjects')}
              eyebrow="By subject"
              title="Browse by subject"
              lead={`The subject areas ${university.name} publishes courses in. Each opens the subject's own guide.`}
            />
            <div className="h-grid">
              {facets.subject.map((subject) => (
                <RowCard
                  key={subject.value}
                  href={`/subjects/${subject.value}`}
                  title={subject.label}
                  meta={countLabel(subject.count, 'course')}
                  mark
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {props.deadlines.length ? (
        <section className={band('intakes')} id="intakes">
          <div className="wrap">
            <SectionHead
              n={n('intakes')}
              eyebrow="Timeline"
              title="Intakes and deadlines"
              lead="Application deadlines recorded against this university's courses. Each course page has its own."
            />
            <table className="entrytable uc-intakes">
              <caption className="sr-only">
                Intakes and application deadlines at {university.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Intake</th>
                  <th scope="col">Apply by</th>
                  <th scope="col">Courses</th>
                </tr>
              </thead>
              <tbody>
                {props.deadlines.map((entry) => (
                  <tr key={`${entry.label}-${entry.deadline ?? ''}`}>
                    <th scope="row">{entry.label}</th>
                    <td>{dateLabel(entry.deadline) ?? 'Deadline not published'}</td>
                    <td>{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {props.scholarships.length ? (
        <section className={band('scholarships')} id="scholarships">
          <div className="wrap">
            <SectionHead
              n={n('scholarships')}
              eyebrow="Funding"
              title={`Scholarships at ${university.name}`}
              lead={FUNDING_CAVEAT}
            >
              <p className="h-more">
                <Link className="linkcta" href={countryScholarshipsHref(country.slug)}>
                  All scholarships in {inWhere}{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </p>
            </SectionHead>
            <ScholarshipCards scholarships={props.scholarships} showCountries={false} />
          </div>
        </section>
      ) : null}

      <section className={band('faq')} id="faq">
        <div className="wrap">
          <SectionHead
            n={n('faq')}
            eyebrow="Questions"
            title="Frequently asked questions"
          />
          <div className="faq">
            {FAQS.map((item, index) => (
              <details className="faq__item" key={item.q} open={index === 0}>
                <summary className="faq__q">
                  {item.q}
                  <span className="faq__plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="faq__a prose">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PlanBand
        heading={`Shortlist your ${university.name} courses`}
        body="Compare courses on tuition, duration and intake, then talk your shortlist through with a counsellor before you apply."
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: counselling, label: 'Book free counselling' }}
      />

      <ConnectBand
        actions={[
          { href: universityHref(university.slug), label: 'University profile' },
          {
            href: countryUniversitiesHref(country.slug),
            label: `Universities in ${inWhere}`,
            ghost: true,
          },
          {
            href: `/study-abroad/${country.slug}`,
            label: `Study in ${inWhere}`,
            ghost: true,
          },
          {
            href: countryScholarshipsHref(country.slug),
            label: `Scholarships in ${inWhere}`,
            ghost: true,
          },
        ]}
        groups={[
          {
            title: 'Subjects here',
            items: facets.subject.map((subject) => ({
              id: subject.value,
              name: subject.label,
              href: `/study-abroad/${country.slug}/${subject.value}`,
            })),
          },
        ]}
      />

      <CompareTray />
    </>
  );
}
