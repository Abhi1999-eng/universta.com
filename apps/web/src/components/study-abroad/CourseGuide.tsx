import Link from 'next/link';
import type { CourseDetail } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { CourseCards } from './CourseCards';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';

/**
 * A programme's guide, in the approved design.
 *
 * The reference runs twelve sections here, several of which describe things a
 * generic course record cannot know -- which university teaches it, which
 * consultants cover it. Those stand down rather than render a heading over
 * nothing, and the numbering is taken from what survives so it never skips.
 */
export function CourseGuide({ course }: { course: CourseDetail }) {
  const overview = course.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  const sections = course.contentSections ?? [];
  const faqs = course.faqs ?? [];
  const related = course.relatedCourses ?? [];
  const availability = course.availability ?? [];
  const careers = course.careerSummary?.trim();

  const named = (key: string) =>
    sections.find((section) => section.sectionKey === key);
  const curriculum = named('curriculum');
  const eligibility = named('eligibility');
  const apply = named('apply') ?? named('admission-process');

  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (curriculum) order.push('curriculum');
  if (eligibility) order.push('eligibility');
  if (availability.length) order.push('destinations');
  if (apply) order.push('apply');
  if (careers) order.push('careers');
  if (faqs.length) order.push('faqs');
  if (related.length) order.push('similar');

  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const band = (id: string) =>
    order.indexOf(id) % 2 === 0 ? 'sec sec--paper' : 'sec sec--white';

  const subjectSlug = course.subject?.slug;
  const body = (section: { bodyJson?: { paragraphs?: unknown } | null }) => {
    const paragraphs = Array.isArray(section.bodyJson?.paragraphs)
      ? (section.bodyJson.paragraphs as unknown[]).filter(
          (line): line is string => typeof line === 'string',
        )
      : [];
    return paragraphs;
  };

  return (
    <>
      <section className="hero hero--compact">
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
          <div className="hero__lead">
            <p className="hero__eyebrow">
              {course.courseLevel?.name ?? 'Programme'}
              {course.qualificationName ? (
                <>
                  <b>·</b>
                  {course.qualificationName}
                </>
              ) : null}
            </p>
            <h1 className="hero__h1">{course.name}</h1>
            {course.shortDescription ? (
              <p className="hero__sub">{course.shortDescription}</p>
            ) : null}
          </div>
          <div className="coursefacts">
            {course.duration?.min ? (
              <span className="datum">
                {[course.duration.min, course.duration.max]
                  .filter(Boolean)
                  .join('–')}{' '}
                {course.duration.unit?.toLowerCase() ?? ''}
              </span>
            ) : null}
            {course.studyModes?.length ? (
              <span className="datum">
                {course.studyModes.map((mode) => mode.name).join(', ')}
              </span>
            ) : null}
            {availability.length ? (
              <span className="datum">
                {availability.length}{' '}
                {availability.length === 1 ? 'destination' : 'destinations'}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title={`About ${course.name}`}
            />
            <div className="prose">
              <RichText value={overview!} />
            </div>
          </div>
        </section>
      ) : null}

      {curriculum ? (
        <section className={band('curriculum')} id="curriculum">
          <div className="wrap">
            <SectionHead
              n={n('curriculum')}
              eyebrow="Curriculum"
              title={curriculum.heading ?? 'What you study'}
            />
            <div className="prose">
              {body(curriculum).map((line, index) => (
                <RichText key={index} value={line} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {eligibility ? (
        <section className={band('eligibility')} id="eligibility">
          <div className="wrap">
            <SectionHead
              n={n('eligibility')}
              eyebrow="Eligibility"
              title={eligibility.heading ?? 'Who can apply'}
            />
            <div className="prose">
              {body(eligibility).map((line, index) => (
                <RichText key={index} value={line} />
              ))}
            </div>
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
            <div className="chip-row">
              {availability.map((row) => (
                <Link
                  key={row.id}
                  className="chipbtn"
                  href={`/study-abroad/${row.country.slug}`}
                >
                  {row.country.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {apply ? (
        <section className={band('apply')} id="apply">
          <div className="wrap">
            <SectionHead
              n={n('apply')}
              eyebrow="Applying"
              title={apply.heading ?? 'How to apply'}
            />
            <div className="prose">
              {body(apply).map((line, index) => (
                <RichText key={index} value={line} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {careers ? (
        <section className={band('careers')} id="careers">
          <div className="wrap">
            <SectionHead
              n={n('careers')}
              eyebrow="Careers"
              title="Where it leads"
            />
            <div className="prose">
              <RichText value={careers} />
            </div>
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
                  <summary className="faq__q">{faq.question}</summary>
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
        heading="Not sure this is the right programme?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
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
